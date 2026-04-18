-- ============================================================
-- Mission Control — Row Level Security Policies
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
--
-- WHY: The anon key is public in the source code. Without RLS,
-- anyone with that key could read/write all data in these tables.
-- RLS makes the database enforce "you can only touch YOUR stuff."
-- ============================================================

-- ──────────────────────────────────────────
-- TABLE: user_data
-- Stores all app data (bills, notes, etc.)
-- Only the logged-in user can see/edit their own rows
-- ──────────────────────────────────────────

-- Turn on RLS (if not already on)
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- Remove any old permissive defaults
REVOKE ALL ON public.user_data FROM anon, authenticated;

-- Grant basic table access to authenticated users (RLS still filters rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;

-- Drop old policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "user_data_select_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_insert_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_update_own" ON public.user_data;
DROP POLICY IF EXISTS "user_data_delete_own" ON public.user_data;
-- Also drop any older named policies that might exist
DROP POLICY IF EXISTS "Users read own data" ON public.user_data;
DROP POLICY IF EXISTS "Users write own data" ON public.user_data;
DROP POLICY IF EXISTS "Users update own data" ON public.user_data;
DROP POLICY IF EXISTS "Users delete own data" ON public.user_data;
DROP POLICY IF EXISTS "Users can only access their own data" ON public.user_data;

-- SELECT: you can only read rows where user_id = your auth ID
CREATE POLICY "user_data_select_own" ON public.user_data
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- INSERT: you can only insert rows with your own user_id
CREATE POLICY "user_data_insert_own" ON public.user_data
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: you can only update your own rows, and can't change user_id
CREATE POLICY "user_data_update_own" ON public.user_data
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: you can only delete your own rows
CREATE POLICY "user_data_delete_own" ON public.user_data
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Ensure the unique constraint exists for upsert to work
CREATE UNIQUE INDEX IF NOT EXISTS user_data_user_id_key_idx
    ON public.user_data (user_id, key);


-- ──────────────────────────────────────────
-- TABLE: bank_cache
-- Stores bank balance snapshots from SimpleFIN
-- GitHub Actions writes (service role), app reads (authenticated only)
-- Anonymous users get NOTHING
-- ──────────────────────────────────────────

ALTER TABLE public.bank_cache ENABLE ROW LEVEL SECURITY;

-- Remove any old permissive defaults
REVOKE ALL ON public.bank_cache FROM anon, authenticated;

-- Authenticated users can read (the app needs to display balances)
GRANT SELECT ON public.bank_cache TO authenticated;

-- Drop old policies
DROP POLICY IF EXISTS "bank_cache_select_owner" ON public.bank_cache;
DROP POLICY IF EXISTS "Authenticated users read bank cache" ON public.bank_cache;

-- Only authenticated users can read bank cache
-- (GitHub Actions uses service_role key which bypasses RLS entirely)
CREATE POLICY "bank_cache_select_authenticated" ON public.bank_cache
    FOR SELECT TO authenticated
    USING (true);

-- No insert/update/delete for authenticated users
-- Only the service_role key (GitHub Actions) can write to this table


-- ──────────────────────────────────────────
-- TABLE: security_log (NEW — create if not exists)
-- Stores error reports, health events, audit trail
-- Users write their own logs, read their own logs
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL DEFAULT auth.uid(),
    event_type text NOT NULL,          -- 'error', 'health', 'audit', 'rls_probe'
    level text NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error'
    message text NOT NULL,
    context jsonb,                      -- extra data (stack trace hash, key name, etc.)
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.security_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.security_log TO authenticated;

DROP POLICY IF EXISTS "security_log_insert_own" ON public.security_log;
DROP POLICY IF EXISTS "security_log_select_own" ON public.security_log;

-- Users can write their own log entries
CREATE POLICY "security_log_insert_own" ON public.security_log
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can read their own log entries
CREATE POLICY "security_log_select_own" ON public.security_log
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- No update or delete — logs are append-only


-- ──────────────────────────────────────────
-- VERIFICATION QUERY
-- Run this after applying policies to confirm they're active
-- ──────────────────────────────────────────

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_data', 'bank_cache', 'security_log')
ORDER BY tablename, policyname;
