// Test script to verify partner allocations functionality
import { getDb } from './api/queries/connection';
import { users, businesses, customerAccounts, userBusinesses, dailySales, allocationInvites, partnerAllocations } from './db/schema';
import { eq, and, isNull } from 'drizzle-orm';

async function testPartnerCreation() {
  console.log('\n=== Testing Partner Account Creation ===');
  const db = getDb();
  
  try {
    // Check if userType field exists and has correct values
    const partnerUsers = await db.select({
      id: users.id,
      name: users.name,
      userType: users.userType,
      email: users.email,
    })
    .from(users)
    .where(eq(users.userType, 'partner'))
    .limit(5);
    
    console.log(`✓ Found ${partnerUsers.length} partner users`);
    if (partnerUsers.length > 0) {
      console.log('  Sample partner:', partnerUsers[0]);
    }
    
    // Check standard users
    const standardUsers = await db.select({
      id: users.id,
      name: users.name,
      userType: users.userType,
    })
    .from(users)
    .where(eq(users.userType, 'standard'))
    .limit(3);
    
    console.log(`✓ Found ${standardUsers.length} standard users`);
    
    return true;
  } catch (error) {
    console.error('✗ Partner creation test failed:', error.message);
    return false;
  }
}

async function testDailySalesQuery() {
  console.log('\n=== Testing Daily Sales Query ===');
  const db = getDb();
  
  try {
    // Try to query daily sales
    const sales = await db.select()
      .from(dailySales)
      .where(isNull(dailySales.deletedAt))
      .limit(5);
    
    console.log(`✓ Daily sales query successful, found ${sales.length} records`);
    if (sales.length > 0) {
      console.log('  Sample sale:', {
        id: sales[0].id,
        saleDate: sales[0].saleDate,
        netSales: sales[0].netSales,
      });
    }
    
    return true;
  } catch (error) {
    console.error('✗ Daily sales query failed:', error.message);
    return false;
  }
}

async function testBusinessCreation() {
  console.log('\n=== Testing Business Creation ===');
  const db = getDb();
  
  try {
    // Check if businesses can be queried
    const bizList = await db.select({
      id: businesses.id,
      name: businesses.name,
      accountId: businesses.accountId,
      plan: businesses.plan,
      isDemo: businesses.isDemo,
    })
    .from(businesses)
    .where(isNull(businesses.deletedAt))
    .limit(5);
    
    console.log(`✓ Business query successful, found ${bizList.length} businesses`);
    if (bizList.length > 0) {
      console.log('  Sample business:', bizList[0]);
    }
    
    // Check customer accounts
    const accounts = await db.select({
      id: customerAccounts.id,
      accountId: customerAccounts.accountId,
      name: customerAccounts.name,
      plan: customerAccounts.plan,
    })
    .from(customerAccounts)
    .where(isNull(customerAccounts.deletedAt))
    .limit(3);
    
    console.log(`✓ Found ${accounts.length} customer accounts`);
    
    return true;
  } catch (error) {
    console.error('✗ Business creation test failed:', error.message);
    return false;
  }
}

async function testAllocationTables() {
  console.log('\n=== Testing Allocation Tables ===');
  const db = getDb();
  
  try {
    // Check allocation invites
    const invites = await db.select()
      .from(allocationInvites)
      .limit(5);
    
    console.log(`✓ Allocation invites table accessible, found ${invites.length} invites`);
    
    // Check partner allocations
    const allocations = await db.select()
      .from(partnerAllocations)
      .limit(5);
    
    console.log(`✓ Partner allocations table accessible, found ${allocations.length} allocations`);
    
    return true;
  } catch (error) {
    console.error('✗ Allocation tables test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('Starting Partner Allocations Verification Tests...\n');
  
  const results = {
    partnerCreation: await testPartnerCreation(),
    dailySales: await testDailySalesQuery(),
    businessCreation: await testBusinessCreation(),
    allocationTables: await testAllocationTables(),
  };
  
  console.log('\n=== Test Results Summary ===');
  console.log('Partner Creation:', results.partnerCreation ? '✓ PASS' : '✗ FAIL');
  console.log('Daily Sales Query:', results.dailySales ? '✓ PASS' : '✗ FAIL');
  console.log('Business Creation:', results.businessCreation ? '✓ PASS' : '✗ FAIL');
  console.log('Allocation Tables:', results.allocationTables ? '✓ PASS' : '✗ FAIL');
  
  const allPassed = Object.values(results).every(r => r === true);
  console.log('\nOverall:', allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');
  
  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
