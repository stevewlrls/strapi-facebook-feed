'use strict';

const post = require('./facebook-post');
const media = require('./instagram-post');
const tasks = require('./tasks');

module.exports = {
  'facebook-post': post,
  'instagram-post': media,
  tasks
};
