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
  }
};