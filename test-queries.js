// Diagnostic script to check data visibility
import { getDb } from './api/queries/connection';
import { users, businesses, suppliers, dailySales, locations } from './db/schema';
import { eq, and, isNull } from 'drizzle-orm';

async function checkDataVisibility() {
  console.log('\n=== Checking Data Visibility ===\n');
  const db = getDb();
  
  try {
    // Get a sample user
    const [sampleUser] = await db.select({
      id: users.id,
      name: users.name,
      currentBusinessId: users.currentBusinessId,
      accountRefId: users.accountRefId,
    })
    .from(users)
    .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
    .limit(1);
    
    if (!sampleUser) {
      console.log('❌ No active users found');
      return;
    }
    
    console.log('✓ Sample User:', sampleUser);
    
    // Check their current business
    if (sampleUser.currentBusinessId) {
      const [currentBiz] = await db.select()
        .from(businesses)
        .where(eq(businesses.id, sampleUser.currentBusinessId))
        .limit(1);
      
      console.log('✓ Current Business:', currentBiz ? {
        id: currentBiz.id,
        name: currentBiz.name,
        accountId: currentBiz.accountId,
      } : 'Not found');
      
      if (currentBiz) {
        // Check locations for this business
        const bizLocations = await db.select()
          .from(locations)
          .where(and(
            eq(locations.businessId, currentBiz.id),
            isNull(locations.deletedAt)
          ));
        
        console.log(`✓ Locations for business: ${bizLocations.length}`);
        bizLocations.forEach(loc => {
          console.log(`  - ${loc.name} (ID: ${loc.id})`);
        });
        
        // Check suppliers for this business
        const bizSuppliers = await db.select()
          .from(suppliers)
          .where(and(
            eq(suppliers.businessId, currentBiz.id),
            isNull(suppliers.deletedAt)
          ))
          .limit(5);
        
        console.log(`✓ Suppliers for business: ${bizSuppliers.length}`);
        bizSuppliers.forEach(sup => {
          console.log(`  - ${sup.name} (ID: ${sup.id})`);
        });
        
        // Check daily sales for locations
        if (bizLocations.length > 0) {
          const locationIds = bizLocations.map(l => l.id);
          const sales = await db.select()
            .from(dailySales)
            .where(and(
              isNull(dailySales.deletedAt)
            ))
            .limit(5);
          
          console.log(`✓ Daily sales records (all): ${sales.length}`);
          
          // Check which location IDs the sales belong to
          const salesByLocation = new Map();
          sales.forEach(sale => {
            const count = salesByLocation.get(sale.locationId) || 0;
            salesByLocation.set(sale.locationId, count + 1);
          });
          
          console.log('  Sales by location ID:');
          salesByLocation.forEach((count, locId) => {
            const loc = bizLocations.find(l => l.id === locId);
            console.log(`    Location ${locId}${loc ? ` (${loc.name})` : ' (not in current business)'}: ${count} sales`);
          });
        }
      }
    } else {
      console.log('❌ User has no current business set');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDataVisibility().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
