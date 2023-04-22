'use strict';

/**
 *  controller
 */

module.exports = {
  async getSettings(ctx) {
    ctx.body = await strapi
      .plugin('facebook-feed')
      .service('connect')
      .getSettings();
  },

  async saveSettings(ctx) {
    const { body } = ctx.request;
    ctx.body = await strapi
      .plugin('facebook-feed')
      .service('connect')
      .saveSettings(body);
  },

  async connectPage(ctx) {
    const { body } = ctx.request;
    ctx.body = await strapi
      .plugin('facebook-feed')
      .service('connect')
      .connectPage(body);
  },

  async getConnectedPage(ctx) {
    ctx.body = await strapi
      .plugin('facebook-feed')
      .service('connect')
      .getConnectedPage();
  },

  async fetchPosts(ctx) {
    ctx.body = await strapi
      .plugin('facebook-feed')
      .service('connect')
      .fetchPosts();
  },

  async getPicture(ctx) {
    try {
      ctx.body = await strapi
        .plugin('facebook-feed')
        .service('connect')
        .getPicture(ctx.params.path);
      ctx.type = 'image/webp';
    }
    catch (err) {
      console.log('getPicture', err);
      ctx.status = 404; // not found
    }
  }
};