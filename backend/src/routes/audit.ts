import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRoles("manager"),
  async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { rows } = await pool.query(
      `SELECT a.*, u.email AS user_email
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json({ entries: rows });
  },
);

export default router;
