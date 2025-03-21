require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mysql = require("mysql2");
const moment = require('moment');

const connection = mysql.createPool({
    host: process.env.CENTRAL_DB_HOST,
    user: process.env.CENTRAL_DB_USER,
    password: process.env.CENTRAL_DB_PASSWORD,
    database: process.env.CENTRAL_DB_NAME,
});

const db = connection.promise();