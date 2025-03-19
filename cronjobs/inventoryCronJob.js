require('dotenv').config({ path: '../.env' });

const cron = require('node-cron');
const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: process.env.CENTRAL_DB_HOST,
    user: process.env.CENTRAL_DB_USER,
    password: process.env.CENTRAL_DB_PASSWORD,
    database: process.env.CENTRAL_DB_NAME,
  });
  
cron.schedule('* * * * *', () => {
    let sql = "SELECT * FROM businesses";
    connection.query(sql, function (err, result) {
        if (err) throw err;
        console.log(JSON.stringify(result));
    });
});