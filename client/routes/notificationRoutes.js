const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { centralDb } = require("../config/centralDb");

router.post('/update', async (req, res) => {
    
    const { business_id } = req.body;

    try {
        
        let sql = `
            UPDATE notifications 
            SET is_seen = ?
            WHERE business_id = ?
            and is_seen = ?
        `;
        
        centralDb.query(sql, [1, business_id, 0]);

        res.status(201).json({});
    }
    catch (error) {
        console.error("Error during logout:", err.message);
        res.status(500).json({ message: "Failed to update notification." });
    }
});

module.exports = router;