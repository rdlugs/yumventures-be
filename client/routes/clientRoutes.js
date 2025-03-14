const express = require("express");
const bcrypt = require("bcryptjs");
const { centralDb } = require("../config/centralDb");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Route to validate the token
router.post("/validate-token", async (req, res) => {
  const token = req.body.token; // Access token

  if (!token) {
    return res
      .status(401)
      .json({ isValid: false, message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);

    // Check if the business exists in the database
    const [businessData] = await centralDb.query(
      "SELECT * FROM businesses WHERE id = ?",
      [decoded.businessId]
    );

    if (!businessData.length) {
      return res
        .status(404)
        .json({ isValid: false, message: "Business not found." });
    }

    res.status(200).json();
  } catch (err) {
    console.error("Error validating token:", err.message);
    res.status(500).json({ isValid: false, message: "Internal server error." });
  }
});

// Route to create a user account for the business
router.post("/create-account", async (req, res) => {
  const { username, password } = req.body;
  const token = req.cookies.authToken;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [existingUser] = await centralDb.query(
      "SELECT * FROM users WHERE username = ? AND business_id = ?",
      [username, decoded.businessId] // Ensure the username is unique within the business
    );

    if (existingUser.length) {
      return res
        .status(409)
        .json({ message: "A user with this username already exists." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user in the users table with "admin" role and reference to the businessId
    await centralDb.query(
      "INSERT INTO users (username, password, role, business_id) VALUES (?, ?, ?, ?)",
      [username, hashedPassword, "admin", decoded.businessId]
    );

    res.status(201).json({
      message: "Account created successfully.",
    });
  } catch (err) {
    console.error("Error creating account:", err.message);
    res.status(500).json({ message: "Failed to create account." });
  }
});

// Route to login the user
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required." });
  }

  try {
    // Check if the user exists in the users table
    const [user] = await centralDb.query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (!user.length) {
      return res.status(404).json({ message: "User not found." });
    }

    // Compare the entered password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user[0].password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate a JWT token for the authenticated user
    const token = jwt.sign(
      {
        userId: user[0].user_id,
        businessId: user[0].business_id, // Include businessId in the token
        role: user[0].role,
      },
      process.env.JWT_SECRET, // JWT secret stored in environment variables
      { expiresIn: "1h" } // Token expiration time
    );

    res.cookie("authToken", token, {
      httpOnly: true, // Makes the cookie inaccessible to JavaScript (helps prevent XSS attacks)
      secure: false, //secure: process.env.NODE_ENV === "production", // Use HTTPS in production
      maxAge: 3600000, // 1 hour expiration (same as your JWT expiration)
      sameSite: "Strict", // CSRF protection
    });
    res.status(200).json({
      message: "Login successful.",
    });
  } catch (err) {
    console.error("Error logging in:", err.message);
    res.status(500).json({ message: "Failed to log in." });
  }
});

// Route to log out the user
router.post("/logout", (req, res) => {
  try {
    // Clear the authToken cookie
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: false, // Use HTTPS in production
      sameSite: "Strict",
    });

    res.status(200).json({ message: "Logout successful." });
  } catch (err) {
    console.error("Error during logout:", err.message);
    res.status(500).json({ message: "Failed to log out." });
  }
});

module.exports = router;
