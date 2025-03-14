const jwt = require("jsonwebtoken");
const { centralDb } = require("../config/centralDb");

const authMiddleware = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // Extract token from 'Authorization' header

  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  try {
    // Decode the token using the secret from environment variables
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure that decoded contains the necessary fields
    if (!decoded.userId || !decoded.businessId) {
      return res
        .status(401)
        .json({ message: "Token is missing required fields" });
    }

    // Optionally, check if the user exists in DB (can be used for further validation)
    const [user] = await centralDb.query(
      "SELECT * FROM users WHERE user_id = ?",
      [decoded.userId]
    );

    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found. Please log in again." });
    }

    // Attach decoded user data to the request object
    req.user = decoded; // This will now contain { userId, businessId }

    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error("Token verification error:", err); // Log the error for debugging
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
