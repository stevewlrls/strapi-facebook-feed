'use strict';

module.exports = ({ strapi }) => {
  // bootstrap phase
  strapi.cron.add({
    'facebook-fetch-items': {
      task: ({strapi}) => {
        strapi.plugin('facebook-feed')
          .service('connect')
          .fetchPosts()
      },
      options: {
        // Once per day, at 11pm.
        rule: '0 0 23 * * *',
      }
    }
  })
};
