require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const cron = require('node-cron');

const { checkAndUpdateInventory, checkInventoryNotif } = require("../jobs/inventory");

// run every 5 seconds (adjust if needed)
cron.schedule('*/5 * * * * *', async () => {
    try {
        await checkAndUpdateInventory();
        await checkInventoryNotif();
    }
    catch (error) {
        console.log(error);
    }
});