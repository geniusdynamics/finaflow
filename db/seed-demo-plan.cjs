// ABOUTME: Builds deterministic demo reporting rows for the demo seed script.
// ABOUTME: Keeps the demo transactional data plan testable outside the database write path.
const CATEGORY_KEYS = ["food", "utilities", "salaries", "rent", "supplies", "marketing"];

function asUtcDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function toMonthWindow(anchorDate) {
  const base = asUtcDate(anchorDate);

  return [2, 1, 0].map((offset) => {
    const monthDate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - offset, 1));

    return {
      year: monthDate.getUTCFullYear(),
      month: monthDate.getUTCMonth() + 1,
    };
  });
}

function toIsoDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function asAmount(value) {
  return value.toFixed(2);
}

function categoryBaseBudget(categoryKey) {
  return {
    food: 64000,
    utilities: 18500,
    salaries: 72000,
    rent: 58000,
    supplies: 22000,
    marketing: 16000,
  }[categoryKey];
}

function buildBudgets(reportingMonths, input) {
  return reportingMonths.flatMap((month, monthIndex) =>
    CATEGORY_KEYS.map((categoryKey) => ({
      locationId: input.locationIds.main,
      categoryId: input.categoryIds[categoryKey],
      month: month.month,
      year: month.year,
      amount: asAmount(categoryBaseBudget(categoryKey) + monthIndex * 1750),
      notes: `Demo ${categoryKey} budget for ${month.year}-${String(month.month).padStart(2, "0")}`,
    })),
  );
}

function buildSales(reportingMonths, input) {
  const locationTemplates = [
    { key: "main", locationId: input.locationIds.main, multiplier: 1 },
    { key: "secondary", locationId: input.locationIds.secondary, multiplier: 0.72 },
  ];

  const sales = [];
  const salePayments = [];

  reportingMonths.forEach((month, monthIndex) => {
    locationTemplates.forEach((location, locationIndex) => {
      [4, 11, 18, 25].forEach((day, dayIndex) => {
        const grossBase = (18500 + monthIndex * 2400 + dayIndex * 950 + locationIndex * 1300) * location.multiplier;
        const discountAmount = 450 + dayIndex * 70 + locationIndex * 40;
        const voidAmount = 180 + dayIndex * 25;
        const netSales = grossBase - discountAmount - voidAmount;
        const cashTotal = netSales * 0.41;
        const mpesaTotal = netSales * 0.37;
        const cardTotal = netSales - cashTotal - mpesaTotal;
        const saleKey = `${location.key}-${month.year}-${month.month}-${day}`;

        sales.push({
          saleKey,
          locationId: location.locationId,
          saleDate: toIsoDate(month.year, month.month, day),
          cashTotal: asAmount(cashTotal),
          cardTotal: asAmount(cardTotal),
          mpesaTotal: asAmount(mpesaTotal),
          familyBankTotal: "0.00",
          coopBankTotal: "0.00",
          equityBankTotal: "0.00",
          boltTotal: "0.00",
          glovoTotal: "0.00",
          creditCardTotal: "0.00",
          deliveryPartnerTotal: "0.00",
          netSales: asAmount(netSales),
          discountAmount: asAmount(discountAmount),
          voidAmount: asAmount(voidAmount),
          unpaidAmount: "0.00",
          ticketCount: 54 + monthIndex * 7 + dayIndex * 5 + locationIndex * 3,
          orderCount: 61 + monthIndex * 8 + dayIndex * 6 + locationIndex * 2,
          voidCount: 1 + (dayIndex % 2),
          giftCount: dayIndex % 3 === 0 ? 1 : 0,
          notes: `Demo sales for ${location.key} branch`,
          unpaidNotes: null,
          enteredBy: input.enteredBy,
        });

        salePayments.push(
          {
            saleKey,
            paymentMethodId: input.paymentMethodIds.cash,
            amount: asAmount(cashTotal),
          },
          {
            saleKey,
            paymentMethodId: input.paymentMethodIds.mpesa,
            amount: asAmount(mpesaTotal),
          },
          {
            saleKey,
            paymentMethodId: input.paymentMethodIds.card,
            amount: asAmount(cardTotal),
          },
        );
      });
    });
  });

  return { sales, salePayments };
}

