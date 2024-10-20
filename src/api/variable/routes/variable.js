'use strict';

/**
 * variable router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::variable.variable');
