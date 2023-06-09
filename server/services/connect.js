'use strict';

const sharp = require('sharp');

const facebookFilePrefix = 'facebook-post';
const instagramFilePrefix = 'instagram-post';

//---------------------------------------------------------------------------
// getPluginStore
//    Helper function that returns the database store (table) in which we
// keep plugin settings and other, related data.
//---------------------------------------------------------------------------

function getPluginStore() {
  return strapi.store({
    environment: '',
    type: 'plugin',
    name: 'facebook-feed-settings',
  });
}

//---------------------------------------------------------------------------
// getSettings
//    Returns the Facebook 'app' settings, with an empty default if not yet
// set.
//---------------------------------------------------------------------------

async function getSettings() {
  let settings = strapi.config.get('plugin.facebook-feed');
  if (! settings)
    settings = {
      appName:    '',
      appId:      '',
      appSecret:  '',
      clientSecret: '',
      cronTable:  ''
    };
  return settings;
}

//---------------------------------------------------------------------------
// connectPage
//    Completes the process to connect the app to a Facebnook page, and
// (optionally) its related Instagram business account.
//---------------------------------------------------------------------------

async function connectPage({userToken, userID, pageOnly}) {
  try {
    const settings = await getSettings();

    // First we convert the short-lived user token to a long-lived one, as
    // we need that to get a long-lived page access token.
    const userResponse = await fetch(
      'https://graph.facebook.com/v16.0/oauth/access_token' +
        '?grant_type=fb_exchange_token' +
        `&client_id=${settings.appId}` +
        `&client_secret=${settings.appSecret}` +
        `&fb_exchange_token=${userToken}`
    )
    .then(response => response.json());

    const longUserToken = userResponse.access_token;

    // Next we request the long-lived page access token. Note that we assume
    // (require) that the user only connects to one page, which will therefore
    // be index 0 in returned list.
    const pageResponse = await fetch(
      `https://graph.facebook.com/v16.0/${userID}/accounts` +
      `?access_token=${longUserToken}`
    )
    .then(response => response.json());

    const {access_token: pageToken, name: pageName, id: pageID} = pageResponse.data[0];

    // And then we write the connnection details into our Strapi store,
    // from which we can retrieve it when we need it.
    const store = getPluginStore();
    await store.set({
      key: 'pageInfo',
      value: {
        pageName, pageID, pageToken, userID, longUserToken,
        pageOnly: Boolean(pageOnly)
      }
    });

    // Return the same kind of response as 'getConnectedPage'.
    const { appId, clientSecret } = settings;
    return { pageName, appId, clientSecret, pageOnly };
  }
  catch (err) {
    return { error: err.message };
  }
}

//---------------------------------------------------------------------------
// getConnectedPage
//    Returns stored details for the page to which the plugin is connected,
// or suitable defaults if not yet connected.
//---------------------------------------------------------------------------

async function getConnectedPage() {
  const store = getPluginStore();
  const connection = await store.get({key: 'pageInfo'});
  const settings = await getSettings();
  const { pageName, pageOnly } = connection || {};
  const { appId, clientSecret } = settings || {};
  return { pageName, appId, clientSecret, pageOnly };
}

//---------------------------------------------------------------------------
// fetchPosts
//    This function is called both via an admin UI request, and as a 'cron'
// job (see plugin/server/bootstrap.js) for periodic execution. It always
// fetches Facebook page posts, but will only fetch Instagram posts if so
// configured.
//---------------------------------------------------------------------------

async function fetchPosts() {
  // First get the user access token. If we don't have one yet, return an error.
  const store = getPluginStore();
  const page = await store.get({key: 'pageInfo'});
  if (! page.longUserToken)
    return { error: 'Not connected' };

  // Next we renew the page access token. Note that we assume (require) that
  // the user only connects to one page, which will therefore be index 0 in
  // the returned list.
  const pageResponse = await fetch(
    `https://graph.facebook.com/v16.0/${page.userID}/accounts` +
    `?access_token=${page.longUserToken}`
  )
  .then(response => response.json());

  const {access_token} = pageResponse.data[0];
  page.pageToken = access_token;

  // Next get the app settings, for requests to the Graph API.
  const app = await getSettings();

  // Then fetch posts ...
  let fetched = await getFacebookPosts(app, page);

  if (! page.pageOnly)
    fetched += await getInstagramPosts(app, page);

  return { fetched }
}

//---------------------------------------------------------------------------
// getFacebookPosts
//    Fetches any new Facebook posts on the connected page. Stops when any
// post returned by Facebook has already been fetched and stored (assuming
// that FB returns posts with the default sort order of newest first).
//---------------------------------------------------------------------------

