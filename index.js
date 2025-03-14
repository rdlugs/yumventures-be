const express = require("express");
const initializeSuperadminDb = require("./superadmin/config/initSchema");
const tenantRoutes = require("./superadmin/routes/superadminRoutes");
const authRoutes = require("./superadmin/routes/authRoutes");
const dotenv = require("dotenv");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const clientRoutes = require("./client/routes/clientRoutes");
const inventoryRoutes = require("./client/routes/inventoryRoutes");
const menuRoutes = require("./client/routes/menuRoutes");
const posRoutes = require("./client/routes/posRoutes");
const customerRoutes = require("./customer/routes/customerRoutes");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const dashboardRoutes = require("./client/routes/dashboardRoutes");
const browseRoutes = require("./customer/routes/browseRoutes");
dotenv.config();

const app = express();
app.use(express.json());

app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"], // Allow GET for images
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Origin",
      "X-Requested-With",
    ],
  })
);

{
  /*
  app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://trusted-cdn.com"],
        styleSrc: ["'self'", "https://trusted-cdn.com"],
        imgSrc: ["'self'", "data:", "http://localhost:3000"],
      },
    },
  })
);
  */
}

const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use(limiter);
app.use(compression());

app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .send({ message: "Something went wrong! Please try again later." });
});

/*const winston = require("winston");
const logger = winston.createLogger({
    level: "info",
    transports: [
      new winston.transports.Console({ format: winston.format.simple() }),
      new winston.transports.File({ filename: "app.log" }),
    ],
  });
  
  app.use((req, res, next) => {
    logger.info(`Request: ${req.method} ${req.url}`);
    next();
  });
*/
// Initialize the superadmin database and roles
initializeSuperadminDb()
  .then(() => {
    console.log("Superadmin database initialized.");
  })
  .catch((error) => {
    console.error("Failed to initialize superadmin database:", error.message);
    process.exit(1); // Exit if initialization fails
  });

const uploadsDir = path.join(__dirname, "uploads");

// Check if the uploads directory exists, if not, create it
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Uploads directory created.");
}

app.use("/superadmin", tenantRoutes);
app.use("/auth", authRoutes);
app.use("/client", clientRoutes);
app.use("/customer", customerRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/menu", menuRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/browse", browseRoutes);
app.use("/pos", posRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
  });
});
