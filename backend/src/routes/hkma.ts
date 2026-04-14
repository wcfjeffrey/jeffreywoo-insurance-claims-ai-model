import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { submitHkmaPayment } from "../services/hkmaService.js";
import { writeAudit } from "../services/auditService.js";

const router = Router();

router.post(
  "/payments/:disbursementId",
  requireAuth,
  requireRoles("accounting_staff", "manager"),
  async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM disbursements WHERE id = $1::uuid`,
      [req.params.disbursementId],
    );
    const d = rows[0];
    if (!d) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const result = await submitHkmaPayment({
      disbursementId: d.id,
      amount: Number(d.net_amount),
      currency: d.currency,
      creditorAccount: process.env.HKMA_DEFAULT_CREDITOR_ACCOUNT ?? "HK-PLACEHOLDER",
      reference: `DISB-${d.id}`,
    });

    await pool.query(
      `INSERT INTO hkma_payment_queue (disbursement_id, request_payload, response_payload, status)
       VALUES ($1::uuid, $2::jsonb, $3::jsonb, $4)`,
      [
        d.id,
        JSON.stringify({ amount: d.net_amount, currency: d.currency }),
        JSON.stringify(result),
        result.status === "simulated" ? "simulated" : "sent",
      ],
    );

    if (result.status === "simulated" || result.status === "accepted") {
      await pool.query(
        `UPDATE disbursements SET hkma_payment_ref = $2, status = 'processing', updated_at = now() WHERE id = $1::uuid`,
        [d.id, result.reference],
      );
    }

    await writeAudit(pool, {
      userId: req.user!.id,
      action: "hkma.payment.submit",
      entityType: "disbursement",
      entityId: d.id,
      metadata: { reference: result.reference },
      req,
    });

    res.json(result);
  },
);

export default router;
