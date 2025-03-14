const express = require("express");
const { centralDb } = require("../config/centralDb");
const jwt = require("jsonwebtoken");
const router = express.Router();
const multer = require("multer");
const path = require("path");

// Configure multer storage for menu item images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads/menu-items")); // Create a dedicated folder for menu item images
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      return cb(new Error("Invalid file type. Only image files are allowed."));
    }
  },
});

// Create Category
router.post("/category", async (req, res) => {
  const token = req.cookies.authToken; // Access token from cookie
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode token
    const { name } = req.body;
    const business_id = decoded.businessId;
    const user_id = decoded.userId;

    if (!name || !business_id || !user_id) {
      return res
        .status(400)
        .json({ message: "Name, business_id, and user_id are required." });
    }

    // Check if business exists
    const [business] = await centralDb.query(
      "SELECT id FROM businesses WHERE id = ?",
      [business_id]
    );

    if (business.length === 0) {
      return res.status(400).json({ message: "Business does not exist." });
    }

    // Create the category
    await centralDb.query(
      "INSERT INTO categories (name, business_id, user_id) VALUES (?, ?, ?)",
      [name, business_id, user_id]
    );
    res.status(201).json({ message: "Category created successfully." });
  } catch (err) {
    console.error("Error creating category:", err.message);
    res.status(500).json({ message: "Failed to create category." });
  }
});

// Add Menu Item
router.post("/add", upload.single("image"), async (req, res) => {
  const { name, description, categoryId, ingredients, price } = req.body;
  const image = req.file?.path;
  console.log("req.body:", req.body);
  if (
    !name ||
    !categoryId ||
    !ingredients ||
    ingredients.length === 0 ||
    !price
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const token = req.cookies.authToken; // Access token from cookie
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode token
    const businessId = decoded.businessId;
    const userId = decoded.userId;

    // Insert the menu item into the database
    const [result] = await centralDb.query(
      "INSERT INTO menu_items (name, description, category_id, price, business_id, user_id, image) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, description, categoryId, price, businessId, userId, image]
    );

    const menuItemId = result.insertId; // Get the ID of the newly created menu item

    // Parse the ingredients field
    const parsedIngredients = JSON.parse(ingredients);

    // Insert ingredients for the menu item
    for (const { ingredientId, quantity } of parsedIngredients) {
      await centralDb.query(
        "INSERT INTO menu_item_ingredients (menu_item_id, inventory_id, quantity, business_id, user_id) VALUES (?, ?, ?, ?, ?)",
        [menuItemId, ingredientId, quantity, businessId, userId]
      );
    }

    res.status(201).json({ message: "Menu item created successfully!" });
  } catch (err) {
    console.error("Error adding menu item:", err.message);
    res.status(500).json({ message: "Failed to add menu item." });
  }
});

// Fetch Menu Items
router.get("/", async (req, res) => {
  const token = req.cookies.authToken; // Access token from cookie
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode token
    const businessId = decoded.businessId;

    // Fetch menu items with ingredients for the specific business
    const [menu] = await centralDb.query(
      `
        SELECT 
          mi.menu_item_id, 
          mi.name AS menu_item_name, 
          mi.description, 
          mi.price,
          mi.image, 
          c.name AS category_name, 
          ii.inventory_id AS ingredient_id, 
          i.ingredient_name, 
          ii.quantity
        FROM menu_items mi
        JOIN categories c ON mi.category_id = c.category_id
        LEFT JOIN menu_item_ingredients ii ON mi.menu_item_id = ii.menu_item_id
        LEFT JOIN inventory i ON ii.inventory_id = i.id
        WHERE mi.business_id = ?
      `,
      [businessId]
    );

    // Group the results by menu_item_id to structure the data properly
    const groupedMenu = menu.reduce((acc, item) => {
      const existingMenu = acc.find(
        (m) => m.menu_item_id === item.menu_item_id
      );

      if (existingMenu) {
        existingMenu.ingredients.push({
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          quantity: item.quantity,
        });
      } else {
        acc.push({
          menu_item_id: item.menu_item_id,
          menu_item_name: item.menu_item_name,
          description: item.description,
          category_name: item.category_name,
          price: item.price,
          image: item.image,
          ingredients: item.ingredient_id
            ? [
                {
                  ingredient_id: item.ingredient_id,
                  ingredient_name: item.ingredient_name,
                  quantity: item.quantity,
                },
              ]
            : [],
        });
      }

      return acc;
    }, []);

    res.status(200).json(groupedMenu);
  } catch (err) {
    console.error("Error fetching menu:", err.message);
    res.status(500).json({ message: "Failed to fetch menu." });
  }
});

// Fetch Categories for the business
router.get("/categories", async (req, res) => {
  const token = req.cookies.authToken; // Access token from cookie
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode token
    const business_id = decoded.businessId;

    const [categories] = await centralDb.query(
      "SELECT * FROM categories WHERE business_id = ?",
      [business_id]
    );

    if (categories.length === 0) {
      return res
        .status(404)
        .json({ message: "No categories found for this business." });
    }

    res.status(200).json({ categories });
  } catch (err) {
    console.error("Error fetching categories:", err.message);
    res.status(500).json({ message: "Failed to fetch categories." });
  }
});

// Fetch Inventory Items
router.get("/inventory", async (req, res) => {
  const token = req.cookies.authToken; // Access token from cookie
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Decode token
    const business_id = decoded.businessId;

    const [inventory] = await centralDb.query(
      "SELECT id, name FROM inventory WHERE business_id = ?",
      [business_id]
    );

    if (inventory.length === 0) {
      return res
        .status(404)
        .json({ message: "No inventory items found for this business." });
    }

    res.status(200).json({ inventory });
  } catch (err) {
    console.error("Error fetching inventory:", err.message);
    res.status(500).json({ message: "Failed to fetch inventory." });
  }
});

module.exports = router;