async function getFacebookPosts(app, page) {
  const serverURL = strapi.config.get('server.url');

  // Fetch a list of all posts we've added so far: just the post ID will
  // do. We'll use this to avoid creating a new entry for these, and to
  // stop fetching.
  const saved = await strapi.entityService.findMany(
    'plugin::facebook-feed.facebook-post',
    {
      fields: ['postID'],
      sort: { createdAt: 'desc' }
    });

  // Now start fetching posts from the connected Facebook page (default
  // order is newest first).
  let fetched = 0;

  let next = `https://graph.facebook.com/${page.pageID}/feed` +
    `?access_token=${page.pageToken}` +
    '&fields=id,created_time,updated_time,from,full_picture,message,permalink_url' +
    `&client_id=${app.appId}` +
    `&client_secret=${app.appSecret}`;

  // Fetch and process each page of results.
  while (next && fetched < 50) {
    const response = await fetch(next).then(rsp => rsp.json());
    if (response.error) {
      console.log('Facebook rejected request:', response.error);
      break;
    }
    next = response.paging.next;

    // Within a page, we loop through the array of post data. If we find an
    // entry we have already stored, we stop processing (and fetching) any
    // more.
    for (const post of response.data) {
      if (saved.some(p => p.postID === post.id)) {
        next = null;
        break;
      }

      if (! post.message) continue;

      // Otherwise, we fetch the 'full picture' image and store it locally,
      // as Facebook links expire after a few days.
      let width = 0, height = 0, featured;

      if (post.full_picture) {
        try {
          const {data, info} =
            await fetch(post.full_picture)
              .then(rsp => rsp.arrayBuffer())
              .then(buf =>
                sharp(buf)
                  .rotate()
                  .resize(700)
                  .webp()
                  .toBuffer({resolveWithObject: true})
              );

          const file = {
            path: facebookFilePrefix,
            name: `${post.id}`,
            ext: '.webp',
            mime: 'image/webp',
            hash: post.id,
            buffer: data
          };

          await strapi.plugin('upload').provider.upload(file);

          width = info.width; height = info.height;
          featured =
            file.url.startsWith('http') ?
              file.url :
              serverURL.replace(/\/*$/, '') + file.url;
        }
        catch(err) {
          console.log('Cannot write FB image', path, err);
        }
      }

      // Create a new 'facebook-post' entry from the post data.
      await strapi.entityService.create(
        'plugin::facebook-feed.facebook-post',
        {
          data: {
            postID:   post.id,
            title:    (post.message?.split("\n")[0] || 'No title').slice(0, 60),
            tags:     post.message?.match(/:[\w]+/g)?.join(',') || '',
            body:     post.message || '',
            author:   post.from.name || page.pageName,
            featured,
            image_size: featured ? `${width}x${height}` : '0x0',
            permalink: post.permalink_url,
            created:  post.created_time,
            updated:  post.updated_time
          }
        }
      );

      fetched++;
    }
  }

  return fetched
}

//---------------------------------------------------------------------------
// getInstagramPosts
//    Fetches any new Instagram posts (media) for the user who owns the
// connected page. Note that this uses the Instagram Graph API, so will not
// obtain any posts if the user is not a Business or Creator.
//---------------------------------------------------------------------------

async function getInstagramPosts(app, page) {
  // First get a list of posts we've already saved.
  const saved = await strapi.entityService.findMany(
    'plugin::facebook-feed.instagram-post',
    {
      fields: ['mediaID'],
      sort: { createdAt: 'desc' }
    });

  // Look up the Instagram account linked to the FB page.
  const info = await fetch(
    `https://graph.facebook.com/v16.0/${page.pageID}` +
    '?fields=instagram_business_account' +
    `&access_token=${page.pageToken}`
  ).then(rsp => rsp.json());

  if (info.error) {
    console.log('Facebook cannot provide IG user', info.error);
    return 0;
  }

  const ig_user = info.instagram_business_account.id;

  // Then fetch a list of posts from the page owner.
  let fetched = 0;

  let next = `https://graph.facebook.com/v16.0/${ig_user}/media` +
    '?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,username,permalink' +
    `&access_token=${page.pageToken}`;

  // Process each page of results
  while (next && fetched < 50) {
    const response = await fetch(next).then(rsp => rsp.json());
    if (response.error) {
      console.log('Facebook rejected request:', response.error);
      break;
    }
    next = response.paging.next;

    // Each 'page' of data lists a variable number of media posts. We stop
    // processing if any has already been fetched, else we keep fetching
    // and storing until the end of the list.
    for (const post of response.data) {
      if (saved.some(p => p.mediaID === post.id)) {
        next = 0;
        break;
      }

      // Fetch the post thumbnail (or full image) and store that in the uploads
      // area. (The URL given by Facebook is only temporary.)
      let width = 0, height = 0, featured;

      const media_url = post.thumbnail_url || post.media_url;

      if (! post.caption && ! media_url) continue;

      if (media_url) {
        const name = post.id,
              path = `${filePrefix}/${name}.webp`;

        try {
          const {data, info} =
            await fetch(media_url)
              .then(rsp => rsp.arrayBuffer())
              .then(buf =>
                sharp(buf)
                  .rotate()
                  .resize(700)
                  .webp()
                  .toBuffer({resolveWithObject: true})
              );

          const file = {
            path:  instagramFilePrefix,
            name:  `${post.id}`,
            ext:   '.webp',
            mime:  'image/webp',
            hash:  post.id,
            buffer: data
          };

          await strapi.plugin('upload').provider.upload(file);

          width = info.width; height = info.height;
          featured =
            file.url.startsWith('http') ?
              file.url :
              serverURL.replace(/\/*$/, '') + file.url;
        }
        catch(err) {
          console.log('Cannot write FB image', path, err);
        }
      }

      // Finally, write a new entry into the Instagram Posts table.

      await strapi.entityService.create(
        'plugin::facebook-feed.instagram-post',
        {
          data: {
            mediaID:  post.id,
            caption:  post.caption,
            tags:     '',
            author:   post.username,
            mediaURL: featured,
            mediaSize: featured ? `${width}x${height}` : '0x0',
            created:  post.timestamp,
            permalink: post.permalink
          }
        }
      );

      fetched++;
    }
  }

  return fetched;
}

//---------------------------------------------------------------------------
// Module exports
//---------------------------------------------------------------------------

module.exports = () => ({
  getSettings,
  connectPage,
  getConnectedPage,
  fetchPosts
});
