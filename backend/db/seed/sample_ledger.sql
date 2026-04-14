-- Optional extra sample accounting lines (idempotent)
INSERT INTO accounting_entries (ledger_account, debit, credit, currency, provider, metadata)
SELECT 'OUTSTANDING_CLAIMS', 250000, 0, 'HKD', 'oracle', '{"note":"pending exposure"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_entries WHERE ledger_account = 'OUTSTANDING_CLAIMS' AND provider = 'oracle'
);
