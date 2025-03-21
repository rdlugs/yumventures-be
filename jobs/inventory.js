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

const getExpiredItems = async () => {
    try {

        let sql = `
            SELECT * FROM inventory
            WHERE expiration_date <= ?
            AND is_expired = ?
        `;
        let [results] = await db.execute(sql, [moment().format("YYYY-MM-DD HH:mm:ss"), 0]);

        return results;

    } catch (error) {
        console.error("Error check inventory expiration:", error);
    }
}

const checkAndUpdateInventory = async () => {
    try {
        let sql = `
            SELECT 
                a.unit_id,
                b.id as inventory_id,
                b.business_id,
                MAX(a.status_id) as new_status_id 
            FROM inventory_settings AS a
            INNER JOIN inventory AS b ON a.unit_id = b.unit_id AND b.quantity <= a.value
            WHERE a.active = 1
            AND b.status_updated_at IS NULL
            GROUP BY a.unit_id, b.id, b.business_id
        `;

        let [results] = await db.execute(sql);

        if (results.length) {
            for (const item of results) {
                let updateQuery = `
                    UPDATE inventory 
                    SET status_id = ?, status_updated_at = ? 
                    WHERE id = ?
                `;

                let [updatedRows] = await db.execute(updateQuery, [
                    item.new_status_id, 
                    moment().format("YYYY-MM-DD HH:mm:ss"), 
                    item.inventory_id
                ]);

                let add_notif = `
                    INSERT INTO notifications(business_id,data)
                    VALUES(?,?)
                `
                await db.execute(add_notif, [item.business_id, JSON.stringify({
                    title: 'Item Status',
                    code: 'item_status',
                    data: item
                })]);
                
                console.log(`Updated rows: ${updatedRows?.affectedRows ?? 0}`);
            }
        }
    } catch (error) {
        console.error("Error updating inventory:", error);
    }
};

const checkInventoryNotif = async () => {
    const expiredItems = await getExpiredItems();
    
    if(expiredItems.length) {
        
        console.log(`Expired Points: ${expiredItems.length}`);

        let ids = expiredItems.map(item => `'${item.id}'`).join(',')

        let update_expired_items = `
            UPDATE inventory
            SET is_expired = ?
            WHERE id IN(${ids})
        `
        await db.execute(update_expired_items, [1]);
        
        for (const item of expiredItems) {
            let add_notif = `
                INSERT INTO notifications(business_id, data)
                VALUES (?, ?)
            `
            db.execute(add_notif, [item.business_id, JSON.stringify({ 
                title: 'Expired Points',
                code: 'expired_points',
                data: item  
            })]);
        }
    }
}

module.exports = { checkAndUpdateInventory, checkInventoryNotif };
