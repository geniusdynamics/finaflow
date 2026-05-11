// Check demo business data
import { getDb } from './api/queries/connection';
import { users, businesses, suppliers, dailySales, locations } from './db/schema';
import { eq, and, isNull } from 'drizzle-orm';

async function checkDemoData() {
  console.log('\n=== Checking Demo Business Data ===\n');
  const db = getDb();
  
  try {
    // Find demo business
    const [demoBiz] = await db.select()
      .from(businesses)
      .where(and(eq(businesses.isDemo, true), isNull(businesses.deletedAt)))
      .limit(1);
    
    if (!demoBiz) {
      console.log('❌ No demo business found');
      return;
    }
    
    console.log('✓ Demo Business:', {
      id: demoBiz.id,
      name: demoBiz.name,
      accountId: demoBiz.accountId,
    });
    
    // Check locations
    const demoLocations = await db.select()
      .from(locations)
      .where(and(
        eq(locations.businessId, demoBiz.id),
        isNull(locations.deletedAt)
      ));
    
    console.log(`✓ Demo Locations: ${demoLocations.length}`);
    demoLocations.forEach(loc => {
      console.log(`  - ${loc.name} (ID: ${loc.id})`);
    });
    
    // Check suppliers
    const demoSuppliers = await db.select()
      .from(suppliers)
      .where(and(
        eq(suppliers.businessId, demoBiz.id),
        isNull(suppliers.deletedAt)
      ))
      .limit(10);
    
    console.log(`✓ Demo Suppliers: ${demoSuppliers.length}`);
    demoSuppliers.slice(0, 5).forEach(sup => {
      console.log(`  - ${sup.name}`);
    });
    
    // Check daily sales for demo locations
    if (demoLocations.length > 0) {
      const locationIds = demoLocations.map(l => l.id);
      
      // Count sales per location
      for (const loc of demoLocations) {
        const sales = await db.select()
          .from(dailySales)
          .where(and(
            eq(dailySales.locationId, loc.id),
            isNull(dailySales.deletedAt)
          ))
          .limit(5);
        
        console.log(`✓ Daily sales for ${loc.name}: ${sales.length}`);
        if (sales.length > 0) {
          console.log(`  Sample: ${sales[0].saleDate} - ${sales[0].netSales}`);
        }
      }
    }
    
    // Find a user with demo business access
    const demoUsers = await db.select({
      id: users.id,
      name: users.name,
      currentBusinessId: users.currentBusinessId,
    })
    .from(users)
    .where(and(
      eq(users.currentBusinessId, demoBiz.id),
      eq(users.isActive, true),
      isNull(users.deletedAt)
    ))
    .limit(3);
    
    console.log(`\n✓ Users with demo business access: ${demoUsers.length}`);
    demoUsers.forEach(u => {
      console.log(`  - ${u.name} (ID: ${u.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDemoData().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
