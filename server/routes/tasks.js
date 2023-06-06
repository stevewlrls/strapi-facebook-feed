'use strict';

/**
 *  router
 */

module.exports = {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/settings',
      handler: 'tasks.getSettings',
      config: {
        policies: [],
        // auth: false
      }
    },
    {
      method: 'POST',
      path: '/connect',
      handler: 'tasks.connectPage',
      config: {
        policies: [],
        // auth: false
      }
    },
    {
      method: 'GET',
      path: '/connect',
      handler: 'tasks.getConnectedPage',
      config: {
        policies: [],
        // auth: false
      }
    },
    {
      method: 'GET',
      path: '/fetch-posts',
      handler: 'tasks.fetchPosts',
      config: {
        policies: [],
        auth: false // Must be false, to allow cloud platform to invoke
      }
    }
  ]
};
