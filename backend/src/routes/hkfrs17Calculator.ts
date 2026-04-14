import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

// Save CSM calculation
router.post("/save-calculation", requireAuth, requireRoles("manager", "accounting_staff"), async (req, res) => {
  try {
    const { inputs, csmTable, accountingEntries, calculatedAt } = req.body;
    
    const { rows } = await pool.query(
      `INSERT INTO hkfrs17_calculations (
        contract_number, policy_number, customer_name, inputs, csm_table, accounting_entries, calculated_by, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::uuid, $8)
      RETURNING id`,
      [
        inputs.contractNumber,
        inputs.policyNumber,
        inputs.customerName,
        JSON.stringify(inputs),
        JSON.stringify(csmTable),
        JSON.stringify(accountingEntries),
        req.user!.id,
        calculatedAt,
      ]
    );
    
    res.status(201).json({ id: rows[0].id, message: "Calculation saved successfully" });
  } catch (error) {
    console.error("Save calculation error:", error);
    res.status(500).json({ error: "Failed to save calculation" });
  }
});

// Get saved calculations
router.get("/calculations", requireAuth, requireRoles("manager", "accounting_staff"), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, u.full_name as calculated_by_name
      FROM hkfrs17_calculations c
      LEFT JOIN users u ON u.id = c.calculated_by
      ORDER BY c.calculated_at DESC
      LIMIT 50
    `);
    
    res.json({ calculations: rows });
  } catch (error) {
    console.error("Get calculations error:", error);
    res.status(500).json({ error: "Failed to fetch calculations" });
  }
});

export default router;