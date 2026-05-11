import pg from "pg";
const pool = new pg.Pool({
  connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/finaflow",
});

try {
  // Check the last orphan user
  const orphan = await pool.query(
    `SELECT u.* FROM users u WHERE u.id = 54`
  );
  console.log("User id=54:", JSON.stringify(orphan.rows[0], null, 2));

  // Check their user_businesses links
  const links = await pool.query(
    `SELECT * FROM user_businesses WHERE "userId" = 54`
  );
  console.log("\nUser 54 links:", JSON.stringify(links.rows, null, 2));

  // Mark as deleted since they have no business link
  if (links.rows.length === 0) {
    console.log("\nUser 54 has no business links - marking as deleted");
    await pool.query(
      `UPDATE users SET "deletedAt" = NOW(), "isActive" = false WHERE id = 54`
    );
    console.log("  Marked as deleted");
  }

  // Final verification
  const remaining = await pool.query(
    `SELECT COUNT(*) AS c FROM users WHERE "accountRefId" IS NULL AND "deletedAt" IS NULL`
  );
  console.log(`\nFinal: users still missing accountRefId: ${remaining.rows[0].c}`);

  // Show all users with their accountRefId
  const all = await pool.query(
    `SELECT id, username, role, "accountId", "accountRefId", "deletedAt" IS NOT NULL AS deleted FROM users ORDER BY id`
  );
  console.log("\nAll users:");
  for (const r of all.rows) {
    console.log(`  id=${r.id} ${r.username} role=${r.role} accountId=${r.accountId} accountRefId=${r.accountRefId} deleted=${r.deleted}`);
  }
} catch (e) {
  console.error("Error:", e.message);
}
await pool.end();
