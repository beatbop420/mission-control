"""
sync_bank_data.py
─────────────────
Fetches bank data from SimpleFIN and saves it to Supabase.
Runs via GitHub Actions every 6 hours so the web app has
fresh bank data on phone — no local Python server needed.

Needs 3 environment variables (set as GitHub repo secrets):
  SIMPLEFIN_ACCESS_URL  — your SimpleFIN access URL (the one with credentials in it)
  SUPABASE_URL          — https://dtpcwammbcxdmhygwsth.supabase.co
  SUPABASE_SERVICE_KEY  — service_role key from Supabase dashboard → Settings → API
"""

import httpx
import json
import os
import sys
from datetime import datetime, timedelta, timezone

# ── Read environment variables ──────────────────────────────────────────────
SIMPLEFIN_URL     = os.environ.get('SIMPLEFIN_ACCESS_URL', '').strip()
SUPABASE_URL      = os.environ.get('SUPABASE_URL', '').strip()
SUPABASE_SVC_KEY  = os.environ.get('SUPABASE_SERVICE_KEY', '').strip()

if not all([SIMPLEFIN_URL, SUPABASE_URL, SUPABASE_SVC_KEY]):
    print('❌ Missing required environment variables. Check GitHub secrets.')
    sys.exit(1)

# ── Fetch from SimpleFIN ─────────────────────────────────────────────────────
# 45 days back so we get a good transaction history
start_date = int((datetime.now() - timedelta(days=45)).timestamp())
fetch_url  = f'{SIMPLEFIN_URL}/accounts?pending=1&start-date={start_date}'

print('Fetching from SimpleFIN...')
try:
    r = httpx.get(fetch_url, timeout=30)
    r.raise_for_status()
    raw = r.json()
except Exception as e:
    print(f'❌ SimpleFIN fetch failed: {e}')
    sys.exit(1)

# ── Format the data (same shape as dashboard-server.py returns) ──────────────
accounts = []
for acc in raw.get('accounts', []):
    name = acc.get('name', 'Unknown').encode('ascii', 'replace').decode()

    txns         = acc.get('transactions', [])
    pending_txns = [t for t in txns if t.get('pending') is True or t.get('posted', 1) == 0]
    posted_txns  = [t for t in txns if not (t.get('pending') is True or t.get('posted', 1) == 0)]

    posted_balance  = float(acc.get('balance', 0))
    simplefin_avail = float(acc.get('available-balance', acc.get('balance', 0)))
    pending_total   = sum(float(t.get('amount', 0)) for t in pending_txns)

    bal_date = acc.get('balance-date', 0)
    bal_date_str = datetime.fromtimestamp(bal_date, tz=timezone.utc).strftime('%Y-%m-%d') if bal_date else ''

    accounts.append({
        'name':             name,
        'balance':          posted_balance,       # ending daily posted balance
        'available':        simplefin_avail,       # SimpleFIN available-balance
        'pending_total':    pending_total,
        'computed_available': posted_balance + pending_total,
        'pending_count':    len(pending_txns),
        'balance_date':     bal_date_str,
        'pending_transactions': [
            {
                'amount':       float(t.get('amount', 0)),
                'description':  t.get('description', t.get('payee', '')),
                'transacted_at': t.get('transacted_at', 0),
            }
            for t in pending_txns
        ],
        'transactions': [
            {
                'amount':      float(t.get('amount', 0)),
                'description': t.get('description', t.get('payee', '')),
                'date':        datetime.fromtimestamp(
                                   t.get('transacted_at', 0), tz=timezone.utc
                               ).strftime('%Y-%m-%d') if t.get('transacted_at') else '',
            }
            for t in posted_txns[:60]   # cap at 60 posted transactions
        ],
    })

    print(f'  {name}: posted=${posted_balance:.2f}, available=${simplefin_avail:.2f}, '
          f'pending={len(pending_txns)} tx (${pending_total:.2f})')

# ── Build the final payload ───────────────────────────────────────────────────
now = datetime.now(timezone.utc)

# Human-readable timestamp in Central Time (no pytz needed — just offset)
# CT is UTC-6 (CST) or UTC-5 (CDT) — approximate with -6 for reliability
ct_hour   = (now.hour - 6) % 24
ct_ampm   = 'AM' if ct_hour < 12 else 'PM'
ct_hour12 = ct_hour % 12 or 12
ct_min    = now.strftime('%M')
ct_day    = now.day

fetched_at_human = f"{now.strftime('%b')} {ct_day} {ct_hour12}:{ct_min} {ct_ampm} CT"

data = {
    'accounts':          accounts,
    'fetched_at':        now.isoformat(),
    'fetched_at_human':  fetched_at_human,
    'source':            'github-actions',
}

# ── Save to Supabase bank_cache table ────────────────────────────────────────
# The table has a single row (id=1) that gets overwritten each run.
# Web app reads from this table when /balances (local server) isn't available.

headers = {
    'apikey':          SUPABASE_SVC_KEY,
    'Authorization':   f'Bearer {SUPABASE_SVC_KEY}',
    'Content-Type':    'application/json',
    'Prefer':          'resolution=merge-duplicates',   # upsert behaviour
}

payload = {
    'id':          1,
    'data':        data,
    'fetched_at':  now.isoformat(),
}

print(f'\nSaving to Supabase...')
try:
    resp = httpx.post(
        f'{SUPABASE_URL}/rest/v1/bank_cache',
        headers=headers,
        json=payload,
        timeout=15,
    )
    if resp.status_code in (200, 201, 204):
        print(f'✅ Saved successfully — {fetched_at_human}')
    else:
        print(f'❌ Supabase error {resp.status_code}: {resp.text}')
        sys.exit(1)
except Exception as e:
    print(f'❌ Supabase request failed: {e}')
    sys.exit(1)
