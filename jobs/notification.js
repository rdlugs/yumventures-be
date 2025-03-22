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

const getNotifications = async (business_id) => {
    try {
        let sql = `
            SELECT * FROM notifications
            WHERE business_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        `;

        let [results] = await db.execute(sql, [business_id]);
        
        return results;

    } catch (error) {
        console.error("Error get notifications:", error);
        return []
    }
}


module.exports = { getNotifications };