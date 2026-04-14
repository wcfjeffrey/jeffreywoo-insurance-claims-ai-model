from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI(title="Insurance Claim Management API")

# Root route
@app.get("/")
def read_root():
    return {"message": "Welcome to the Insurance Claim Management API"}

# -----------------------------
# Data Models
# -----------------------------
class Claim(BaseModel):
    id: int
    customer_name: str
    amount: float
    status: str  # "submitted", "approved", "rejected"

class AccountingEntry(BaseModel):
    id: int
    claim_id: int
    payout_amount: float
    description: str

# -----------------------------
# In-memory storage (replace with DB later)
# -----------------------------
claims_db: List[Claim] = []
accounting_db: List[AccountingEntry] = []

# -----------------------------
# Claim Department Routes
# -----------------------------
@app.post("/claims/")
def submit_claim(claim: Claim):
    claims_db.append(claim)
    return {"message": "Claim submitted successfully", "claim": claim}

@app.get("/claims/{claim_id}")
def get_claim(claim_id: int):
    for claim in claims_db:
        if claim.id == claim_id:
            return claim
    raise HTTPException(status_code=404, detail="Claim not found")

@app.put("/claims/{claim_id}/approve")
def approve_claim(claim_id: int):
    for claim in claims_db:
        if claim.id == claim_id:
            claim.status = "approved"
            return {"message": "Claim approved", "claim": claim}
    raise HTTPException(status_code=404, detail="Claim not found")

@app.put("/claims/{claim_id}/reject")
def reject_claim(claim_id: int):
    for claim in claims_db:
        if claim.id == claim_id:
            claim.status = "rejected"
            return {"message": "Claim rejected", "claim": claim}
    raise HTTPException(status_code=404, detail="Claim not found")

# -----------------------------
# Accounting Department Routes
# -----------------------------
@app.post("/accounting/")
def record_payout(entry: AccountingEntry):
    accounting_db.append(entry)
    return {"message": "Payout recorded successfully", "entry": entry}

@app.get("/accounting/{claim_id}")
def get_payout_by_claim(claim_id: int):
    payouts = [entry for entry in accounting_db if entry.claim_id == claim_id]
    if not payouts:
        raise HTTPException(status_code=404, detail="No payouts found for this claim")
    return payouts

@app.get("/accounting/")
def list_all_payouts():
    return accounting_db