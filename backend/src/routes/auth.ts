import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { writeAudit } from "../services/auditService.js";
import { isUserRole } from "../domain/roles.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password.trim();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    role: string;
  }>(
    `SELECT id, email, password_hash, full_name, role::text AS role FROM users WHERE email = $1 AND is_active`,
    [email],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (!isUserRole(user.role)) {
    res.status(500).json({ error: "Invalid role" });
    return;
  }
  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
  });
  await writeAudit(pool, {
    userId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    metadata: { email: user.email },
    req,
  });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    },
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    locale: string;
    department: string | null;
  }>(
    `SELECT id, email, full_name, role::text AS role, locale, department FROM users WHERE id = $1`,
    [req.user!.id],
  );
  const u = rows[0];
  if (!u) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    locale: u.locale,
    department: u.department,
  });
});

export default router;
