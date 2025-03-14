const mysql = require("mysql2/promise");
require("dotenv").config();

async function createTenantDatabase(tenantName) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST, // Host might be the same as central DB
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    // 1. Create a new database for the tenant
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${tenantName}`);
    console.log(`Tenant database "${tenantName}" created.`);

    // Return the connection to the tenant's database
    return mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: tenantName, // Tenant's database
      port: process.env.DB_PORT,
      connectionLimit: 10,
    });
  } catch (error) {
    console.error(`Error creating tenant database: ${error.message}`);
    throw error;
  } finally {
    await connection.end();
  }
}

module.exports = { createTenantDatabase };
