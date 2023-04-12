'use strict';

/**
 *  router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter(
  'plugin::facebook-feed.instagram-post',
  {
    type: 'content-api',
  }
);
