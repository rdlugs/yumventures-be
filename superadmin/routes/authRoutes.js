const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const { centralDb } = require("../config/centralDb");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");
require("dotenv").config();

const router = express.Router();

// User Registration (superadmin creating employees)
router.post(
  "/register",
  [
    check("username").not().isEmpty().withMessage("Username is required"),
    check("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    check("role")
      .isIn(["superadmin", "manager", "admin"])
      .withMessage("Invalid role"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      // Check if user already exists
      const [existingUser] = await centralDb.query(
        "SELECT * FROM users WHERE username = ?",
        [username]
      );
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Insert new user into the database
      await centralDb.query(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        [username, hashedPassword, role]
      );
      res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
      console.error("Error registering user:", error.message);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Login Route (Superadmin login to generate JWT token)
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user in the database
    const [user] = await centralDb.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (user.length === 0) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    // Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user[0].password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user[0].user_id, role: user[0].role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("Error logging in:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