function buildExpenses(reportingMonths, input) {
  const monthlyTemplates = [
    { categoryKey: "rent", amount: 56000, paymentMethod: "bank_transfer", supplierId: input.supplierIds.landlord, description: "Main branch rent" },
    { categoryKey: "utilities", amount: 17400, paymentMethod: "mpesa", supplierId: input.supplierIds.utilities, description: "Electricity and water" },
    { categoryKey: "salaries", amount: 70200, paymentMethod: "bank_transfer", supplierId: null, description: "Monthly payroll support costs" },
    { categoryKey: "supplies", amount: 19850, paymentMethod: "cash", supplierId: input.supplierIds.stationery, description: "Kitchen and service supplies" },
    { categoryKey: "marketing", amount: 14200, paymentMethod: "mpesa", supplierId: input.supplierIds.fuel, description: "Promo spend and boosted posts" },
    { categoryKey: "food", amount: 62100, paymentMethod: "bank_transfer", supplierId: input.supplierIds.fuel, description: "Core food and beverage replenishment" },
  ];

  return reportingMonths.flatMap((month, monthIndex) =>
    monthlyTemplates.map((template, templateIndex) => {
      const day = 3 + templateIndex * 4;
      const amount = template.amount + monthIndex * 2100 + (templateIndex % 2 === 0 ? 950 : -650);
      const accountId =
        template.paymentMethod === "cash"
          ? input.accountIds.cash
          : template.paymentMethod === "mpesa"
            ? input.accountIds.mpesa
            : input.accountIds.bank;

      return {
        locationId: input.locationIds.main,
        categoryId: input.categoryIds[template.categoryKey],
        supplierId: template.supplierId,
        expenseNumber: `DEX-${month.year}${String(month.month).padStart(2, "0")}-${String(templateIndex + 1).padStart(2, "0")}`,
        billId: null,
        refNo: `REF-${month.year}${String(month.month).padStart(2, "0")}-${templateIndex + 1}`,
        amount: asAmount(amount),
        description: template.description,
        expenseDate: toIsoDate(month.year, month.month, day),
        paymentMethod: template.paymentMethod,
        accountId,
        receiptImageUrl: null,
        mpesaTxnId:
          template.paymentMethod === "mpesa"
            ? `DMP${month.year}${String(month.month).padStart(2, "0")}${String(templateIndex + 1).padStart(2, "0")}`
            : null,
        expenseRef: `DEMO-${template.categoryKey}-${month.year}${String(month.month).padStart(2, "0")}`,
        isReimbursable: false,
        reimbursedTo: null,
        enteredBy: input.enteredBy,
      };
    }),
  );
}

function buildMpesaTransactions(reportingMonths, input) {
  const templates = [
    { txnType: "topup", partyName: "KCB Transfer", amount: 24000, fee: 0, description: "Wallet top-up from bank", direction: 1 },
    { txnType: "expense", partyName: "KPLC Tokens", amount: 3850, fee: 28, description: "Utility token purchase", direction: -1 },
    { txnType: "airtime", partyName: "Safaricom Airtime", amount: 1200, fee: 0, description: "Staff airtime bundle", direction: -1 },
    { txnType: "transfer", partyName: "Supplier Transfer", amount: 6800, fee: 36, description: "Quick supplier settlement", direction: -1 },
    { txnType: "bank_transfer", partyName: "Family Bank Sweep", amount: 15800, fee: 0, description: "Bank transfer received", direction: 1 },
  ];

  let runningBalance = 78000;

  return reportingMonths.flatMap((month, monthIndex) =>
    templates.map((template, templateIndex) => {
      const amount = (template.amount + monthIndex * 950 + templateIndex * 125) * template.direction;
      const txnFee = template.fee;
      runningBalance += amount - txnFee;

      return {
        locationId: input.locationIds.main,
        txnId: `DMP${month.year}${String(month.month).padStart(2, "0")}${String(templateIndex + 1).padStart(2, "0")}`,
        txnDate: toIsoDate(month.year, month.month, 5 + templateIndex * 4),
        txnTime: `${String(9 + templateIndex).padStart(2, "0")}:1${templateIndex}`,
        txnType: template.txnType,
        partyName: template.partyName,
        amount: asAmount(amount),
        txnFee: asAmount(txnFee),
        balance: asAmount(runningBalance),
        description: template.description,
        rawText: `${template.partyName} ${template.description}`,
        isLinked: false,
        linkedExpenseId: null,
        linkedBillId: null,
        linkedSupplierId: null,
        sourceAccountId: amount > 0 ? input.accountIds.bank : input.accountIds.mpesa,
        destinationAccountId: amount > 0 ? input.accountIds.mpesa : input.accountIds.bank,
        importedBy: input.enteredBy,
      };
    }),
  );
}

function buildFutureBills(anchorDate, input) {
  const base = asUtcDate(anchorDate);
  const billTemplates = [
    { monthOffset: 1, day: 4, supplierId: input.supplierIds.landlord, amount: 58000, description: "June branch rent", status: "pending" },
    { monthOffset: 1, day: 11, supplierId: input.supplierIds.utilities, amount: 12400, description: "Utility arrears settlement", status: "pending" },
    { monthOffset: 2, day: 6, supplierId: input.supplierIds.fuel, amount: 18500, description: "Fuel and logistics invoice", status: "partial", amountPaid: 4500 },
    { monthOffset: 3, day: 9, supplierId: input.supplierIds.stationery, amount: 9600, description: "Packaging and stationery restock", status: "pending" },
  ];

  return billTemplates.map((template, index) => {
    const issue = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + template.monthOffset, template.day));
    const due = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + template.monthOffset, template.day + 10));
    const amountPaid = template.amountPaid || 0;

    return {
      locationId: input.locationIds.main,
      supplierId: template.supplierId,
      billNumber: `DBILL-${issue.getUTCFullYear()}${String(issue.getUTCMonth() + 1).padStart(2, "0")}-${index + 1}`,
      description: template.description,
      amount: asAmount(template.amount),
      amountPaid: asAmount(amountPaid),
      balanceDue: asAmount(template.amount - amountPaid),
      issueDate: issue.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      status: template.status,
    };
  });
}

function buildDemoReportingSeedPlan(input) {
  const reportingMonths = toMonthWindow(input.anchorDate);
  const salePlan = buildSales(reportingMonths, input);

  return {
    reportingMonths,
    sales: salePlan.sales,
    salePayments: salePlan.salePayments,
    expenses: buildExpenses(reportingMonths, input),
    budgets: buildBudgets(reportingMonths, input),
    mpesaTransactions: buildMpesaTransactions(reportingMonths, input),
    futureBills: buildFutureBills(input.anchorDate, input),
  };
}

module.exports = {
  buildDemoReportingSeedPlan,
};
