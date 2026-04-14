// backend/src/services/integrationService.ts
// THIS FILE SHOULD ONLY CONTAIN SERVICE FUNCTIONS - NO ROUTES!

interface SyncPayload {
  disbursements: any[];
  claims: any[];
  syncDate: string;
}

export interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
  sapResult?: { success: boolean; message: string; mockId?: string };
  oracleResult?: { success: boolean; message: string; mockId?: string };
}

// ============================================
// Helper function to ensure columns exist
// ============================================
async function ensureSyncColumns(pool: any): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE disbursements 
      ADD COLUMN IF NOT EXISTS synced_to_erp BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS erp_system VARCHAR(20),
      ADD COLUMN IF NOT EXISTS erp_sync_id VARCHAR(100)
    `);
    console.log("✅ ERP sync columns verified");
  } catch (error) {
    console.log("⚠️ Could not verify ERP columns:", error);
  }
}

// ============================================
// Mock SAP Integration (for demo purposes)
// ============================================
async function syncToSAP(payload: SyncPayload): Promise<{ success: boolean; message: string; mockId?: string }> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  const mockId = `SAP_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`[MOCK] Syncing to SAP:`, {
    disbursements: payload.disbursements.length,
    claims: payload.claims.length,
    mockId
  });
  
  const isSuccess = Math.random() > 0.1;
  
  if (isSuccess) {
    return { 
      success: true, 
      message: `Successfully synced ${payload.disbursements.length} disbursements to SAP`,
      mockId
    };
  } else {
    return { 
      success: false, 
      message: "SAP sync failed: Connection timeout"
    };
  }
}

// ============================================
// Mock Oracle Integration (for demo purposes)
// ============================================
async function syncToOracle(payload: SyncPayload): Promise<{ success: boolean; message: string; mockId?: string }> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  const mockId = `ORA_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  console.log(`[MOCK] Syncing to Oracle:`, {
    disbursements: payload.disbursements.length,
    claims: payload.claims.length,
    mockId
  });
  
  const isSuccess = Math.random() > 0.1;
  
  if (isSuccess) {
    return { 
      success: true, 
      message: `Successfully synced ${payload.disbursements.length} disbursements to Oracle`,
      mockId
    };
  } else {
    return { 
      success: false, 
      message: "Oracle sync failed: Invalid credentials"
    };
  }
}

// ============================================
// Main sync function
// ============================================
export async function syncLedgerToERP(
  system: 'sap' | 'oracle' | 'both', 
  pool: any
): Promise<SyncResult> {
  const result: SyncResult = { success: true };
  
  try {
    console.log("=== syncLedgerToERP called ===");
    console.log("System:", system);
    
    // Ensure the sync columns exist
    await ensureSyncColumns(pool);
    
    // Fetch data to sync - ONLY use columns that exist in your table
    const disbursementsResult = await pool.query(`
      SELECT 
        d.id, 
        d.claim_id,
        d.net_amount, 
        d.currency, 
        d.status,
        d.created_at,
        c.reference_number as claim_reference
      FROM disbursements d
      LEFT JOIN claims c ON d.claim_id = c.id
      WHERE d.status = 'completed' 
        AND (d.synced_to_erp IS NOT TRUE OR d.synced_to_erp IS NULL)
      LIMIT 100
    `);
    
    console.log(`Found ${disbursementsResult.rows.length} disbursements to sync`);
    
    const claimsResult = await pool.query(`
      SELECT reference_number, claimed_amount, status
      FROM claims 
      WHERE status IN ('approved', 'paid')
      LIMIT 100
    `);
    
    const payload: SyncPayload = {
      disbursements: disbursementsResult.rows,
      claims: claimsResult.rows,
      syncDate: new Date().toISOString()
    };
    
    if (payload.disbursements.length === 0 && payload.claims.length === 0) {
      result.message = "No new data to sync";
      console.log("No data to sync");
      return result;
    }
    
    // Sync to selected system(s)
    if (system === 'sap' || system === 'both') {
      console.log("Syncing to SAP...");
      result.sapResult = await syncToSAP(payload);
      
      if (!result.sapResult.success) {
        result.success = false;
        result.message = result.sapResult.message;
      } else {
        if (payload.disbursements.length > 0) {
          const ids = payload.disbursements.map((d: any) => d.id);
          await pool.query(`
            UPDATE disbursements 
            SET synced_to_erp = TRUE, 
                synced_at = NOW(), 
                erp_system = 'sap',
                erp_sync_id = $1
            WHERE id = ANY($2::uuid[])
          `, [result.sapResult.mockId, ids]);
        }
        if (!result.message) result.message = result.sapResult.message;
      }
    }
    
    if (system === 'oracle' || system === 'both') {
      console.log("Syncing to Oracle...");
      result.oracleResult = await syncToOracle(payload);
      
      if (!result.oracleResult.success) {
        result.success = false;
        result.message = result.oracleResult.message;
      } else {
        if (payload.disbursements.length > 0) {
          const ids = payload.disbursements.map((d: any) => d.id);
          await pool.query(`
            UPDATE disbursements 
            SET synced_to_erp = TRUE, 
                synced_at = NOW(), 
                erp_system = 'oracle',
                erp_sync_id = $1
            WHERE id = ANY($2::uuid[])
          `, [result.oracleResult.mockId, ids]);
        }
        if (!result.message) result.message = result.oracleResult.message;
      }
    }
    
    if (result.success && !result.message) {
      result.message = `Successfully synced to ${system}`;
    }
    
    return result;
  } catch (error) {
    console.error('Sync error details:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Sync failed' 
    };
  }
}

// ============================================
// Function to get sync status
// ============================================
export async function getSyncStatus(pool: any): Promise<{
  syncedCount: number;
  pendingCount: number;
  lastSyncDate: Date | null;
}> {
  try {
    await ensureSyncColumns(pool);
    
    const syncedResult = await pool.query(`
      SELECT COUNT(*) as count, MAX(synced_at) as last_sync
      FROM disbursements 
      WHERE synced_to_erp = TRUE
    `);
    
    const pendingResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM disbursements 
      WHERE status = 'completed' 
        AND (synced_to_erp IS NOT TRUE OR synced_to_erp IS NULL)
    `);
    
    return {
      syncedCount: parseInt(syncedResult.rows[0]?.count || 0),
      pendingCount: parseInt(pendingResult.rows[0]?.count || 0),
      lastSyncDate: syncedResult.rows[0]?.last_sync || null
    };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return {
      syncedCount: 0,
      pendingCount: 0,
      lastSyncDate: null
    };
  }
}