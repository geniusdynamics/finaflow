-- ABOUTME: Add 'wallet' value to account type and payment method enums.
-- ABOUTME: Required for wallet integration across accounts and payroll tables.

ALTER TYPE "type" ADD VALUE IF NOT EXISTS 'wallet';
ALTER TYPE "paymentMethod" ADD VALUE IF NOT EXISTS 'wallet';
