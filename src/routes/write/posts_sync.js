'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');
const bodyParser = require('body-parser');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
  const middlewares = [
    middleware.ensureLoggedIn
  ];

  setupApiRoute(router, 'post', '/', middlewares, controllers.admin.postsSync.sync);

  return router;
};
