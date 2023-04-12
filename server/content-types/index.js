'use strict';

const post = require('./facebook-post');
const media = require('./instagram-post');

module.exports = {
  'facebook-post': post,
  'instagram-post': media
};
