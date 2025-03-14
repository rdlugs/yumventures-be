const express = require("express");
const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");
const { check, validationResult } = require("express-validator");

const crypto = require("crypto");
//const nodemailer = require("nodemailer");
const { centralDb } = require("../config/centralDb");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads")); // Use path.join for cross-platform compatibility
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Superadmin Onboarding Businesses
router.post(
  "/onboard-business",

  upload.single("documents"),
  async (req, res) => {
    const {
      businessName,
      businessRepresentative,
      businessEmail,
      address,
      contact,
      registrationNumber,
    } = req.body;
    const document = req.file;

    if (
      !businessName ||
      !businessRepresentative ||
      !businessEmail ||
      !address ||
      !contact ||
      !registrationNumber ||
      !document
    ) {
      return res
        .status(400)
        .json({ error: "All fields and a document are required." });
    }

    try {
      // Insert business details
      const [result] = await centralDb.query(
        "INSERT INTO businesses ( name, representative, address, email, contact, registration_number, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          businessName,
          businessRepresentative,
          address,
          businessEmail,
          contact,
          registrationNumber,
          "pending",
        ]
      );

      // Insert business document
      await centralDb.query(
        "INSERT INTO business_documents (business_id, document_type, document_path) VALUES ( ?, ?, ?)",
        [result.insertId, document.mimetype, document.path]
      );

      res.status(201).json({
        message: "Business onboarded successfully.",
      });
    } catch (error) {
      console.error("Error onboarding business:", error.message);
      res.status(500).json({ error: "Failed to onboard business." });
    }
  }
);

// Business Self-Onboarding
router.post("/self-onboard", async (req, res) => {
  const { businessDetails, documents } = req.body;

  if (!businessDetails || !documents) {
    return res
      .status(400)
      .json({ error: "Business details and documents are required." });
  }

  try {
    const [result] = await centralDb.query(
      "INSERT INTO businesses ( name, address, contact, registration_number, status) VALUES ( ?, ?, ?, ?, ?)",
      [
        businessDetails.name,
        businessDetails.address,
        businessDetails.contact,
        businessDetails.registration_number,
        "pending",
      ]
    );

    await centralDb.query(
      "INSERT INTO business_documents (business_id,  document_type, document_path) VALUES ( ?, ?, ?)",
      [result.insertId, documents.type, documents.path]
    );

    res.status(201).json({
      message: "Business details submitted successfully.",
    });
  } catch (error) {
    console.error("Error during self-onboarding:", error.message);
    res.status(500).json({ error: "Failed to submit business details." });
  }
});

router.post(
  "/send-invitation",
  authenticate,
  authorizeRoles("superadmin"), // Only superadmin can send invitations
  async (req, res) => {
    const { businessId, email } = req.body;

    if (!businessId || !email) {
      return res
        .status(400)
        .json({ error: "Business ID and email are required." });
    }

    try {
      // Generate an invitation token (this could be a time-limited token or just a secure string)
      const token = crypto.randomBytes(20).toString("hex");

      // Store the invitation token in the database (optional)
      await centralDb.query(
        "UPDATE businesses SET invitation_token = ? WHERE business_id = ?",
        [token, businessId]
      );

      // Send the invitation link to the email
      //const transporter = nodemailer.createTransport({
      //service: "gmail",
      //auth: {
      //user: process.env.EMAIL_USER,
      //pass: process.env.EMAIL_PASS,
      //},
      //});

      //const mailOptions = {
      //from: process.env.EMAIL_USER,
      //to: email,
      //subject: "Business Account Invitation",
      //text: `Hello, please click the link below to complete your business account registration:\n\n${process.env.CLIENT_URL}/register?token=${token}`,
      //};

      //await transporter.sendMail(mailOptions);

      res.status(200).json({
        message: "Invitation link sent successfully.",
      });
    } catch (error) {
      console.error("Error sending invitation:", error.message);
      res.status(500).json({ error: "Failed to send invitation" });
    }
  }
);

// Route to manually create business accounts after verification
router.post("/create-business-account", async (req, res) => {
  const { businessId, username, password, role } = req.body;

  if (!businessId || !username || !password || !role) {
    return res.status(400).json({
      error: "Business ID, username, password, and role are required.",
    });
  }

  try {
    // Create a new user account with random password or provided credentials
    const hashedPassword = await bcrypt.hash(password, 10);

    await centralDb.query(
      "INSERT INTO users (username, password, role, business_id) VALUES (?, ?, ?, ?)",
      [username, hashedPassword, role, businessId]
    );

    res.status(201).json({
      message: "Business account created successfully.",
    });
  } catch (error) {
    console.error("Error creating business account:", error.message);
    res.status(500).json({ error: "Failed to create business account" });
  }
});

// Route to fetch all businesses (only accessible by superadmin)
router.get("/businesses", async (req, res) => {
  try {
    // Query the central database for all businesses
    const [businesses] = await centralDb.query("SELECT * FROM businesses");

    res.status(200).json({
      businesses, // Return the list of businesses
    });
  } catch (error) {
    console.error("Error fetching businesses:", error.message);
    res.status(500).json({ error: "Failed to fetch businesses" });
  }
});

router.patch("/businesses/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  console.log("Incoming request for business ID:", req.params.id);
  try {
    // Check if business exists
    const [business] = await centralDb.query(
      "SELECT * FROM businesses WHERE id = ?",
      [id]
    );
    if (business.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }

    // Update the business status
    await centralDb.query("UPDATE businesses SET status = ? WHERE id = ?", [
      status,
      id,
    ]);

    res.status(200).json({
      message: "Business status updated successfully.",
    });
  } catch (error) {
    console.error("Error updating business status:", error.message);
    res.status(500).json({ error: "Failed to update business status" });
  }
});

// Route to generate the link for a business
router.post("/generate-link", async (req, res) => {
  const { businessId } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: "Business ID is required." });
  }

  try {
    // Create the link using the frontend URL and token
    const token = jwt.sign({ businessId }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const link = `${process.env.FRONTEND_URL}${process.env.FRONTEND_ROUTE}/${token}`;

    // Check if a link already exists for this business
    const [existingLink] = await centralDb.query(
      "SELECT * FROM generated_links WHERE business_id = ?",
      [businessId]
    );

    if (existingLink.length) {
      // If a link already exists, update the existing link
      await centralDb.query(
        "UPDATE generated_links SET link = ?, purpose = ?, updated_at = NOW() WHERE business_id = ?",
        [link, "account_creation", businessId]
      );

      return res.status(200).json({
        message: "Link updated successfully.",
        link: link, // Return the updated link
      });
    }

    // If no link exists, insert a new link
    await centralDb.query(
      "INSERT INTO generated_links (link, business_id, purpose) VALUES (?, ?, ?)",
      [link, businessId, "account_creation"]
    );

    res.status(201).json({
      message: "Link generated successfully.",
      link: link, // Return the generated link
    });
  } catch (error) {
    console.error("Error generating link:", error.message);
    res.status(500).json({ error: "Failed to generate link." });
  }
});

module.exports = router;
