import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE user_id = $1::uuid ORDER BY created_at DESC LIMIT 100`,
    [req.user!.id],
  );
  res.json({ notifications: rows });
});

const sendSchema = z.object({
  channel: z.enum(["email", "sms", "teams", "slack", "in_app"]),
  subject: z.string().optional(),
  body: z.string(),
  user_id: z.string().uuid().optional(),
});

router.post(
  "/send",
  requireAuth,
  requireRoles("manager", "claim_officer", "accounting_staff"),
  async (req, res) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const target = parsed.data.user_id ?? req.user!.id;
    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, channel, subject, body, status)
       VALUES ($1::uuid, $2::notification_channel, $3, $4, 'queued')
       RETURNING *`,
      [target, parsed.data.channel, parsed.data.subject ?? "", parsed.data.body],
    );
    res.status(201).json({
      notification: rows[0],
      note: "Integrate SMTP, Twilio, Teams webhooks, or Slack incoming webhooks in production.",
    });
  },
);

export default router;
