require("dotenv/config");
const mysql = require("mysql2/promise");
const crypto = require("crypto");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

async function migrate() {
  const connection = await mysql.createConnection(DATABASE_URL);

  console.log("Running auth migration...");

  // 1. Make unionId nullable
  await connection.execute(`
    ALTER TABLE users 
    MODIFY unionId VARCHAR(255) NULL
  `);
  console.log("Made unionId nullable");

  // 2. Add username and passwordHash columns (no constraints in ADD COLUMN for TiDB)
  await connection.execute(`
    ALTER TABLE users 
    ADD COLUMN username VARCHAR(100) NULL,
    ADD COLUMN passwordHash VARCHAR(255) NULL
  `);
  console.log("Added username and passwordHash columns");

  // 3. Add unique index on username
  await connection.execute(`
    CREATE UNIQUE INDEX idx_users_username ON users(username)
  `);
  console.log("Created unique username index");

  // 4. Seed default users if they don't exist
  const defaultUsers = [
    { username: "owner", password: "karafuu2024", name: "Business Owner", role: "owner" },
    { username: "admin", password: "karafuu2024", name: "System Admin", role: "admin" },
    { username: "manager", password: "karafuu2024", name: "General Manager", role: "manager" },
    { username: "cashier", password: "karafuu2024", name: "Front Desk Cashier", role: "employee" },
    { username: "viewer", password: "karafuu2024", name: "View Only User", role: "viewer" },
  ];

  for (const u of defaultUsers) {
    const [existing] = await connection.execute(
      "SELECT id FROM users WHERE username = ?",
      [u.username]
    );
    if (existing.length === 0) {
      const secret = process.env.APP_SECRET || "karafuu-local-auth-secret-key-2024";
      const hash = crypto.createHash("sha256").update(u.password + secret).digest("hex");

      await connection.execute(
        `INSERT INTO users (username, passwordHash, name, role, isActive, createdAt, updatedAt, lastSignInAt) 
         VALUES (?, ?, ?, ?, true, NOW(), NOW(), NOW())`,
        [u.username, hash, u.name, u.role]
      );
      console.log(`Created default user: ${u.username}`);
    } else {
      console.log(`User already exists: ${u.username}`);
    }
  }

  await connection.end();
  console.log("Migration completed successfully!");
}

migrate().catch(function(err) {
  console.error("Migration failed:", err);
  process.exit(1);
});
