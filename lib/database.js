/*!
* reco
* Copyright(c) 2017 Carlos Ascari Gutierrez Hermosillo
* MIT License
*/

const fs = require('fs-extra');
const knex = require('knex');

const { defineProperty } = Object;

/**
* Light wrapper around knex.
*/
class Database {

  /**
  * @constructor
  * @param {Object} knexConfig
  */
  constructor(knexConfig) {
    const _ = defineProperty(this, '_', { value: {} })._;
   _.knexClient = knex(knexConfig);
  }

  /**
  * Returns knex client.
  */
  get knex() { return this._.knexClient; }

  /**
  * Migrate datbase to latest schema.
  * @return {Promise}
  */
  latest() { return this._.knexClient.migrate.latest(); }
}

module.exports = Database;