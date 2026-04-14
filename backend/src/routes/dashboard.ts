import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/summary", requireAuth, async (req, res) => {
  const role = req.user!.role;
  const uid = req.user!.id;

  const statusCounts = await pool.query<{ status: string; c: string }>(
    `SELECT status::text AS status, count(*)::text AS c FROM claims GROUP BY status`,
  );
  const byStatus: Record<string, number> = {};
  for (const r of statusCounts.rows) {
    byStatus[r.status] = Number(r.c);
  }

  let myOpen = 0;
  if (role === "customer") {
    const { rows } = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM claims WHERE customer_id = $1::uuid AND status NOT IN ('closed','rejected','paid')`,
      [uid],
    );
    myOpen = Number(rows[0].c);
  }

  const recent = await pool.query(
    `SELECT id, reference_number, status, claimed_amount, currency, updated_at
     FROM claims ORDER BY updated_at DESC LIMIT 20`,
  );

  res.json({
    role,
    claimStatusCounts: byStatus,
    myOpenClaims: role === "customer" ? myOpen : undefined,
    recentClaims: recent.rows,
  });
});

export default router;
