// connection.js
const { dbConfig } = require('./config');
const DbController = require('./DbController');

// Create and export database instance
const db = new DbController(dbConfig);

module.exports = db;