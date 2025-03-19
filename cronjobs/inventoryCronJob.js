require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const cron = require('node-cron');
const mysql = require("mysql2");
const moment = require('moment')

const connection = mysql.createPool({
    host: process.env.CENTRAL_DB_HOST,
    user: process.env.CENTRAL_DB_USER,
    password: process.env.CENTRAL_DB_PASSWORD,
    database: process.env.CENTRAL_DB_NAME,
});
  
const db = connection.promise();

cron.schedule('* * * * *', async () => {
    try {

        let sql = `
            SELECT 
                a.id, 
                a.value, 
                a.unit_id,
                b.id as inventory_id,
                a.status_id as new_status_id
            from inventory_settings as a
            inner join inventory as b on a.unit_id = b.unit_id and b.quantity <= a.value
            where a.active = ?
            and b.status_updated_at is NULL
        `;

        let [results, fields] = await db.execute(sql, [1]);

        if(results.length) {
            results.forEach(async (item) => {
                let udpate_qry = `
                    UPDATE inventory SET status_id = ?, status_updated_at = ?
                    WHERE id = ?
                `;
                let [updated_rows] = await db.execute(udpate_qry, [item.new_status_id, moment().format("YYYY-MM-DD HH:mm:ss"), item.inventory_id])
                console.log(`Update rows: ${updated_rows?.affectedRows ?? 0}`);
            });
        }

    }
    catch (error) {
        console.log(error);
    }
});