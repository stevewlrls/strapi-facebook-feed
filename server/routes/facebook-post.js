'use strict';

/**
 *  router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter(
  'plugin::facebook-feed.facebook-post',
  {
    type: 'content-api',
    only: ['find', 'findOne']
  }
);
