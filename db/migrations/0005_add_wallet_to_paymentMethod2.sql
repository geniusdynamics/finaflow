-- ABOUTME: Add 'wallet' value to the paymentMethod2 enum used by bill_payments and expenses.
-- ABOUTME: Completes the wallet migration that was partially done in 0004 for the old paymentMethod enum.

ALTER TYPE "paymentMethod2" ADD VALUE IF NOT EXISTS 'wallet';
