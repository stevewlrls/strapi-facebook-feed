'use strict';

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
  const store = getPluginStore();
  let settings = await store.get({key: 'settings'});
  if (! settings)
    settings = {
      appName:    '',
      appId:      '',
      appSecret:  '',
      clientSecret: ''
    };
  return settings;
}

//---------------------------------------------------------------------------
// saveSettings
//    Updates the Facebook 'app' saved settings.
//---------------------------------------------------------------------------

async function saveSettings(settings) {
  try {
    // Sanitize fields.
    for (const key in settings) {
      if (! ['appName', 'appId', 'appSecret', 'clientSecret'].includes(key))
        delete settings[key];
    }
    // Then write to the database.
    const store = getPluginStore();
    await store.set({key: 'settings', value: settings});
    // Return the sanitized data.
    return settings;
  }
  catch (err) {
    return {error: err.message};
  }
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
    return { pageName, appId, clientSecret };
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
  const settings = await store.get({key: 'settings'});
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
  // First get the page token. If we don't have one yet, return an error.
  const store = getPluginStore();
  const page = await store.get({key: 'pageInfo'});
  if (! page.pageToken)
    return { error: 'Not connected' };

  let fetched = await getFacebookPosts(store, page);

  if (! page.pageOnly)
    fetched += await getInstagramPosts(store, page);

  return { fetched }
}

//---------------------------------------------------------------------------
// getFacebookPosts
//    Fetches any new Facebook posts on the connected page. Stops when any
// post returned by Facebook has already been fetched and stored (assuming
// that FB returns posts with the default sort order of newest first).
//---------------------------------------------------------------------------

async function getFacebookPosts(store, page) {
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
  const app = await store.get({key: 'settings'});
  let fetched = 0;

  let next = `https://graph.facebook.com/${page.pageID}/feed` +
    `?access_token=${page.pageToken}` +
    '&fields=id,created_time,updated_time,from,full_picture,message,attachments,permalink_url' +
    `&client_id=${app.appId}` +
    `&client_secret=${app.appSecret}`;

  // Fetch and process each page of results.
  while (next) {
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

      // Otherwise, we create a new 'facebook-post' entry from the post
      // data.
      await strapi.entityService.create(
        'plugin::facebook-feed.facebook-post',
        {
          data: {
            postID:   post.id,
            title:    post.message?.split("\n")[0] || 'No title',
            tags:     post.message?.match(/:[\w]+/g)?.join(',') || '',
            body:     post.message || '',
            author:   post.from.name || page.pageName,
            featured: post.full_picture,
            image_size:
              post.attachments?.data[0].media.image.width + 'x' +
              post.attachments?.data[0].media.image.height,
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

async function getInstagramPosts(store, page) {
  // First get a list of posts we've already saved.
  const saved = await strapi.entityService.findMany(
    'plugin::facebook-feed.instagram-post',
    {
      fields: ['mediaID'],
      sort: { createdAt: 'desc' }
    });

  // Then fetch a list of posts from the page owner.
  let fetched = 0;

  let next = `https://graph.facebook.com/${page.userId}/media` +
    '?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,username,permalink' +
    `&access_token=${page.longUserToken}`;

  // Process each page of results
  while (next) {
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

      await strapi.entityService.create(
        'plugin::facebook-feed.instagram-post',
        {
          data: {
            mediaID:  post.id,
            caption:  post.caption,
            tags:     '',
            author:   post.username,
            mediaURL: post.thumbnail_url || post.media_url,
            mediaSize: '',
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
  saveSettings,
  connectPage,
  getConnectedPage,
  fetchPosts
});
