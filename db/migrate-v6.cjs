const mysql = require("mysql2/promise");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root@localhost:4000/karafuu_cashflow";

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database.");

  // 1. Ensure expense_categories has all needed columns
  try {
    const [cols] = await conn.execute("SHOW COLUMNS FROM expense_categories");
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes("isActive")) {
      await conn.execute("ALTER TABLE expense_categories ADD COLUMN isActive BOOLEAN DEFAULT TRUE NOT NULL");
      console.log("Added isActive to expense_categories");
    }
    if (!colNames.includes("deletedAt")) {
      await conn.execute("ALTER TABLE expense_categories ADD COLUMN deletedAt TIMESTAMP NULL");
      console.log("Added deletedAt to expense_categories");
    }
    if (!colNames.includes("color")) {
      await conn.execute("ALTER TABLE expense_categories ADD COLUMN color VARCHAR(20) DEFAULT '#C73E1D'");
      console.log("Added color to expense_categories");
    }
    if (!colNames.includes("description")) {
      await conn.execute("ALTER TABLE expense_categories ADD COLUMN description TEXT");
      console.log("Added description to expense_categories");
    }
    if (!colNames.includes("updatedAt")) {
      await conn.execute("ALTER TABLE expense_categories ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL");
      console.log("Added updatedAt to expense_categories");
    }
    console.log("expense_categories columns verified.");
  } catch (e) {
    console.log("expense_categories check error:", e.message);
  }

  // 2. Seed default categories if table is empty
  try {
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM expense_categories");
    if (rows[0].cnt === 0) {
      const defaults = [
        ["Food Supplies", "Ingredients and raw materials", "#C73E1D"],
        ["Beverages", "Drinks and beverages stock", "#D4A854"],
        ["Utilities", "Electricity, water, internet", "#2D7D46"],
        ["Rent", "Property lease payments", "#4A5568"],
        ["Salaries & Wages", "Staff payroll", "#3182CE"],
        ["Marketing", "Advertising and promotions", "#805AD5"],
        ["Maintenance & Repairs", "Equipment fixes", "#DD6B20"],
        ["Transport & Delivery", "Logistics costs", "#38B2AC"],
        ["Licenses & Permits", "County health permits", "#718096"],
        ["Fuel", "Petrol and diesel", "#E53E3E"],
        ["Airtime/Data", "Mobile communication", "#319795"],
        ["Miscellaneous", "Uncategorized expenses", "#A0AEC0"],
      ];
      for (const [name, description, color] of defaults) {
        await conn.execute(
          "INSERT INTO expense_categories (name, description, color, isActive) VALUES (?, ?, ?, TRUE)",
          [name, description, color]
        );
      }
      console.log("Seeded 12 default expense categories.");
    } else {
      console.log(`expense_categories already has ${rows[0].cnt} rows. Skipping seed.`);
    }
  } catch (e) {
    console.log("Seed error:", e.message);
  }

  await conn.end();
  console.log("Migration v6 completed.");
}

migrate().catch(console.error);
