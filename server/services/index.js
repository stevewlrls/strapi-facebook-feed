'use strict';

const connect = require('./connect');
const post = require('./facebook-post');
const media = require('./instagram-post');

module.exports = {
  connect,
  'facebook-post': post,
  'instagram-post': media,
};
