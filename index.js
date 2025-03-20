const express = require("express");
const http = require('http');

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

const HOST = process.env.APP_HOST || "http://localhost";
const PORT = process.env.APP_PORT || 5000;

const app = express();
const io_server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(io_server, {
  cors: {
    origin: ["http://localhost:5173"], // Allow React frontend
    methods: ["GET", "POST"],
    credentials: true
  }
});


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

app.get('/', (req, res) => {
  res.send('Hello World!');
});

io.on('connection', (socket) => {

  // Example notification: Send a message after 5 seconds
  // setInterval(() => {
    socket.emit('notification', { message: 'This is a notification!' });
  // }, 5000);

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const server = io_server.listen(PORT, () => {
  console.log(`Server running at ${HOST}:${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
  });
});
