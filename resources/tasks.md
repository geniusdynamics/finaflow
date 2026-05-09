# Tasks

- [x] Task 1: Initialize Project & Database Schema
  - [x] SubTask 1.1: Setup backend framework (e.g., Node.js/Express or Python/FastAPI) and SQLite/PostgreSQL database.
  - [x] SubTask 1.2: Create migrations for Locations, Users, and Audit Log tables.
  - [x] SubTask 1.3: Create migrations for Accounts, Ledger Transactions, and Daily Sales tables.
  - [x] SubTask 1.4: Create migrations for Expenses, Suppliers, Invoices, and Payments.
  - [x] SubTask 1.5: Create migrations for Bill Templates, Payables, Employees, and Payroll.

- [x] Task 2: Implement Core Backend Models & API (with TDD)
  - [x] SubTask 2.1: Implement generic soft-delete and audit-logging middleware/hooks.
  - [x] SubTask 2.2: Build API endpoints for Locations and Users (Auth/Role middleware).
  - [x] SubTask 2.3: Build API endpoints for Accounts and Ledger (ensure balance logic is tested).
  - [x] SubTask 2.4: Build API endpoints for Daily Sales and Expenses (with transaction linking).
  - [x] SubTask 2.5: Build API endpoints for Suppliers, Invoices, and Payments.
  - [x] SubTask 2.6: Build API endpoints for Bills and Payroll periods/entries.
  - [x] SubTask 2.7: Build API endpoint for the Unified Calendar (aggregating due dates).

- [x] Task 3: Setup Frontend Architecture & Design System
  - [x] SubTask 3.1: Initialize React/Next.js/Vite frontend.
  - [x] SubTask 3.2: Implement the distinct "frontend-design" aesthetic (CSS variables, typography, mobile-first grid).
  - [x] SubTask 3.3: Create core reusable UI components (Cards, Forms, Tables, Modals, distinct buttons).

- [x] Task 4: Build Frontend Modules
  - [x] SubTask 4.1: Build Dashboard (Today's sales, account balances, due next 7/30 days, overdue).
  - [x] SubTask 4.2: Build Daily Sales screen (List, filters, Add/Edit form with photo attachment placeholder).
  - [x] SubTask 4.3: Build Expenses and Accounts & Ledger screens.
  - [x] SubTask 4.4: Build Suppliers screen (List, detail view, invoice/payment forms).
  - [x] SubTask 4.5: Build Bills and Payroll screens.
  - [x] SubTask 4.6: Build the Unified Calendar view with filters.

- [x] Task 5: Integration & E2E Testing
  - [x] SubTask 5.1: Connect frontend to backend APIs for all modules.
  - [x] SubTask 5.2: Write end-to-end tests for a complete daily cashflow cycle (Sales -> Expense -> Ledger update).
  - [x] SubTask 5.3: Verify role permissions (Manager vs Owner/Admin access).

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] can run in parallel with [Task 1] and [Task 2]
- [Task 4] depends on [Task 2] and [Task 3]
- [Task 5] depends on [Task 4]