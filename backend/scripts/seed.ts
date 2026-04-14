import bcrypt from "bcryptjs";
import pg from "pg";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../src/loadEnv.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url?.trim()) {
  console.error("DATABASE_URL is not set. Check repo root `.env`.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

async function seed(): Promise<void> {
  const hash = bcrypt.hashSync("Password123", 10);

  const users = [
    {
      email: "officer@jwinsurance.test",
      full_name: "Alex Chan",
      role: "claim_officer",
      department: "Claims",
    },
    {
      email: "accounting@jwinsurance.test",
      full_name: "Betty Lau",
      role: "accounting_staff",
      department: "Finance",
    },
    {
      email: "manager@jwinsurance.test",
      full_name: "Chris Wong",
      role: "manager",
      department: "Operations",
    },
    {
      email: "customer@jwinsurance.test",
      full_name: "Dana Lee",
      role: "customer",
      department: null,
    },
  ] as const;

  const ids: Record<string, string> = {};

  for (const u of users) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, department)
       VALUES ($1, $2, $3, $4::user_role, $5)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [u.email, hash, u.full_name, u.role, u.department],
    );
    ids[u.email] = rows[0].id;
  }

  const customerId = ids["customer@jwinsurance.test"]!;

  const claimRows = [
    {
      ref: "CLM-2026-0001",
      policy: "POL-HK-778899",
      amount: 125000,
      status: "under_review",
      desc: "Vehicle collision — rear bumper and tail light damage.",
    },
    {
      ref: "CLM-2026-0002",
      policy: "POL-HK-445566",
      amount: 520000,
      status: "escalated",
      desc: "Property water damage — urgent cash settlement requested.",
    },
    {
      ref: "CLM-2026-0003",
      policy: "POL-HK-778899",
      amount: 48000,
      status: "approved",
      desc: "Outpatient medical expenses from covered accident.",
    },
  ];

  for (const c of claimRows) {
    await pool.query(
      `INSERT INTO claims (
        reference_number, customer_id, policy_number, incident_date,
        incident_description, claimed_amount, currency, status, workflow_step, escalation_level,
        fraud_risk_score, fraud_flags, coverage_status
      )
      VALUES ($1, $2::uuid, $3, '2026-01-15', $4, $5::numeric, 'HKD', $6::claim_status, 2,
        CASE WHEN $6::text = 'escalated' THEN 2 ELSE 1 END,
        CASE WHEN $5::numeric > 200000::numeric THEN 72 ELSE 28 END,
        CASE WHEN $5::numeric > 200000::numeric THEN '["high_value_claim"]'::jsonb ELSE '[]'::jsonb END,
        'likely')
      ON CONFLICT (reference_number) DO NOTHING`,
      [c.ref, customerId, c.policy, c.desc, c.amount, c.status],
    );
  }

  await pool.query(
    `INSERT INTO ledger_integrations (provider, config, last_sync_at, status)
     VALUES ('sap', '{"endpoint":"https://sap.example.internal"}'::jsonb, now(), 'ok')
     ON CONFLICT (provider) DO UPDATE SET last_sync_at = now()`,
  );

  await pool.query(
    `INSERT INTO compliance_events (framework, rule_code, severity, entity_type, entity_id, details)
     VALUES ('IFRS','REV-REC-01','info','system','seed','{"note":"demo"}'::jsonb)`,
  );

  const sqlPath = path.join(__dirname, "../db/seed/sample_ledger.sql");
  try {
    const extra = await readFile(sqlPath, "utf8");
    await pool.query(extra);
  } catch {
    /* optional file */
  }

  console.log("Seed complete. Demo password for all users: Password123");
  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
