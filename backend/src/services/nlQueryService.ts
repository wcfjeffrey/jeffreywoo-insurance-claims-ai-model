import type OpenAI from "openai";
import type { Pool } from "pg";
import { z } from "zod";

/** Must match PostgreSQL `claim_status` enum — invalid values break `::claim_status[]` casts. */
export const VALID_CLAIM_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "escalated",
  "approved",
  "rejected",
  "payment_pending",
  "paid",
  "closed",
] as const;

const FilterSchema = z.object({
  amount_min: z.number().optional(),
  amount_max: z.number().optional(),
  status: z.array(z.string()).optional(),
  pending_approval_only: z.boolean().optional(),
});

export type ClaimFilters = z.infer<typeof FilterSchema>;

function sanitizeFilters(filters: ClaimFilters): ClaimFilters {
  const out: ClaimFilters = { ...filters };
  if (out.status?.length) {
    const allowed = new Set<string>(VALID_CLAIM_STATUSES);
    const ok = out.status.filter((s) => allowed.has(s));
    if (ok.length) out.status = ok;
    else delete out.status;
  }
  return out;
}

export async function interpretNaturalLanguage(
  text: string,
  openai: OpenAI | null,
): Promise<ClaimFilters> {
  const t = text.trim();
  if (!openai) {
    return heuristicFilters(t);
  }
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You convert insurance claim questions into JSON filters only.
Respond with JSON: {"amount_min": number?, "amount_max": number?, "status": string[]?, "pending_approval_only": boolean?}
Status MUST be only these exact strings: draft, submitted, under_review, escalated, approved, rejected, payment_pending, paid, closed.
Never use "pending", "open", or other aliases — use pending_approval_only: true for "pending approval" style questions.
No prose, JSON only.`,
        },
        { role: "user", content: t },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = FilterSchema.parse(
      JSON.parse(raw.replace(/```json|```/g, "").trim()),
    );
    const h = heuristicFilters(t);
    return {
      amount_min: parsed.amount_min ?? h.amount_min,
      amount_max: parsed.amount_max ?? h.amount_max,
      pending_approval_only:
        parsed.pending_approval_only ?? h.pending_approval_only,
      status: parsed.status?.length ? parsed.status : h.status,
    };
  } catch (e) {
    console.warn("[nl-query] OpenAI/parse failed, using heuristics:", e);
    return heuristicFilters(t);
  }
}

function heuristicFilters(text: string): ClaimFilters {
  const lower = text.toLowerCase();
  const filters: ClaimFilters = {};
  const amtGt =
    text.match(/>\s*\$?\s*([\d,]+)/) ??
    text.match(
      /(?:greater\s+than|more\s+than|over|above)\s*\$?\s*([\d,]+)/i,
    );
  if (amtGt) filters.amount_min = Number(amtGt[1].replace(/,/g, ""));
  const amtLt =
    text.match(/<\s*\$?\s*([\d,]+)/) ??
    text.match(/(?:less\s+than|under|below)\s*\$?\s*([\d,]+)/i);
  if (amtLt) filters.amount_max = Number(amtLt[1].replace(/,/g, ""));
  if (/pending|approval|review/i.test(lower)) {
    filters.pending_approval_only = true;
  }
  return filters;
}

export async function runClaimQuery(
  pool: Pool,
  raw: ClaimFilters,
): Promise<{ rows: Record<string, unknown>[]; summary: string }> {
  const filters = sanitizeFilters(raw);
  const cond: string[] = ["1=1"];
  const params: unknown[] = [];
  let i = 1;

  if (filters.amount_min != null) {
    cond.push(`claimed_amount >= $${i++}`);
    params.push(filters.amount_min);
  }
  if (filters.amount_max != null) {
    cond.push(`claimed_amount <= $${i++}`);
    params.push(filters.amount_max);
  }
  if (filters.pending_approval_only) {
    cond.push(`status IN ('submitted','under_review','escalated')`);
  } else if (filters.status?.length) {
    cond.push(`status = ANY($${i++}::claim_status[])`);
    params.push(filters.status);
  }

  const sql = `
    SELECT id, reference_number, status, claimed_amount, currency, created_at
    FROM claims
    WHERE ${cond.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  const { rows } = await pool.query(sql, params);
  const summary = `Matched ${rows.length} claim(s).`;
  return { rows, summary };
}
