const mysql = require("mysql2/promise");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root@localhost:4000/karafuu_cashflow";

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to database.");

  // 1. Businesses table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      address TEXT,
      phone VARCHAR(20),
      email VARCHAR(255),
      plan VARCHAR(50) DEFAULT 'basic',
      isMultiLocation TINYINT(1) DEFAULT 1 NOT NULL,
      isActive TINYINT(1) DEFAULT 1 NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      deletedAt TIMESTAMP NULL
    )
  `);
  console.log("Created businesses table.");

  // 2. User-Business junction
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_businesses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT UNSIGNED NOT NULL,
      businessId INT UNSIGNED NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      isActive TINYINT(1) DEFAULT 1 NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE KEY ub_unique (userId, businessId)
    )
  `);
  console.log("Created user_businesses table.");

  // 3. Add businessId to users
  const [userCols] = await conn.execute("SHOW COLUMNS FROM users");
  if (!userCols.find(c => c.Field === "currentBusinessId")) {
    await conn.execute("ALTER TABLE users ADD COLUMN currentBusinessId INT UNSIGNED");
    console.log("Added currentBusinessId to users.");
  }

  // 4. Add businessId to locations
  const [locCols] = await conn.execute("SHOW COLUMNS FROM locations");
  if (!locCols.find(c => c.Field === "businessId")) {
    await conn.execute("ALTER TABLE locations ADD COLUMN businessId INT UNSIGNED");
    console.log("Added businessId to locations.");
  }

  // 5. Add unpaidAmount and unpaidNotes to daily_sales
  const [dsCols] = await conn.execute("SHOW COLUMNS FROM daily_sales");
  if (!dsCols.find(c => c.Field === "unpaidAmount")) {
    await conn.execute("ALTER TABLE daily_sales ADD COLUMN unpaidAmount DECIMAL(15,2) DEFAULT '0.00' NOT NULL");
    console.log("Added unpaidAmount to daily_sales.");
  }
  if (!dsCols.find(c => c.Field === "unpaidNotes")) {
    await conn.execute("ALTER TABLE daily_sales ADD COLUMN unpaidNotes TEXT");
    console.log("Added unpaidNotes to daily_sales.");
  }

  // 6. Generic attachments table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recordType VARCHAR(50) NOT NULL,
      recordId INT UNSIGNED NOT NULL,
      imageData LONGTEXT NOT NULL,
      mimeType VARCHAR(50) DEFAULT 'image/jpeg',
      caption VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created attachments table.");

  // 7. App settings table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      businessId INT UNSIGNED,
      \`key\` VARCHAR(100) NOT NULL,
      \`value\` TEXT,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created app_settings table.");

  // 8. Feedback questionnaires
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS feedback_questionnaires (
      id INT AUTO_INCREMENT PRIMARY KEY,
      businessId INT UNSIGNED,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      questions JSON NOT NULL,
      isActive TINYINT(1) DEFAULT 1 NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created feedback_questionnaires table.");

  // 9. Feedback responses
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS feedback_responses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      questionnaireId INT UNSIGNED NOT NULL,
      respondentName VARCHAR(255),
      respondentEmail VARCHAR(320),
      answers JSON NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created feedback_responses table.");

  // 10. Business inquiries (landing page registrations)
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS business_inquiries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      businessName VARCHAR(255) NOT NULL,
      contactName VARCHAR(255) NOT NULL,
      email VARCHAR(320) NOT NULL,
      phone VARCHAR(20),
      position VARCHAR(100),
      suggestedPrice DECIMAL(10,2),
      notes TEXT,
      status VARCHAR(20) DEFAULT 'new' NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created business_inquiries table.");

  // 11. Seed default business if none exist
  const [bizRows] = await conn.execute("SELECT COUNT(*) as cnt FROM businesses");
  if (bizRows[0].cnt === 0) {
    const [bizResult] = await conn.execute(
      "INSERT INTO businesses (name, slug, plan, isMultiLocation) VALUES (?, ?, ?, ?)",
      ["Karafuu Restaurant", "karafuu", "basic", 1]
    );
    const businessId = bizResult.insertId;
    console.log(`Seeded default business ID ${businessId}.`);

    // Link all existing users to this business
    const [allUsers] = await conn.execute("SELECT id FROM users");
    for (const u of allUsers) {
      await conn.execute(
        "INSERT INTO user_businesses (userId, businessId, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role=VALUES(role)",
        [u.id, businessId, "admin"]
      );
    }
    console.log(`Linked ${allUsers.length} users to default business.`);

    // Set currentBusinessId on all users
    await conn.execute("UPDATE users SET currentBusinessId = ? WHERE currentBusinessId IS NULL", [businessId]);

    // Link all existing locations to this business
    await conn.execute("UPDATE locations SET businessId = ? WHERE businessId IS NULL", [businessId]);
    console.log("Linked all locations to default business.");
  }

  // 12. Seed default app settings
  const defaultSettings = [
    ["photosDailySales", "true"],
    ["photosExpenses", "true"],
    ["photosBills", "true"],
    ["multiBusiness", "false"],
    ["feedbackEnabled", "false"],
  ];
  for (const [k, v] of defaultSettings) {
    await conn.execute(
      "INSERT IGNORE INTO app_settings (businessId, `key`, `value`) VALUES (NULL, ?, ?)",
      [k, v]
    );
  }
  console.log("Seeded default app settings.");

  await conn.end();
  console.log("Migration v7 completed.");
}

migrate().catch(console.error);
