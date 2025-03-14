const jwt = require("jsonwebtoken");
require("dotenv").config();

// Middleware to verify the JWT token and check user roles
const authenticate = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(403).json({ error: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Failed to authenticate token" });
    }
    req.user = decoded;
    next();
  });
};

// Middleware to check if the user has the required role
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not have the required role" });
    }
    next();
  };
};

module.exports = { authenticate, authorizeRoles };
