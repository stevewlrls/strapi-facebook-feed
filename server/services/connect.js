'use strict';

function getPluginStore() {
  return strapi.store({
    environment: '',
    type: 'plugin',
    name: 'facebook-feed-settings',
  });
}

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

async function connectPage({userToken, userID}) {
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

    // Next we request the long-lived page access token.
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
        pageToken, pageName, pageID, userID
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

async function getConnectedPage() {
  const store = getPluginStore();
  const connection = await store.get({key: 'pageInfo'});
  const settings = await store.get({key: 'settings'});
  const { pageName } = connection || {};
  const { appId, clientSecret } = settings || {};
  return { pageName, appId, clientSecret };
}

async function fetchPosts() {
  // First get the page token. If we don't have one yet, return an error.
  const store = getPluginStore();
  const page = await store.get({key: 'pageInfo'});
  if (! page.pageToken)
    return { error: 'Not connected' };

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
    '&fields=id,created_time,updated_time,from,full_picture,message,attachments' +
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
            created:  post.created_time,
            updated:  post.updated_time
          }
        }
      );

      fetched++;
    }
  }

  return { fetched }
}

module.exports = () => ({
  getSettings,
  saveSettings,
  connectPage,
  getConnectedPage,
  fetchPosts
});
