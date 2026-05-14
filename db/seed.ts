import { getDb } from "../api/queries/connection";
import {
  locations,
  accounts,
  expenseCategories,
  suppliers,
  users,
} from "./schema";

async function seed() {
  const db = getDb();

  console.log("Seeding database...");

  // Create locations
  const locResult = await db.insert(locations).values([
    { name: "Corner (Kena)", slug: "corner-kena", address: "Ukunda, Diani", isActive: true },
    { name: "Golden (Diani)", slug: "golden-diani", address: "Diani Beach", isActive: true },
  ]);

  const cornerId = Number(locResult[0].insertId);
  const goldenId = cornerId + 1;

  console.log(`Created locations: ${cornerId}, ${goldenId}`);

  // Create default accounts for each location
  await db.insert(accounts).values([
    // Corner accounts
    { locationId: cornerId, name: "Cash Drawer", type: "cash", accountCode: "CASH", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    { locationId: cornerId, name: "M-PESA Till", type: "mpesa", accountCode: "MPESA", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    { locationId: cornerId, name: "KCB Bank", type: "bank_account", accountCode: "KCB", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    { locationId: cornerId, name: "Equity Bank", type: "bank_account", accountCode: "EQUITY", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    { locationId: cornerId, name: "Family Bank", type: "bank_account", accountCode: "FAMILY", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    { locationId: cornerId, name: "COOP Bank", type: "bank_account", accountCode: "COOP", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    // Golden accounts
    { locationId: goldenId, name: "Cash Drawer", type: "cash", accountCode: "CASH", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    { locationId: goldenId, name: "M-PESA Till", type: "mpesa", accountCode: "MPESA", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    { locationId: goldenId, name: "KCB Bank", type: "bank_account", accountCode: "KCB", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    { locationId: goldenId, name: "Equity Bank", type: "bank_account", accountCode: "EQUITY", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    { locationId: goldenId, name: "Family Bank", type: "bank_account", accountCode: "FAMILY", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
    { locationId: goldenId, name: "COOP Bank", type: "bank_account", accountCode: "COOP", openingBalance: "0.00", currentBalance: "0.00", isPaymentMethod: true, isActive: true },
  ]);

  console.log("Created accounts");

  // Create expense categories
  await db.insert(expenseCategories).values([
    { name: "Food Supplies", description: "Ingredients and raw materials", color: "#C73E1D" },
    { name: "Beverages", description: "Drinks and beverages stock", color: "#D4A854" },
    { name: "Utilities", description: "Electricity, water, internet", color: "#2D7D46" },
    { name: "Rent", description: "Property lease payments", color: "#4A5568" },
    { name: "Salaries & Wages", description: "Staff payroll", color: "#3182CE" },
    { name: "Marketing", description: "Advertising and promotions", color: "#805AD5" },
    { name: "Maintenance & Repairs", description: "Equipment fixes", color: "#DD6B20" },
    { name: "Transport & Delivery", description: "Logistics costs", color: "#38B2AC" },
    { name: "Licenses & Permits", description: "County health permits", color: "#718096" },
    { name: "Fuel", description: "Petrol and diesel", color: "#E53E3E" },
    { name: "Airtime/Data", description: "Mobile communication", color: "#319795" },
    { name: "Miscellaneous", description: "Uncategorized expenses", color: "#A0AEC0" },
  ]);

  console.log("Created expense categories");

  // Create suppliers
  await db.insert(suppliers).values([
    { name: "NAIVAS UKUNDA DIANI", phone: "+254700000001", businessId: 1, paymentTermsDays: 7, notes: "Supermarket supplier" },
    { name: "CARREFOUR DIANI", phone: "+254700000002", businessId: 1, paymentTermsDays: 14, notes: "Retail supplier" },
    { name: "GRAND PETROLEUM STATION", phone: "+254700000003", businessId: 1, paymentTermsDays: 0, notes: "Fuel station" },
    { name: "PUREJOY SHELL DIANI", phone: "+254700000004", businessId: 1, paymentTermsDays: 0, notes: "Fuel station" },
    { name: "KPLC Prepaid", phone: "+254700000005", businessId: 1, paymentTermsDays: 0, notes: "Electricity utility" },
    { name: "Safaricom Data Bundles", phone: "+254700000006", businessId: 1, paymentTermsDays: 0, notes: "Airtime & data" },
    { name: "SPIRO EV", phone: "+254700000007", businessId: 1, paymentTermsDays: 0, notes: "EV charging / fuel" },
    { name: "BASHIR ABDULLAHI OMAR", phone: "+254700000008", businessId: 1, paymentTermsDays: 0, notes: "Individual supplier" },
    { name: "samrat diani", phone: "+254700000009", businessId: 1, paymentTermsDays: 0, notes: "Individual supplier" },
    { name: "Co-operative Bank", phone: "+254700000010", businessId: 1, paymentTermsDays: 0, notes: "Bank transfers" },
    { name: "Equity Bank", phone: "+254700000011", businessId: 1, paymentTermsDays: 0, notes: "Bank transfers" },
    { name: "KCB Bank", phone: "+254700000012", businessId: 1, paymentTermsDays: 0, notes: "Bank transfers" },
    { name: "Family Bank", phone: "+254700000013", businessId: 1, paymentTermsDays: 0, notes: "Bank transfers" },
    { name: "National Bank of Kenya", phone: "+254700000014", businessId: 1, paymentTermsDays: 0, notes: "Bank transfers" },
    { name: "LELA BOOKS AND STATIONERY", phone: "+254700000015", businessId: 1, paymentTermsDays: 0, notes: "Stationery supplier" },
  ]);

  console.log("Created suppliers");

  console.log("Seed completed successfully!");
}

seed().catch(console.error);
