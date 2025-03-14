const express = require("express");
const { centralDb } = require("../config/centralDb");
const jwt = require("jsonwebtoken");
const router = express.Router();

router.get("/", async (req, res) => {
  const token = req.cookies.authToken;

  if (!token) {
    return res
      .status(401)
      .json({ isValid: false, message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const businessId = decoded.businessId;

    // Fetch total sales for today
    const [totalSalesResult] = await centralDb.query(
      `
        SELECT SUM(total) AS total_sales_today
        FROM transactions
        WHERE business_id = ? AND DATE(created_at) = CURDATE()
        `,
      [businessId]
    );
    const totalSalesToday = totalSalesResult[0]?.total_sales_today || 0;

    // Fetch average order value
    const [avgOrderValueResult] = await centralDb.query(
      `
        SELECT AVG(total) AS average_order_value
        FROM transactions
        WHERE business_id = ? AND DATE(created_at) = CURDATE()
        `,
      [businessId]
    );
    const averageOrderValue = avgOrderValueResult[0]?.average_order_value || 0;

    // Fetch top-selling item
    const [topSellingItemResult] = await centralDb.query(
      `
        SELECT mi.name, SUM(od.quantity) AS total_quantity
        FROM order_items od
        JOIN menu_items mi ON od.menu_item_id = mi.menu_item_id
        WHERE mi.business_id = ?
        GROUP BY mi.menu_item_id
        ORDER BY total_quantity DESC
        LIMIT 1
        `,
      [businessId]
    );
    const topSellingItem = topSellingItemResult[0]?.name || "No data";

    // Fetch latest added item
    const [latestAddedItemResult] = await centralDb.query(
      `
        SELECT name, created_at
        FROM menu_items
        WHERE business_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        `,
      [businessId]
    );
    const latestAddedItem =
      latestAddedItemResult[0]?.name || "No items have been added yet";

    // Fetch transactions
    const [transactionsResult] = await centralDb.query(
      `
        SELECT id, id, cash_amount, created_at, status
        FROM transactions
        WHERE business_id = ?
        ORDER BY created_at DESC
        LIMIT 10
        `,
      [businessId]
    );
    const transactions = transactionsResult || [];

    // Return response
    res.status(200).json({
      totalSalesToday,
      averageOrderValue,
      topSellingItem,
      latestAddedItem,
      transactions,
    });
  } catch (err) {
    console.error("Error fetching data:", err.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
