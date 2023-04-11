'use strict';

const connect = require('./connect');
const post = require('./facebook-post');

module.exports = {
  connect,
  'facebook-post': post,
};
