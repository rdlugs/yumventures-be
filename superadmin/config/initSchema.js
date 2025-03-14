const mysql = require("mysql2/promise");
require("dotenv").config();
const bcrypt = require("bcryptjs");

async function initializeSuperadminDb() {
  const pool = mysql.createPool({
    host: process.env.CENTRAL_DB_HOST,
    user: process.env.CENTRAL_DB_USER,
    password: process.env.CENTRAL_DB_PASSWORD,
    database: process.env.CENTRAL_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    //await connection.query(`DROP DATABASE IF EXISTS ${process.env.CENTRAL_DB_NAME}`);
    // 1. Create Central Database if it doesn't exist
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${process.env.CENTRAL_DB_NAME}`
    );
    await connection.changeUser({ database: process.env.CENTRAL_DB_NAME });

    //await connection.query("DROP TABLE IF EXISTS inventory;");
    //await connection.query("DROP TABLE IF EXISTS roles;");
    //await connection.query("DROP TABLE IF EXISTS business_documents;");
    //await connection.query("DROP TABLE IF EXISTS generated_links;");
    //await connection.query("DROP TABLE IF EXISTS users;");
    //await connection.query("DROP TABLE IF EXISTS businesses;");
    //await connection.query("DROP TABLE IF EXISTS categories;");
    //await connection.query("DROP TABLE IF EXISTS menu_items;");
    //await connection.query("DROP TABLE IF EXISTS menu_item_ingredients;");

    // 3. Create the businesses table
    const createBusinessesTableQuery = `
      CREATE TABLE IF NOT EXISTS businesses (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(255),
        contact VARCHAR(255),
        registration_number VARCHAR(255),
        status VARCHAR(255),
        verification_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `;
    await connection.query(createBusinessesTableQuery);

    // 4. Create the business_documents table
    const createBusinessDocumentsTableQuery = `
      CREATE TABLE IF NOT EXISTS business_documents (
        document_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        business_id INT UNSIGNED NOT NULL,
        document_type VARCHAR(255) NOT NULL,
        document_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `;
    await connection.query(createBusinessDocumentsTableQuery);

    // 5. Create the generated_links table
    const createGeneratedLinksTableQuery = `
      CREATE TABLE IF NOT EXISTS generated_links (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        link VARCHAR(255) NOT NULL,
        business_id INT UNSIGNED NOT NULL,
        purpose VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `;
    await connection.query(createGeneratedLinksTableQuery);

    // 6. Create the users table
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        business_id INT UNSIGNED,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `;
    await connection.query(createUsersTableQuery);

    // 5. Create the inventory table
    const createInventoryTableQuery = `
     CREATE TABLE IF NOT EXISTS inventory (
       id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       ingredient_name VARCHAR(255) NOT NULL,
       category VARCHAR(255) NOT NULL,
       quantity DECIMAL(10, 2) NOT NULL,
       unit VARCHAR(50) NOT NULL,
       cost DECIMAL(10, 2) NOT NULL,
       location VARCHAR(50) NOT NULL,
       batch_number VARCHAR(50) NOT NULL,
       user_id INT UNSIGNED NOT NULL,
       business_id INT UNSIGNED NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
       FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
     ) ENGINE=InnoDB;
   `;
    await connection.query(createInventoryTableQuery);

    // 6. Create the categories table
    const createCategoriesQuery = `
      CREATE TABLE IF NOT EXISTS categories (
        category_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        business_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `;
    await connection.query(createCategoriesQuery);

    const createMenuItemsQuery = `
  CREATE TABLE IF NOT EXISTS menu_items (
    menu_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT UNSIGNED,    -- Category reference
    business_id INT UNSIGNED NOT NULL,  -- Business reference
    user_id INT UNSIGNED NOT NULL,  -- User reference
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  ) ENGINE=InnoDB;
`;
    await connection.query(createMenuItemsQuery);

    // 8. Create the menu_item_ingredients table
    const createMenuItemIngredientsQuery = `
    CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id INT UNSIGNED NOT NULL,        -- Foreign key referencing menu_items
  inventory_id INT UNSIGNED NOT NULL,        -- Foreign key referencing inventory
  quantity DECIMAL(10, 2) NOT NULL,          -- Quantity of ingredient
  business_id INT UNSIGNED NOT NULL,        -- Foreign key referencing businesses
  user_id INT UNSIGNED NOT NULL,            -- The user who created the entry
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB;
   `;
    await connection.query(createMenuItemIngredientsQuery);

    const createTransactionsTableQuery = `
    CREATE TABLE IF NOT EXISTS transactions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    cash_amount DECIMAL(10, 2) NOT NULL,
    change_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    transaction_date DATETIME NOT NULL,
    business_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    discount_amount DECIMAL(10, 2),
    payment_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
    `;
    await connection.query(createTransactionsTableQuery);

    const createOrdersTableQuery = `
    CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT UNSIGNED NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    business_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    order_date DATETIME NOT NULL,
    status VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50),
    note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
     FOREIGN KEY (business_id) REFERENCES businesses(id),
     FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;
    `;

    await connection.query(createOrdersTableQuery);

    const createOrderItemsTableQuery = `
    CREATE TABLE IF NOT EXISTS order_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,  -- Link to the orders table
    menu_item_id INT UNSIGNED NOT NULL,           -- Foreign Key to the Menu Items table
    transaction_id INT UNSIGNED NOT NULL,  -- Link to the transactions table
    quantity INT NOT NULL,      -- Quantity of this item
    price DECIMAL(10, 2) NOT NULL, -- Price per item
    total DECIMAL(10, 2) NOT NULL, -- Total price (price * quantity)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id),  -- Foreign Key to the Menu Items table
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
) ENGINE=InnoDB;
    `;

    await connection.query(createOrderItemsTableQuery);

    // 7. Insert default superadmin role and account
    const [users] = await connection.query(
      "SELECT * FROM users WHERE username = ?",
      [process.env.SUPERADMIN_USER]
    );
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash(
        process.env.SUPERADMIN_PASSWORD,
        10
      );

      await connection.query(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        [process.env.SUPERADMIN_USER, hashedPassword, "superadmin"]
      );
      console.log("Superadmin account created.");
    } else {
      console.log("Superadmin account already exists.");
    }
    await connection.commit();

    console.log("Schema initialization completed.");
  } catch (error) {
    await connection.rollback();
    console.error("Error initializing database:", error.message);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = initializeSuperadminDb;
