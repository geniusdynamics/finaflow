# Restaurant Cashflow MVP Spec

## Why
The restaurant owner needs a simple, mobile-friendly system to track income versus expenses, manage supplier debts and due dates, monitor bank/cash balances, handle recurring bills, and process monthly payroll with advances. This MVP will provide real-time cashflow visibility across two locations in KES, avoiding the complexity of a full ERP system.

## What Changes
- **Initialize Full-Stack MVP**: Create the foundation for the Restaurant Cashflow MVP.
- **Database & Data Model**: Implement tables for Locations, Users, Accounts, Ledger Transactions, Daily Sales, Expenses, Suppliers, Bills, and Payroll.
- **Frontend Design**: Implement a distinctive, production-grade mobile-first web interface.
  - *Aesthetic*: Clean, utilitarian but modern (e.g., editorial/magazine or refined minimal) avoiding generic AI aesthetics.
  - *Typography*: Distinctive display fonts paired with a highly readable body font.
  - *Interactions*: CSS-only animations for micro-interactions, providing a snappy experience for managers entering data daily.
- **Core Modules**:
  - Daily Sales (POS Z report manual entry)
  - Expenses (centralized and location-based)
  - Suppliers & Payables (debts, due dates, payments)
  - Bills (recurring monthly costs)
  - Accounts & Ledger (bank/cash balances)
  - Payroll (monthly with advances)
  - Unified Calendar (due dates for suppliers, bills, payroll)
- **Roles & Permissions**: Admin (full access), Manager (location-based access, soft-delete, audit logs).

## Impact
- Affected specs: N/A (New Project)
- Affected code: New repository initialization (frontend, backend, database).

## ADDED Requirements

### Requirement: Distinctive Frontend Design
The system SHALL feature a bold, production-grade aesthetic tailored for mobile-first daily data entry.
- **WHEN** a manager accesses the dashboard on a mobile device
- **THEN** they experience a highly legible, beautifully spaced interface with distinctive typography and no generic "AI slop" design patterns.

### Requirement: Daily Sales Tracking
The system SHALL allow manual entry of daily sales per location.
- **WHEN** a manager enters daily sales from the POS Z report
- **THEN** the system saves the net sales, optional cash/card/delivery breakdowns, and validates uniqueness per location per date.

### Requirement: Expense Management
The system SHALL track expenses by category and location/central.
- **WHEN** an expense is recorded
- **THEN** a corresponding ledger transaction is automatically created to reflect the deduction from the specified account.

### Requirement: Supplier & Payable Tracking
The system SHALL manage supplier profiles, invoices, and payments.
- **WHEN** a supplier invoice is recorded with a due date
- **THEN** it appears on the calendar and affects the supplier's outstanding balance.

### Requirement: Accounts & Ledger
The system SHALL maintain real-time balances for multiple cash and bank accounts.
- **WHEN** a payment, deposit, or withdrawal is made
- **THEN** the ledger updates the account balance and logs the transaction for auditing.

### Requirement: Payroll Management
The system SHALL track monthly payroll periods, employee advances, and net due amounts.
- **WHEN** a payroll advance is paid
- **THEN** the employee's net due for the month is reduced, and a ledger transaction is recorded.

### Requirement: Unified Calendar
The system SHALL display all financial obligations on a single calendar view.
- **WHEN** the owner views the calendar
- **THEN** they see supplier invoice due dates, recurring bills, and payroll target dates.

### Requirement: Soft Deletion and Auditing
The system SHALL NOT permanently delete records but instead soft-delete them and log the action.
- **WHEN** a manager deletes an expense
- **THEN** the record is marked as deleted (`deleted_at`) and an audit log entry is created detailing who made the change and when.