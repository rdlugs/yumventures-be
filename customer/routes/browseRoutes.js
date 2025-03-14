const express = require("express");
const bcrypt = require("bcryptjs");
const { centralDb } = require("../config/centralDb");
const jwt = require("jsonwebtoken");

const router = express.Router();

router.get("/categories", async (req, res) => {
  //query
  const [categories] = await centralDb.query("SELECT * FROM categories");

  if (categories.length) {
    return res.status(409).json({ message: "No categories fetched." });
  }

  res.status(200).json(categories);
});

router.get("/menu_items", async (req, res) => {
  const [menuItems] = await centralDb.query("SELECT * FROM menu_items");

  if (menuItems.length) {
    return res.status(200).json({ message: "No menu items fetched." });
  }
  return res.status(200).json(menuItems);
});

module.exports = router;
