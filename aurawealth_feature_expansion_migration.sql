-- ══════════════════════════════════════════════════════════════
-- AuraWealth — Budget, Goal, and Lending Feature Expansion
-- Run this in Supabase SQL Editor after the base schema exists.
-- Safe to run multiple times.
-- ══════════════════════════════════════════════════════════════

-- ── Budgets ─────────────────────────────────────
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS rollover_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_percent integer DEFAULT 80,
  ADD COLUMN IF NOT EXISTS recurring_day integer,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE budgets
  DROP CONSTRAINT IF EXISTS budgets_kind_check,
  ADD CONSTRAINT budgets_kind_check CHECK (kind IN ('fixed', 'flexible'));

ALTER TABLE budgets
  DROP CONSTRAINT IF EXISTS budgets_alert_percent_check,
  ADD CONSTRAINT budgets_alert_percent_check CHECK (alert_percent BETWEEN 1 AND 150);

ALTER TABLE budgets
  DROP CONSTRAINT IF EXISTS budgets_recurring_day_check,
  ADD CONSTRAINT budgets_recurring_day_check CHECK (recurring_day IS NULL OR recurring_day BETWEEN 1 AND 31);

-- ── Goals ───────────────────────────────────────
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_contribution_amount numeric,
  ADD COLUMN IF NOT EXISTS auto_contribution_day integer;

ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS goals_priority_check,
  ADD CONSTRAINT goals_priority_check CHECK (priority IN ('low', 'medium', 'high'));

ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS goals_auto_contribution_amount_check,
  ADD CONSTRAINT goals_auto_contribution_amount_check CHECK (auto_contribution_amount IS NULL OR auto_contribution_amount >= 0);

ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS goals_auto_contribution_day_check,
  ADD CONSTRAINT goals_auto_contribution_day_check CHECK (auto_contribution_day IS NULL OR auto_contribution_day BETWEEN 1 AND 31);

-- ── Loans ───────────────────────────────────────
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS interest_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proof_note text,
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz;

ALTER TABLE loans
  DROP CONSTRAINT IF EXISTS loans_interest_rate_check,
  ADD CONSTRAINT loans_interest_rate_check CHECK (interest_rate IS NULL OR interest_rate >= 0);

-- ── Loan Payments ───────────────────────────────
ALTER TABLE loan_payments
  ADD COLUMN IF NOT EXISTS note text;

-- ── Helpful indexes for the new views ───────────
CREATE INDEX IF NOT EXISTS idx_budgets_user_month
  ON budgets(user_id, month);

CREATE INDEX IF NOT EXISTS idx_goals_user_archive_pause
  ON goals(user_id, is_archived, is_paused);

CREATE INDEX IF NOT EXISTS idx_loans_user_person
  ON loans(user_id, person);

CREATE INDEX IF NOT EXISTS idx_loans_user_due
  ON loans(user_id, due_date);

-- ══════════════════════════════════════════════════════════════
-- Done.
-- ══════════════════════════════════════════════════════════════
