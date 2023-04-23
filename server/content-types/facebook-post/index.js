'use strict';

const fs = require('node:fs/promises');

const schema = require('./schema');

module.exports = {
  schema,
  lifecycles: {
    async beforeDelete(event) {
      const item = await strapi.db.query(
        'plugin::facebook-feed.facebook-post'
      ).findOne({
        select: ['postID'],
        where: event.params.where
      });
      if (item) {
        const picture = item.postID + '.webp';
        await fs.rm('./public/facebook-feed/' + picture)
          .catch(() => {}); // Ignore errors
      }
    }
  }
}