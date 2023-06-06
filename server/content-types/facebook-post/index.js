'use strict';

const schema = require('./schema');

const filePrefix = '/facebook-post';

async function beforeDelete(event) {
  // Lifecycle hook for 'deleteOne' action. Removes the associated featured
  // image file, if any.
  const item = await strapi.db.query(
    'plugin::facebook-feed.facebook-post'
  ).findOne({
    select: ['postID', 'featured'],
    where: event.params.where
  });
  if (item && item.featured)
    await deleteSingleFile(item)
}

async function beforeDeleteMany(event) {
  // Lifecycle hook for the 'deleteMany' action. Removes the featured image
  // files for all of the selected posts.
  console.log(event.params.where);
  const items = await strapi.db.query(
    'plugin::facebook-feed.facebook-post'
  ).findMany({
    select: ['postID', 'featured'],
    where: event.params.where
  });
  if (items) {
    for (const item of items)
      await deleteSingleFile(item)
  }
}

async function deleteSingleFile(item) {
  // Delete the saved 'featured image' file (if any) associated with the given
  // post.
  if (! item.featured) return;
  const file = {
    path: `${filePrefix}/${item.postID}.webp`,
    name: item.postID,
    ext:  '.webp',
    mime: 'image/webp',
    folder: filePrefix,
    folderPath: filePrefix,
    hash: item.postID,
    url:  item.featured
  };
  //console.log('Deleting file:', file);
  await strapi.plugin('upload').provider.delete(file)
    .catch(() => {}); // Ignore errors
}

module.exports = {
  schema,
  lifecycles: {
    beforeDelete,
    beforeDeleteMany
  }
}