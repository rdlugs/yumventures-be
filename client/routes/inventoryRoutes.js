const express = require("express");
const { centralDb } = require("../config/centralDb");
const authMiddleware = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");
const { status } = require("express/lib/response");
const router = express.Router();

const inventory_status = {
  in_stock: 1,
  low_stock: 2,
  out_of_stock: 3
}


// Get Inventory
router.get("/", async (req, res) => {
  const token = req.cookies.authToken;

  if (!token) {
    return res
      .status(401)
      .json({ isValid: false, message: "No token provided." });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Get the businessId either from the JWT token or from the users table
    const businessId = decoded.businessId;
    // Fetch inventory for the specific business
    // Make sure to use business_id instead of user_id
    const [inventory] = await centralDb.query(
      `SELECT a.*, b.name as inventory_name, b.description as inventory_status
      FROM inventory as a
      LEFT JOIN inventory_status as b ON a.status_id = b.id
      WHERE business_id = ? `, 
      [businessId]
    );

    res.status(200).json(inventory);
  } catch (err) {
    console.error("Error fetching inventory:", err.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Add to Inventory
router.post("/", async (req, res) => {
  const {
    ingredientName,
    quantity,
    unit,
    category,
    cost,
    location,
    expirationDate,
  } = req.body;

  const token = req.cookies.authToken;
  if (!token) {
    return res
      .status(401)
      .json({ isValid: false, message: "No token provided." });
  }

  if (
    !ingredientName ||
    !quantity ||
    !unit ||
    !category ||
    !cost ||
    !location
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Get the businessId from the JWT token
    const businessId = decoded.businessId;

    // Fetch the user associated with the business
    const [user] = await centralDb.query(
      "SELECT * FROM users WHERE business_id = ?",
      [businessId]
    );
    if (!user.length) {
      return res
        .status(400)
        .json({ message: "No users found for this business." });
    }

    const userId = user[0].user_id; // Use the first user associated with the business

    // Generate a unique batch number using current timestamp and random number
    const batchNumber = `BN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Determine stock status based on quantity
    const status_id = quantity > 0 ? inventory_status.in_stock : inventory_status.out_of_stock;

    // Add item to inventory for the specific business
    await centralDb.query(
      "INSERT INTO inventory (business_id, user_id, ingredient_name, category, quantity, unit, cost, location, batch_number, expiration_date, status_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        businessId,
        userId,
        ingredientName,
        category,
        quantity,
        unit,
        cost,
        location,
        batchNumber,
        expirationDate
          ? new Date(expirationDate)
              .toISOString()
              .slice(0, 19)
              .replace("T", " ")
          : null,
          status_id,
      ]
    );

    res.status(201).json({ message: "Ingredient added successfully!" });
  } catch (err) {
    console.error("Error adding to inventory:", err.message);

    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        message:
          "Cannot add inventory: Business does not exist. Please check businessId.",
      });
    }

    res.status(500).json({ message: "Failed to add ingredient." });
  }
});

module.exports = router;
