const express = require("express");
const { centralDb } = require("../config/centralDb");
const jwt = require("jsonwebtoken"); // Ensure you have jwt imported

const router = express.Router();

// Helper function to get businessId from the request or user table
const getBusinessId = async (req) => {
  // Extract token from cookies
  const token = req.cookies.authToken; // Access token from cookie
  if (!token) {
    throw new Error("No token provided");
  }

  // Verify token and extract user info
  const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify token

  if (!decoded || !decoded.userId) {
    throw new Error("Invalid token or user not found");
  }

  // Use businessId from the decoded token
  return decoded.businessId;
};

// Create a new transaction
router.post("/create-transaction", async (req, res) => {
  const { order, paymentMethod, amountPaid } = req.body;
  const token = req.cookies.authToken; // Access token from cookie
  console.log("Received:", req.body);
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }
  if (!order || order.length === 0) {
    return res.status(400).json({ message: "Order cannot be empty." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode token

    // Step 2: Calculate the transaction totals
    const subtotal = order.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
    const tax = subtotal * 0.1; // Assuming 10% tax
    const total = subtotal + tax - 0;
    const changeAmount = amountPaid - total;
    console.log("Change Amount:", changeAmount);

    // Step 3: Create the transaction record
    const transactionResult = await centralDb.query(
      `
            INSERT INTO transactions (
              subtotal, tax, total, cash_amount, change_amount, payment_method, status,
              transaction_date, business_id, user_id, discount_amount, payment_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)
          `,
      [
        subtotal,
        tax,
        total,
        amountPaid,
        changeAmount,
        paymentMethod,
        "completed",
        decoded.businessId,
        decoded.userId, // Assuming userId is available in req.user
        0,
        "paid",
      ]
    );

    const transactionId = transactionResult[0].insertId;

    // Step 4: Create the order record
    const orderResult = await centralDb.query(
      `
            INSERT INTO orders (
              transaction_id, amount, business_id, user_id, order_date, status, payment_status
            ) VALUES (?, ?, ?, ?, NOW(), ?, ?)
          `,
      [
        transactionId,
        total,
        decoded.businessId,
        decoded.userId,
        "preparing",
        "paid",
      ]
    );

    const orderId = orderResult[0].insertId;

    // Step 5: Insert order items
    for (let item of order) {
      const totalItemPrice = item.price * item.quantity;

      await centralDb.query(
        `
              INSERT INTO order_items (
                order_id, menu_item_id, transaction_id, quantity, price, total
              ) VALUES (?, ?, ?, ?, ?, ?)
            `,
        [
          orderId,
          item.menu_item_id,
          transactionId,
          item.quantity,
          item.price,
          totalItemPrice,
        ]
      );
    }

    // Step 6: Return a success response with transaction details
    res.status(200).json({
      message: "Transaction and order created successfully",
      transactionId,
      orderId,
    });
  } catch (error) {
    console.error("Error processing transaction:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Fetch orders
router.get("/orders", async (req, res) => {
  const token = req.cookies.authToken; // Access token from cookie
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode token

    const ordersQuery = `
      SELECT 
        o.id AS order_id, 
        o.status, 
        o.order_date, 
        o.amount, 
        o.note, 
        oi.menu_item_id, 
        oi.quantity, 
        oi.price, 
        oi.total, 
        mi.name AS menu_item_name
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.menu_item_id
      WHERE o.business_id = ?;
    `;

    const [orders] = await centralDb.query(ordersQuery, [decoded.businessId]);

    // Format the orders data
    const formattedOrders = orders.reduce((acc, order) => {
      const existingOrder = acc.find((o) => o.id === order.order_id);
      if (existingOrder) {
        existingOrder.items.push({
          menu_item_id: order.menu_item_id,
          menu_item_name: order.menu_item_name, // Ensure menu item name is included
          quantity: order.quantity,
          price: order.price,
          total: order.total,
        });
      } else {
        acc.push({
          id: order.order_id,
          status: order.status,
          orderDate: order.order_date,
          amount: order.amount,
          note: order.note,
          items: [
            {
              menu_item_id: order.menu_item_id,
              menu_item_name: order.menu_item_name,
              quantity: order.quantity,
              price: order.price,
              total: order.total,
            },
          ],
        });
      }
      return acc;
    }, []);

    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update order status
router.patch("/orders/:orderId/status", async (req, res) => {
  const token = req.cookies.authToken; // Access token from cookie
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode token
    const { status } = req.body;

    const [result] = await centralDb.query(
      "UPDATE orders SET status = ? WHERE id = ? AND business_id = ?",
      [status, orderId, decoded.businessId]
    );

    if (result.affectedRows > 0) {
      res.status(200).json({ message: "Order status updated" });
    } else {
      res.status(404).json({ message: "Order not found" });
    }
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
