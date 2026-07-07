-- ══════════════════════════════════════════════════════════════
-- AuraWealth — Performance Index Migration
-- Run this in Supabase SQL Editor to add all missing indexes
-- Safe to run multiple times (IF NOT EXISTS)
-- ══════════════════════════════════════════════════════════════

-- ── Categories ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_categories_user
  ON categories(user_id);

-- ── Transactions ────────────────────────────────
-- Already exist: idx_transactions_user, idx_transactions_date, idx_transactions_type
-- Add: composite for category+date queries (budget spending calculations)
CREATE INDEX IF NOT EXISTS idx_transactions_cat_date
  ON transactions(user_id, category_id, date DESC);

-- ── Goals ───────────────────────────────────────
-- Already exists: idx_goals_user
-- Add: composite for status filtering + ordered listing
CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_user_created
  ON goals(user_id, created_at DESC);

-- ── Goal Contributions ──────────────────────────
-- Already exists: idx_goal_contributions_goal
-- Add: composite for ordered detail page + user lookup
CREATE INDEX IF NOT EXISTS idx_goal_contributions_ordered
  ON goal_contributions(goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user
  ON goal_contributions(user_id);

-- ── Loans ───────────────────────────────────────
-- Already exist: idx_loans_user, idx_loans_status
-- Add: composite for type filtering + date ordering
CREATE INDEX IF NOT EXISTS idx_loans_user_type
  ON loans(user_id, type);
CREATE INDEX IF NOT EXISTS idx_loans_user_status
  ON loans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_user_date
  ON loans(user_id, date DESC);

-- ── Loan Payments ───────────────────────────────
-- Already exists: idx_loan_payments_loan
-- Add: composite for ordered detail page + user lookup
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_ordered
  ON loan_payments(loan_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_loan_payments_user
  ON loan_payments(user_id);

-- ══════════════════════════════════════════════════════════════
-- Done! All indexes created.
-- ══════════════════════════════════════════════════════════════
