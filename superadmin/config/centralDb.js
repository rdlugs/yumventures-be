const mysql = require("mysql2/promise");
require("dotenv").config();

const centralDb = mysql.createPool({
  host: process.env.CENTRAL_DB_HOST,
  user: process.env.CENTRAL_DB_USER,
  password: process.env.CENTRAL_DB_PASSWORD,
  database: process.env.CENTRAL_DB_NAME, // Central database name
  port: process.env.DB_PORT,
  connectionLimit: 10, // Optional: Set connection limit
});

module.exports = { centralDb };
