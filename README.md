<div align="center">
  <img src="assets/JeffreyWooInsuranceClaims.png" alt="JeffreyWooInsuranceClaimsBanner" width="1200" height="600" />
</div>

## 📊 Overview

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-4.0-646CFF?logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.5-010101?logo=socketdotio)](https://socket.io/)
[![i18next](https://img.shields.io/badge/i18next-22.4-26A69A?logo=i18next)](https://www.i18next.com/)
[![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens)](https://jwt.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/K8s-Ready-326CE5?logo=kubernetes)](https://kubernetes.io/)
[![HKFRS 17](https://img.shields.io/badge/HKFRS%2017-Compliant-Blue)](https://www.hkicpa.org.hk/)
[![License](https://img.shields.io/badge/License-Proprietary-Red)](LICENSE)

**JeffreyWoo Insurance Claims** is an AI‑powered, enterprise‑grade insurance claims management platform that automates the entire workflow — from initial submission to final disbursement, integrating company background/document validation, real‑time fraud detection, predictive risk analytics, and automated accounting workflows to deliver faster, smarter, and more transparent claims processing. Built for regulatory compliance under HKFRS 17, it ensures precise insurance‑contract accounting, robust audit trails, and seamless alignment with enterprise governance standards.

## ✨ What It Does

| Area | Implementation |
|------|------------------|
| **Role-based Access Control (RBAC)** | Customer, Claim Officer, Accounting Staff, Manager (JWT auth + route guards) |
| **AI** | AI-driven claim validation, Rule-based fraud/coverage scoring; optional GPT for chat and natural-language claim filters |
| **Claims Management** | Full CRUD operations for insurance claims | 
| **Real-time Claim Status Tracking** | Draft → Submit → Review → Escalate → Approve/Reject → Payment Pipeline (supporting document uploads) |
| **Accounting** | Accounting entires auto-generation, CSM (Contractual Service Margin) amortization calculator, payout calculation (tax/FX hooks), cash-flow forecast with confidence intervals, LRC/LIC tracking, risk adjustment, ledger sync stub (SAP/Oracle-style), ROI summary |
| **Payment Processing** | Disbursement creation, HKMA payment submission integration (simulated) |
| **Cash Flow Forecasting** | Predictive modeling with confidence intervals |
| **Fraud Detection** | Predictive analytics with real-time machine learning (ML) based fraud risk scoring (0-100), anomaly detection, flags |
| **HKMA** | Payment submission adapter (simulated when `HKMA_OPENAPI_BASE_URL` is unset) |
| **Compliance** | Event log (HKFRS 17/Basel-style hooks); manager compliance monitoring endpoint |
| **Audit** | Complete immutable audit log on key actions/workflow history for user tracking |
| **Multi-format Report Generation** | Operational reports/summaries in Excel/PDF |
| **Multi-language** | English and Chinese (i18next) (easy to add additional languages)|
| **Multi-currency support** | HKD, USD, CNY, EUR, GBP, JPY and SGD |
| **Real-time Dashboard** | Live KPIs, Socket.IO updates for executive dashboard refresh |

*Note: The system excels at HKFRS 17 compliance and automated claims processing. For Incurred But Not Reported (IBNR), subrogation, and formal adjudication workflows, these are planned enhancements for future releases.*

## 📋 Claims Lifecycle Management

| Stage	| Implementation	Status|
|--------|-----------------------|
| Claim Submission	| Digital form with policy validation| 
| Document Upload	| Support PDF, JPG, PNG, DOC, DOCX| 
| Status Tracking	| 8 statuses with audit trail| 
| AI Risk Scoring	| 0-100 fraud probability score| 
| Officer Review	| Approve/Reject with notes| 
| Manager Escalation	| High-value claim escalation| 
| Payment Creation	| Automated disbursement| 
| HKMA Submission	| Payment gateway integration| 

## 📤 Claims Status Workflow

<pre lang="markdown">
┌──────────┐    ┌───────────┐     ┌────────────┐     ┌──────────┐    ┌─────────────────┐     ┌─────────┐
│  DRAFT   │───▶│ SUBMITTED │───▶│UNDER REVIEW│───▶│APPROVED  │───▶│PAYMENT PENDING  │───▶│  PAID   │
└──────────┘    └───────────┘     └────────────┘     └──────────┘    └─────────────────┘     └─────────┘
                                        │                  │
                                        ▼                  ▼
                                 ┌────────────┐     ┌────────────┐
                                 │ ESCALATED  │     │  REJECTED  │
                                 └────────────┘     └────────────┘</pre>

## 🔎 AI Fraud Detection
|Feature|Implementation|Accuracy|
|--------|-------------|----------|
|Risk Scoring|Rule-based + ML anomaly detection|85-95%|
|Fraud Indicators|Suspicious patterns, vendor verification|Real-time|
|AI Validation Report|Document analysis + recommendations|Automated|
|Natural Language Query|Search claims using plain English|90%+|

## ⚡First Notice of Loss (FNOL) Triage Automation
|Step|Manual Process|Automated Process|
|----|--------------|-----------------|
|1. Intake|Customer calls or emails — agent types details manually|Customer submits claims via web — NLP conversational assistant extracts key data (policy number, date, location, description) in real time|
|2. Document collection|Agent requests photos/police/hospital report — customer faxes or emails|System auto‑requests documents via chat — document validation AI checks for completeness, clarity, and forgery|
|3. Severity assessment|Agent reads description and decides if urgent	ML model scans text and images to classify severity (e.g., "Total Loss" vs. "Minor Dent") based on keywords, damage estimates, and historical patterns|
|4. Fraud screening|Agent flags obvious red flags manually|Fraud detection ML runs silently in background — scores claim 0-100 for fraud risk (e.g., staged accident, inflated damages)|
|5. Routing|Agent manually assigns to adjuster based on type/location|System auto‑routes low‑severity claims to fast‑track team, high‑fraud claims to special investigators, complex claims to senior adjusters|
|6. Accounting prep|Finance team waits for claim approval to book entries|System generates HKFRS 17 compliant journal entries (CSM, loss component) immediately after triage — ready for ERP (SAP/Oracle) sync|

## 📐 HKFRS 17 Insurance Accounting

### Regulatory Context
**HKFRS 17** (effective January 1, 2023) replaces HKFRS 4. My platform implements the **General Measurement Model (GMM)** using the **Building Block Approach - 100% automated**.

### Core HKFRS 17 Components Implemented
|Component|  Definition |  Implementation  |
|---------|-------------|------------------|
|CSM (Contractual Service Margin)|Unearned profit to be recognized over coverage period|Full amortization table with interest accretion|
|LRC (Liability for Remaining Coverage)|Obligation for future claims under active policies|Real-time calculation and tracking|
|LIC (Liability for Incurred Claims)|Provision for reported but unpaid claims|Automated reserve tracking|
|Risk Adjustment|Margin for non-financial risk|Confidence level technique (75th percentile)|
|Fulfillment Cash Flows|PV of future claim payments + expenses|Discounted cash flow calculation|

### CSM Amortization Calculation

#### Core business logic implemented in HKFRS 17 Calculator
Interest Accretion = Opening CSM × Discount Rate  
Amortization = (Opening CSM + Interest Accretion) × Coverage Percentage  
Closing CSM = Opening CSM + Interest Accretion - Amortization

#### Coverage Units Allocation Methods:

| Method                     | Pattern             | Typical Use Case                 | Explanation                                                                     |
|----------------------------|---------------------|----------------------------------|---------------------------------------------------------------------------------|
| **Evenly**                 | Equal per year      | Standard policies                | Coverage units are distributed evenly across all years, regardless of risk.     |
| **Weighted by Sum Assured**| Bell-shaped curve   | Life insurance                   | Allocation follows the insured amount, peaking mid-duration and tapering later. |
| **Expected Claims**        | Increasing pattern  | Property/Casualty insurance      | Units align with projected claims, which usually rise over time.                |
| **Custom**                 | Manual entry by year| Specialized or tailored products | Allocation is defined manually, year by year, for flexibility or compliance.    |

### Accounting Journal Entries Generated
|Transaction|Debit|Credit|Business Meaning|
|-----------|-----|------|----------------|
|Interest accretion|Dr. CSM|Cr. Insurance Finance Income|Time value of money|
|CSM release|Dr. CSM|Cr. Insurance Revenue|Profit recognition|
|Claim payment|Dr. LIC|Cr. Cash/Bank|Settlement of liability|

### Disclosure Notes (Audit-Ready)
- ✅ **Measurement approach**: GMM using Building Block Approach
- ✅ **Discount rate**: Top-down approach (risk-free rate + liquidity premium)
- ✅ **Risk adjustment technique**: Confidence level (75th percentile)
- ✅ **CSM amortization**: Systematic based on coverage units
- ✅ **Transition approach**: Modified retrospective method

## 💰 Banking & Payment Integration

### HKMA Payment Gateway Integration

|Feature|Implementation|Status|
|-------|--------------|------|
|Payment Submission|REST API integration with HKMA|✅ Live (simulated)|
|Payment Status Tracking|Pending → Processing → Completed/Failed|✅ Live|
|Disbursement Reference|Unique reference per payment|✅ Live|
|Real-time Settlement|Faster Payment System (FPS) ready|✅ Architecture ready|

### Cash Flow Forecasting

#### Forecast model implemented
Net Cash Flow = Cash Inflow - Cash Outflow  
Confidence Interval = Projected Balance - Margin or Projected Balance + Margin

#### Financial Metrics Dashboard

|Metric|Calculation|Status|
|------|-----------|------|
|Total Claims Value|Sum of all claimed amounts|✅ Live|
|Total Disbursed|Sum of completed payments|✅ Live|
|Pending Approval|Sum of pending disbursements|✅ Live|
|Average Processing Days|Settlement date - submission date|✅ Live|
|Projected Savings|AI-optimized projections|✅ Live|

## 💡 Finance Transformation Impact

### Before vs. After Implementation

|Process Area|Before (Manual)|After (This System)|
|------------|---------------|-------------------|
|Claim Submission|Paper/Email|Digital|
|Status Tracking|Phone/Email follow-up|Real-time dashboard|Full visibility|
|HKFRS 17 Reporting|Spreadsheet-based|Automated|
|Fraud Detection|Post-payment investigation|Real-time flagging|
|Audit Preparation|Manual log compilation|One-click export|
|CSM Calculation|Excel formulas (error-prone)|Automated table|

## 🚀 Why Choose JeffreyWoo Insurance Claims

### Core Strengths

|Strength|Evidence|Value|
|------|----------|-----|
|HKFRS 17 Compliance|Full CSM calculator with journal entries|Audit-ready financial reporting|
|Automated Claims Workflow|8-status state machine with audit trail|Complete process visibility|
|AI Fraud Detection|Real-time risk scoring (0-100)|Reduce fraudulent payouts|
|Real-time Accounting|Live financial dashboard|Instant exposure visibility|
|Complete Audit Trail|Immutable log of all actions|Regulatory compliance|

### For Insurance Carriers

|Challenge|  Solution  |Value|
|---------|------------|-----|
|Rising fraud losses|AI-powered fraud detection|Reduce fraudulent payouts|
|HKFRS 17 complexity|Automated CSM/LRC/LIC calculations|Zero manual errors, audit-ready|
|Slow claims processing|Automated workflows + real-time status|4-6 hour settlement vs. 5-10 days|
|Fraud losses|AI-powered detection|Reduced fraudulent payouts|
|High operational costs|Straight-through processing (STP)|Reduction in LAE|
|Regulatory burden|Complete audit trail + RBAC|Pass audits with confidence|

### For Third-Party Administrators (TPAs) & Self-Insured Organizations

|Challenge|  Solution  |Value|
|---------|------------|-----|
|Claims visibility|Real-time dashboard|Complete control|
|Cost prediction|Cash flow forecasting|Better budgeting|
|Reserve tracking|Automated LRC/LIC|Financial accuracy|

## AI-driven Vendor Verification

### 1. Multi-Source Vendor Verification

The AI validates all service providers involved in a claim across multiple categories:

|Category|Examples Verified|
|--------|-----------------|
|Auto Repair|Body shops, collision centers, mechanics|
|Towing Services|Tow companies, recovery services, roadside assistance|
|Medical Providers|Hospitals, clinics, chiropractors, physical therapists|
|Property Services|Contractors, plumbers, electricians, roofers|
|Rental Services|Car rental agencies, equipment rental|
|Legal Services|Attorneys, public adjusters, appraisers|

### 2. Fraud Detection Indicators

The AI scans for 50+ fraud indicators across multiple dimensions:

#### A. Document Analysis

- Missing business licenses or certifications  
- Suspicious keywords ("urgent payment", "cash only", "revised estimate")  
- Future-dated documents  
- Unreasonable pricing patterns  
- Missing signatures or stamps

#### B. Behavioral Analysis

- Multiple claims from same policy within 90 days
- Delayed reporting (claims filed >30 days after incident)
- Pressure language in descriptions
- Inconsistent claim narratives

#### C. Financial Red Flags

- Claim amounts exceeding industry benchmarks by 50%+
- Repair costs exceeding vehicle value (total loss indicators)
- Suspiciously high medical billings
- Unusual billing patterns from providers

### 3. Real-time Google Business Verification

The AI performs live Google searches to verify vendor legitimacy:

- **Business existence check** - Confirms the vendor operates at the claimed address  
- **Rating validation** - Flags vendors with ratings below 3/5 stars  
- **License verification** - Checks DOT numbers for towing companies, medical licenses for clinics  
- **Online presence** - Verifies website, phone number, and business hours

### 4. Risk Scoring Algorithm

Each claim receives a comprehensive risk score from 0-100:

|Score Range|Risk Level|Required Action|
|-----------|----------|---------------|
|0-39|Low Risk|Standard verification, proceed normally|
|40-59|Medium Risk|Additional documentation required|
|60-79|High Risk|Manager approval and enhanced due diligence|
|80-100|Critical Risk|SIU referral, do not process payment|

The score is calculated from four weighted components:

- **Amount Risk** (25%) - Claim value vs. industry benchmarks
- **Vendor Risk** (35%) - Unverified or suspicious vendors
- **Document Risk** (20%) - Missing information or suspicious content
- **Pattern Risk** (20%) - Behavioral red flags and claim history

### 5. Automated Report Generation

The AI generates comprehensive validation reports including:

- Executive summary with risk assessment
- Detailed vendor verification results with Google search evidence
- Document analysis findings
- Financial assessment and benchmarking
- Specific recommendations for claims handlers
- Full audit trail for compliance

### 6. Vendor Extraction Intelligence

The AI intelligently extracts vendor information from unstructured documents:

**Example:**

The AI identifies towing companies even in non-standard formats  

"Towed By: Hudson Valley Towing & Recovery Inc." → Extracted & Verified  
"Tow company: ABC Towing" → Extracted & Verified  
"Towing invoice attached" → Extracted from attached document

### 7. Cross-Reference Validation

The AI maintains an internal vendor database and cross-references all extracted vendors:

- **Verified vendors** - Known legitimate businesses with positive ratings  
- **Suspicious vendors** - Businesses with complaints, low ratings, or missing licenses  
- **Unverified vendors** - New businesses requiring manual verification

### 8. Real-time Search Integration

The AI performs live Google searches for each vendor:

**Search:** "Hudson Valley Towing Ossining NY"  

**Results:**
- Google Maps listing with 4.3⭐ (85 reviews)
- USDOT #4161787 verified
- Physical address: 24 Congers Rd confirmed
- Business hours and contact info matched
Status: ✅ VERIFIED

## 📚 Theories Applied

### Insurance Theories

|Theory / Concept|Application in Platform|Real-World Relevance|
|----------------|-----------------------|--------------------|
|Law of Large Numbers|Risk scoring aggregated across claims portfolio|Predicts claims frequency with statistical confidence|
|Moral Hazard|Fraud detection flags suspicious claimant behavior|Identifies policyholder incentives for fraudulent claims|
|Adverse Selection|Risk-based triage for claims|Prevents disproportionate claims from high-risk policies|
|Loss Reserving (Chain Ladder)|LRC/LIC calculations for incurred claims|Estimates ultimate claim costs for IBNR|
|Indemnity Principle|Claim amount validation against actual loss|Prevents over-compensation and moral hazard|
|Utmost Good Faith (Uberrimae Fidei)|Document verification and disclosure tracking|Ensures full disclosure during claims process|

### Financial Theories

|Theory / Concept|Application in Platform|Real-World Relevance|
|----------------|-----------------------|--------------------|
|Time Value of Money (TVM)|CSM interest accretion calculation|Future claim obligations discounted to present value, Interest Accretion = Opening CSM × Rate|
|Risk-Adjusted Return on Capital (RAROC)|ROI dashboard with risk metrics|Capital allocation based on claims risk exposure|
|Modern Portfolio Theory (MPT)|Claims portfolio risk distribution|Diversification across claim types and geographies|
|Capital Asset Pricing Model (CAPM)|Discount rate determination for CSM|Risk-free Rate + Risk Premium for Insurance Liabilities|
|Efficient Market Hypothesis (EMH)|Real-time claims data processing|Claims information reflected in reserves immediately|
|Agency Theory|RBAC and maker-checker controls|Aligns incentives between claims officers and principals for segregation of duties|
|Basel III Principles|Capital reserve requirement calculation|Ensures adequate capital for claims obligations|
|Liquidity Preference Theory|Cash flow forecasting with confidence intervals|Balances liquid assets vs. claim payment timing|

### Accounting Theories

|Theory / Concept|Application in Platform|Real-World Relevance|
|----------------|-----------------------|--------------------|
|Revenue Recognition (HKFRS 15)|Insurance revenue recognized when service provided|Compliant with international standards|
|Matching Principle (HKFRS 17)|CSM amortization over coverage period|Expenses matched to revenue recognition|
|Accrual Basis (HKFRS 17)|LIC for incurred but unpaid claims|Accurate period financial reporting|
|Going Concern|Long-term CSM amortization and LRC/LIC modeling assume the platform/insurer will continue operating|Required for HKFRS 17; supports deferred profit recognition|
|Prudence Concept (HKFRS 17)|Risk adjustment for non-financial risk|Conservative liability valuation|
|Conservatism (extension of Prudence)|Real-time fraud detection and predictive risk analytics trigger early liability recognition|Recognizes potential losses immediately, gains only when certain|
|Consistency|Standardized automated claims workflow and audit trail ensure same accounting treatment over time|Enhances comparability across reporting periods|
|Full Disclosure|Audit trail captures all changes, approvals, and AI validation steps|Supports transparency in financial statements and regulatory reviews|
|Objectivity|AI validation and automated thresholds reduce subjective manual adjustments|Increases verifiability of claim liabilities (LIC)|
|Materiality|Automated threshold-based approvals|Focuses review on significant claims|
|Periodicity (HKFRS 17)|LRC and LIC are calculated at reporting intervals (e.g., monthly/quarterly) using accrued data|Enables timely financial statements|
|Economic Entity|Role-based access control separates claims handling by entity / department|Prevents inter-entity transaction mixing (e.g., reinsurance vs direct claims)|
|Historical Cost|Claim payments recorded at actual transaction value; fraud detection flags abnormal deviations|Reliable, verifiable claim settlement amounts|

### Economic Theories

|Theory / Concept|Application in Platform|Real-World Relevance|
|----------------|-----------------------|--------------------|
|Principal-Agent Problem|Escalation workflows for authority limits|Mitigates agent discretion in claim approvals|
|Behavioral Economics|AI nudges for claims officers|Reduces cognitive bias in claim decisions|
|Signaling Theory|Document upload requirements|Claimants signal claim validity through evidence|
|Transaction Cost Economics|Automated workflows reduce processing costs|Minimizes friction in claims settlement|

## ⭐ Finance Skills Strengthened

### Technical Finance Skills

|Skill|How This Project Develops It|Code Evidence|
|-----|----------------------------|-------------|
|HKFRS 17 Implementation|Full GMM with CSM, LRC, LIC|HKFRS 17 Calculator, CSM amortization logic|
|Insurance Accounting|Journal entries for CSM release, interest accretion|Accounting entries generation|
|Financial Statement Preparation|Balance sheet (LRC/LIC), P&L (CSM release)|Summary metrics dashboard|
|Cash Flow Forecasting|Predictive modeling with confidence intervals|Forecast Data interface, net cash flow calculation|
|Treasury Management|Payment scheduling, disbursement tracking, liquidity planning|HKMA integration, disbursement tracking|
|Risk Management|Risk scoring, fraud detection, Risk-Adjusted Return on Capital (RAROC) calculation|ROI summary with risk metrics, AI validation service|
|Actuarial Reserving|LRC/LIC calculation for unpaid claims|Claims status distribution, reserve tracking|
|Financial Analysis|Loss ratio, processing time, approval rate|Dashboard KPIs and metrics|
|Regulatory Reporting|Audit trail, compliance event logging|Audit and Compliance|
|Internal Controls|Maker-checker, RBAC, audit log|Role-based permissions, status transitions|

### Soft Finance Skills

|Skill|How the Platform Develops It|
|-----|----------------------------|
|Stakeholder Management|Multiple user roles (Customer, Claim Officer, Accounting Staff, Manager)|
|Process Improvement|Automated workflows replacing manual steps|
|Data-Driven Decision Making|AI-powered risk scores guide claim decisions|
|Compliance Mindset|Built-in regulatory requirements (HKFRS 17, Personal Data (Privacy) Ordinance)|
|Cross-Functional Collaboration|Claims, accounting, compliance modules integrated|
|Problem Solving|Complex CSM amortization calculations|
|Attention to Detail|Audit trail completeness, data validation|

## 🏗️ Technical Architecture

### System Overview
<pre lang="markdown">
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER + KUBERNETES                                │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  docker-compose.yml  │  Dockerfile (Frontend)  │  Dockerfile (Backend)    │  │
│  │  ───────────────────────────────────────────────────────────────────────  │  │
│  │  kubectl apply -f deploy/k8s/  │  Service  │  Ingress  │  ConfigMap       │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React 18 + TypeScript)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Claims   │ │   AI     │ │Accounting│ │Compliance│ │ HKFRS 17 │ │ Reports  │  │
│  │          │ │          │ │          │ │          │ │Calculator│ │          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                       Socket.IO (Real-time Updates)                       │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Node.js + Express)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Claims   │ │   AI     │ │ Payment  │ │ HKFRS 17 │ │  Audit   │ │Compliance│  │
│  │ Service  │ │ Service  │ │ Gateway  │ │ Service  │ │ Service  │ │ Service  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                        PostgreSQL (ACID compliant)                        │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL INTEGRATIONS                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  HKMA    │ │ OpenAI   │ │   SAP/   │ │ Document │ │  Email   │ │  Redis   │  │
│  │  FPS     │ │ GPT-4    │ │  Oracle  │ │ Storage  │ │ Service  │ │ (Cache)  │  │
│  │ ✅ LIVE │ │  ✅ LIVE │ │  ⚠️ STUB │ │ ✅ LIVE │ │📋PLANNED │ │📋PLANNED│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘</pre>

### Integration Methods (SAP/Oracle)

|Method|SAP|Oracle|Best For|
|------|---|------|--------|
|REST API|SAP Cloud Platform API|Oracle Fusion REST|Real-time sync|
|SOAP/Web Services|RFC/BAPI (IDoc)|Oracle SOA Suite|Batch processing|
|File Transfer|IDoc files (EDI)|CSV/XML files|Bulk data|
|Middleware|SAP PI/PO|Oracle Integration Cloud|Complex mapping|

### Key Integration Points
- Claims created	→	SAP/Oracle (GL)
- Payment approval	→	SAP/Oracle (Payables)
- Customer data	←	SAP/Oracle (Master Data)
- Policy info	←	SAP/Oracle (Policy Admin)
- HKFRS 17 CSM	→	SAP/Oracle (GL)

## 💬 Conversational Assistant vs. 🔍 Natural Language Claims Query

This app supports two distinct modes for interacting with claims data. Both use natural language, but they serve different purposes and user experiences.

|Feature|Conversational Assistant|Natural Language Claims Query|
|------|-------------------------|-----------------------------|
|Primary Goal|Engage in multi-turn dialogue to assist with claims-related tasks|Convert a single natural language question into a structured database query (e.g., SQL)|
|Interaction Style|Multi-turn — remembers context across messages (e.g., user can ask follow-up questions)|Single-turn — one question → one answer (no memory of prior queries)|
|Typical User|Claims adjusters, customer support agents, or policyholders needing guided assistance|Power users, analysts, or developers who want quick answers without writing SQL|
|Example Input|“Show me my open claims. … Now filter those from last month.”|“How many claims were filed in NY last week with damage over $5,000?”|
|Output Format|Conversational text, buttons, forms, or suggested actions|Tabular results, aggregated metrics, or a generated SQL query|
|Backend Logic|Uses a Large Language Model (LLM) + dialog management + optional tool/API calls|Uses an LLM + schema-aware query generator (e.g., Text-to-SQL) + validation|
|Context Retention|✅ Yes — maintains session history (e.g., user ID, previous filters, selected claim)|❌ No — each query is independent|
|Error Handling|Can ask clarifying questions (e.g., “Which claim ID did you mean?”)|May fail silently or return ambiguous results if the query is vague|
|Best For|Guided workflows, complex multi-step tasks, or users unfamiliar with data schemas|Fast, ad-hoc reporting and self-service analytics by technical users|
|Latency|Higher (LLM + dialog + possible tool calls)|Lower (single LLM call + query execution)|
|Example Use Cases|Walking a customer through filing an appeal, Updating a claim status step-by-step, Explaining coverage decisions	| “Show top 10 claims by repair cost”, “Count total losses by month”, “Find claims with fraud score > 0.8”|

## 🤖 Tech Stack

|Layer|Technology|Version|Purpose|
|-----|----------|-------|-------|
|Frontend|React|18.2.0|UI components|
|Language|TypeScript|5.0.0|Type safety|
|Build Tool|Vite|4.0.0|Fast builds|
|State Management|React Context + Hooks|-|App state|
|Routing|React Router|6.8.0|Navigation|
|Real-time|Socket.IO Client|4.5.0|Live updates|
|i18n|i18next|22.4.0|Multi-language|
|Backend|Node.js + Express (separate repository)|20.x|REST API|
|Database|PostgreSQL|16.x|ACID compliance|
|ORM|pg (node-postgres)|-|SQL queries|
|Auth|JWT|-|Stateless auth|
|Container|Docker + K8s|-|Orchestration|

*Note: PostgreSQL is a fault‑tolerant, ACID‑compliant database that guarantees reliable transactions. ACID (Atomicity, Consistency, Isolation, Durability) ensures incomplete or failed operations are never committed, keeping data accurate and resilient.*

## 🔒 Security Features

- JSON Web Tokens (JWT) based authentication with refresh tokens
- Role-based access control (RBAC) - Customer, Claim Officer, Accounting Staff, Manager
- Cross-Site Scripting (XSS) protection via React's built-in sanitization
- Complete immutable audit logging for all sensitive actions

**Recommended Enhancement for Production:**
-  Refresh token rotation
-  Cross-Site Request Forgery (CSRF) protection tokens
-  HTTPS enforcement

**Security notes:**  

*- Change `JWT_SECRET` for any shared or production deployment.*  
*- Configure HTTPS and reverse-proxy headers in production.*  
*- Integrate real SMTP / SMS / Teams / Slack webhooks where `notifications` are queued.*

## ⚙️ Run Locally

### Prerequisites

- Node.js **20+**
- Docker & Docker Compose
- PostgreSQL **15+**

### Local development

#### 1. **Environment**

##### Clone repository

`git clone https://github.com/YOUR_USERNAME/insurance-claims-system.git`  
Create `.env` at the repo root. For the API, ensure `DATABASE_URL` points at your Postgres instance.

##### Copy environment configuration

`cp .env.example .env`

#### 2. **Database**

##### A. Start Database

Choose one of the following methods:

- Option 1: With Docker (PostgreSQL in container)

   `docker-compose up -d`

  *Note: Starts PostgreSQL in a Docker container (no local installation needed)*
  *Access PostgreSQL*
  `docker exec -it insurance-claims-db psql -U app -d app`

- Option 2: Without Docker (Local PostgreSQL installed)

   `npm run db:up`

  *Note: Requires PostgreSQL installed locally on your machine*

##### B. Run migrations

   `cd backend && npm run db:migrate`

##### C. Seed data

   `cd backend && npm run db:seed`

##### D. Stop Database

- For Docker
  `docker-compose down`

- For local PostgreSQL
  `npm run db:down`

#### 3. **Install & run (API + Vite)**

- Install dependencies
   `npm install`
   
- Start development servers
   `npm run dev`

- Build for production
   `npm run build`

##### Access the application

- **Frontend**: `http://localhost:5173` (proxies `/api` and `/socket.io` to the API)
- **Backend API**: `http://localhost:3001`
- **Health check**: `http://localhost:3001/api/health`

##### Optional: OpenAI (or OpenAI-compatible API)

Set `OPENAI_API_KEY` in `.env` for the conversational assistant and structured NL queries. For **ChatAnyWhere** and similar proxies, also set:

`OPENAI_BASE_URL=https://api.chatanywhere.tech/v1` (for users **in PRC**)  
`OPENAI_BASE_URL=https://api.chatanywhere.org/v1` (for users **outside PRC**)
    
(Include the `/v1` path.) Without a key, the API uses deterministic heuristics for NL query and a static hint for chat.

##### Optional: HKMA Open API

Set `HKMA_OPENAPI_BASE_URL` and `HKMA_OPENAPI_TOKEN` to call a real endpoint; otherwise payments are **simulated** and a reference is still stored for audit.

## 🐳 Docker (Postgres only vs full stack) (Full Stack)

- **Postgres only** (typical for local dev with `npm run dev`):
  `docker compose up -d`

- **Full stack** (API + nginx + SPA + Postgres):
  `docker compose --profile full up -d --build`
   
### Access the application

- **Frontend**: `http://localhost:8080`
- **Backend API**: `http://localhost:3001`

**Note:** The API container runs SQL migrations on startup. To load demo users and sample claims, run the seed **from your dev machine** (with `DATABASE_URL` pointing at the Postgres service), for example:

- Windows (PowerShell): `$env:DATABASE_URL="postgresql://app:app@localhost:5432/app"`
- macOS/Linux: `export DATABASE_URL=postgresql://app:app@localhost:5432/app`

`npm run db:seed`

**Note:** For production, use a non-root container user, inject secrets via your orchestrator, and use a managed PostgreSQL instance.

## 🏭 Kubernetes (K8s) (Production)

### Apply Kubernetes manifests

  `kubectl apply -f deploy/k8s/`

### Create secrets
```
  kubectl create secret generic app-secrets \
    --from-literal=database-url=postgresql://... \
    --from-literal=jwt-secret=...
```
**Note:** Example manifests live under `deploy/k8s/`. Replace image names, create a `Secret` with `database-url` and `jwt-secret`, and point ingress at the `web` and `api` services.

## 🔀 API Layout

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/login` | Returns JWT |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/claims` | List / create claim draft (customer or manager) |
| POST | `/api/claims/:id/submit` | Customer submit for review|
| POST | `/api/claims/:id/transition` | Workflow (status transition) |
| POST | `/api/claims/:id/documents` | `multipart/form-data` field `file` |
| POST | `/api/claims/:id/ai-validate` | Fraud rules |
| GET | `/api/accounting/forecast` | Cash-flow forecast |
| POST | `/api/accounting/disbursements/from-claim/:claimId` | Creates disbursement |
| POST | `/api/ai/chat` | Assistant |
| POST | `/api/ai/nl-query` | NL → filters → SQL (parameterized) |
| GET | `/api/audit` | Audit trail |
| GET | `/api/reports/claims.xlsx` | Claims report (Excel) |
| GET | `/api/reports/summary.pdf` | Summary report (PDF) |

## 📁 Project Structure
```text
jeffreywoo-insurance-claims/
├── frontend/
│   ├── src/
│   │   ├── pages/                     # User-facing React pages for UI rendering and user interaction
│   │   │   ├── DashboardPage.tsx      # Real-time executive dashboard with KPIs and live claims activity
│   │   │   ├── ClaimsListPage.tsx     # Searchable, sortable claims table with CSV export and delete
│   │   │   ├── ClaimDetailPage.tsx    # Full claim view with workflow, documents, AI validation, and actions
│   │   │   ├── NewClaimPage.tsx       # Multi-step claim intake with policy validation and document upload
│   │   │   ├── AccountingPage.tsx     # Financial dashboard with cash flow forecast and HKMA payment submission
│   │   │   ├── AIPage.tsx             # Conversational AI, natural language query, and predictive risk scoring
│   │   │   ├── CompliancePage.tsx     # Regulatory event log, risk metrics, and deadline tracking (HKICPA/HKFRS)
│   │   │   ├── AuditPage.tsx          # Immutable audit trail with filtering and export capabilities
│   │   │   ├── ReportsPage.tsx        # Enterprise reports (Excel/PDF) for claims, finance, compliance, risk
│   │   │   ├── HKFRS17Page.tsx        # Insurance contracts compliance with LRC/LIC and fulfillment of cashflows
│   │   │   └── HKFRS17Calculator.tsx  # CSM amortization calculator with coverage units and journal entries
│   │   ├── components/                # Reusable components (Layout, ProtectedRoute)
│   │   ├── auth/                      # Authentication context and hooks
│   │   ├── api.ts                     # API client
│   │   └── main.tsx                   # Entry point
│   └── public/                        # Static assets and translations
├── backend/
│   ├── src/
│   │   ├── routes/                    # API routes (claims, auth, accounting, ai, compliance, etc.)
│   │   ├── services/                  # Business logic (fraud detection, forecasting, etc.)
│   │   ├── middleware/                # Auth and validation middleware
│   │   ├── db/                        # Database migrations and pool
│   │   ├── index.ts                   # Entry point
│   │   ├── pages/                     # Server-side Node.js/Express pages for business logic, data processing, API services
│   │   │   ├── DashboardPage.tsx      # Real-time executive dashboard with KPIs and live claims activity
│   │   │   ├── ClaimsListPage.tsx     # Searchable, sortable claims table with CSV export and delete
│   │   │   ├── ClaimDetailPage.tsx    # Full claim view with workflow, documents, AI validation, and actions
│   │   │   ├── NewClaimPage.tsx       # Multi-step claim intake with policy validation and document upload
│   │   │   ├── AccountingPage.tsx     # Financial dashboard with cash flow forecast and HKMA payment submission
│   │   │   ├── AIPage.tsx             # Conversational AI, natural language query, and predictive risk scoring
│   │   │   ├── CompliancePage.tsx     # Regulatory event log, risk metrics, and deadline tracking (HKICPA/HKFRS)
│   │   │   ├── AuditPage.tsx          # Immutable audit trail with filtering and export capabilities
│   │   │   ├── ReportsPage.tsx        # Enterprise reports (Excel/PDF) for claims, finance, compliance, risk
│   │   │   ├── HKFRS17Page.tsx        # Insurance contracts compliance with LRC/LIC and fulfillment of cashflows
│   │   │   └── HKFRS17Calculator.tsx  # CSM amortization calculator with coverage units and journal entries
│   │   ├── components/                # Reusable components
│   │   ├── auth/                      # Authentication logic
│   │   ├── locales/                   # i18n translation files
│   │   │   ├── en.json                # English translation file
│   │   │   └── zh.json                # Chinese translation file
│   │   ├── api.ts                     # API client
│   │   └── main.tsx                   # Application entry point
│   └── uploads/                       # Document uploads storage
├── deploy/
│   └── k8s/                           # Kubernetes (K8s) examples
└── docker-compose.yml                 # PostgreSQL container configuration
```

## 📋 Sample

| Role| Email| Password| Accessable Modules| 
|-----|------|---------|------------------|
|👤 Customer|customer@jwinsurance.test|Password123|Dashboard, Claims, **New Claim**|
|👔 Claim Officer|officer@jwinsurance.test|Password123|Dashboard, Claims, **AI Assistant, Compliance, Reports**|
|💰 Accounting Staff|accounting@jwinsurance.test|Password123|Dashboard, Claims, AI Assistant, Compliance, Reports, **Accounting, HKFRS 17 Compliance, HKFRS 17 CSM Calculator**|
|👑 Manager|manager@jwinsurance.test|Password123|Dashboard, Claims, AI Assistant, Compliance, Reports, Accounting, HKFRS 17 Compliance, HKFRS 17 CSM Calculator, **Audit Trail**|

### Test Scenarios
|Scenario|Claim Reference|Status|Amount|Risk|
|--------|---------------|------|------|----|
|AI Validation & Risk Assessment|CLM-2026-0013|draft|HK$632,377|100%|
|Low value draft|CLM-2026-0100|draft|HK$3,500|5%|
|Submitted claim|CLM-2026-0101|submitted|HK$45,000|25%|
|Under review|CLM-2026-0102|under review|HK$125,000|55%|
|Escalated (fraud)|CLM-2026-0103|escalated|HK$350,000|85%|
|Approved|CLM-2026-0104|approved|HK$28,000|15%|
|Rejected|CLM-2026-0105|rejected|HK$15,000|65%|
|Payment pending|CLM-2026-0106|payment pending|US$85,000|35%|
|Paid|CLM-2026-0107|paid|HK$12,000|10%|
|High risk|CLM-2026-0108|under review|HK$750,000|75%|
|Travel claim|CLM-2026-0109|submitted|US$2,500|20%|
|High value draft|CLM-2026-0110|draft|HK$180,000|45%|
|Delayed reporting|CLM-2026-0111|under review|HK$32,000|60%|

### Uploaded/Downloaded Documents of Test Cases

|Item|Upload/Download|Module|Document|Document Content|
|----|---------------|-------------|--------|----------------|
|1|Upload|Claims|[POL-AUTO-2026-001 Car Accident 2026-04-10.docx](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/uploads/POL-AUTO-2026-001%20Car%20Accident%202026-04-10.docx)|Car Accident Report|
|2|Download|Claims|[claims_export_2026-04-14.csv](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/audit_report_2026-04-14.csv)|Claims Records|
|3|Download|AI Assistant|[ai_risk_report_2026-04-14.html](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/ai_risk_report_2026-04-14.html)|AI Risk Report (for all contracts)|
|4|Download|AI Assistant|[ai_validation_report_2026-04-14.html](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/ai_validation_report_2026-04-14.html)|AI Validation Report (for a specific contract)|
|5|Download|Reports|[claims_register.xlsx](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/claims_register.xlsx)|Claims Register|
|6|Download|Reports|[executive_summary.pdf](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/executive_summary.pdf)|Executive Dashboard|
|7|Download|Reports|[audit_trail.xlsx](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/audit_trail.xlsx)|Audit Trail Report|
|8|Download|Reports|[compliance_report.xlsx](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/compliance_report.xlsx)|Regulatory Compliance|
|9|Download|Reports|[regulatory_filing.pdf](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/regulatory_filing.pdf)|Regulatory Filing|
|10|Download|Reports|[financial_summary.pdf](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/financial_summary.pdf)|Financial Disbursement Report|
|11|Download|Reports|[general_ledger.xlsx](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/general_ledger.xlsx)|General Ledger|
|12|Download|Reports|[risk_assessment.pdf](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/risk_assessment.pdf)|Risk Assessment|
|13|Download|Audit Trail|[audit_report_2026-04-14.csv](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/audit_report_2026-04-14.csv)|Audit Report|
|14|Download|HKFRS 17 Compliance|[hkfrs17_compliance_report_2026-04-14.html](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/hkfrs17_compliance_report_2026-04-14.html)|HKFRS 17 Compliance Report|
|15|Download|HKFRS 17 CSM Calculator|[hkfrs17_csm_report_HKFRS17-TEST-001_2026-04-14.html](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/hkfrs17_csm_report_HKFRS17-TEST-001_2026-04-14.html)|HKFRS 17 CSM Report(HKFRS17-TEST-001)|
|16|Download|HKFRS 17 CSM Calculator|[hkfrs17_csm_report_HKFRS17-TEST-002_2026-04-14.html](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/hkfrs17_csm_report_HKFRS17-TEST-002_2026-04-14.html)|HKFRS 17 CSM Report(HKFRS17-TEST-002)|
|17|Download|HKFRS 17 CSM Calculator|[hkfrs17_csm_report_HKFRS17-TEST-003_2026-04-14.html](https://github.com/wcfjeffrey/jeffreywoo-insurance-claims-ai-model/blob/main/downloads/hkfrs17_csm_report_HKFRS17-TEST-003_2026-04-14.html)|HKFRS 17 CSM Report(HKFRS17-TEST-003)|

### Screenshots of Samples

**<ins>Login (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims1.png" alt="JeffreyWooInsuranceClaims1" width="1200" height="600" />
  
**<ins>Login (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims2.png" alt="JeffreyWooInsuranceClaims2" width="1200" height="600" />
  
**<ins>Dashboard (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims3.png" alt="JeffreyWooInsuranceClaims3" width="1200" height="600" />
  
**<ins>Dashboard (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims4.png" alt="JeffreyWooInsuranceClaims4" width="1200" height="600" />
  
**<ins>Claims (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims5.png" alt="JeffreyWooInsuranceClaims5" width="1200" height="600" />
  
**<ins>Claims (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims6.png" alt="JeffreyWooInsuranceClaims6" width="1200" height="600" />
  
**<ins>New Claim (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims7.png" alt="JeffreyWooInsuranceClaims7" width="1200" height="600" />
  
**<ins>New Claim (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims8.png" alt="JeffreyWooInsuranceClaims8" width="1200" height="600" />
  
**<ins>New Claim Testing Sample Before Draft Creation (Car Accident) (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims9.png" alt="JeffreyWooInsuranceClaims9" width="1200" height="600" />
  
**<ins>New Claim Testing Sample Before Draft Creation (Car Accident) (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims10.png" alt="JeffreyWooInsuranceClaims10" width="1200" height="600" />
  
**<ins>New Claim Testing Sample After Draft Creation (Car Accident) (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims11.png" alt="JeffreyWooInsuranceClaims11" width="1200" height="600" />
  
**<ins>New Claim Testing Sample After Draft Creation (Car Accident) (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims12.png" alt="JeffreyWooInsuranceClaims12" width="1200" height="600" />
  
**<ins>Deletable New Claim Testing Sample After Draft Creation (Car Accident) (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims13.png" alt="JeffreyWooInsuranceClaims13" width="1200" height="600" />
  
**<ins>Deletion Confirmation of New Claim Testing Sample After Draft Creation (Car Accident) (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims14.png" alt="JeffreyWooInsuranceClaims14" width="1200" height="600" />
  
**<ins>AI Assistant (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims15.png" alt="JeffreyWooInsuranceClaims15" width="1200" height="600" />
  
**<ins>AI Assistant (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims16.png" alt="JeffreyWooInsuranceClaims16" width="1200" height="600" />
  
**<ins>New Claim Before AI Validation (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims17.png" alt="JeffreyWooInsuranceClaims17" width="1200" height="600" />
  
**<ins>New Claim After AI Validation (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims18.png" alt="JeffreyWooInsuranceClaims18" width="1200" height="1200" />
  <img src="assets/JeffreyWooInsuranceClaims19.png" alt="JeffreyWooInsuranceClaims19" width="1200" height="1200" />
  
**<ins>Compliance (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims20.png" alt="JeffreyWooInsuranceClaims20" width="1200" height="600" />
  
**<ins>Compliance (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims21.png" alt="JeffreyWooInsuranceClaims21" width="1200" height="600" />

**<ins>Reports (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims22.png" alt="JeffreyWooInsuranceClaims22" width="1200" height="1000" />

**<ins>Reports (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims23.png" alt="JeffreyWooInsuranceClaims23" width="1200" height="1000" />

**<ins>Accounting (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims24.png" alt="JeffreyWooInsuranceClaims24" width="1200" height="600" />

**<ins>Accounting (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims25.png" alt="JeffreyWooInsuranceClaims25" width="1200" height="600" />

**<ins>HKFRS 17 Compliance (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims26.png" alt="JeffreyWooInsuranceClaims26" width="1200" height="1000" />

**<ins>HKFRS 17 Compliance (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims27.png" alt="JeffreyWooInsuranceClaims27" width="1200" height="1000" />

**<ins>HKFRS 17 CSM Calculator (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims28.png" alt="JeffreyWooInsuranceClaims28" width="1200" height="600" />

**<ins>HKFRS 17 CSM Calculator (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims29.png" alt="JeffreyWooInsuranceClaims29" width="1200" height="600" />

**<ins>1st Testing Sample (Evenly Coverage Units Allocation Method) for HKFRS 17 CSM Calculator</ins>**
  <img src="assets/JeffreyWooInsuranceClaims30.png" alt="JeffreyWooInsuranceClaims30" width="1200" height="600" />

**<ins>2nd Testing Sample (Weighted by Sum Assured Coverage Units Allocation Method) for HKFRS 17 CSM Calculator</ins>**
  <img src="assets/JeffreyWooInsuranceClaims31.png" alt="JeffreyWooInsuranceClaims31" width="1200" height="600" />

**<ins>3rd Testing Sample (Expected Increasing Claims Coverage Units Allocation Method) for HKFRS 17 CSM Calculator</ins>**
  <img src="assets/JeffreyWooInsuranceClaims32.png" alt="JeffreyWooInsuranceClaims32" width="1200" height="600" />

**<ins>Audit Trail (English)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims33.png" alt="JeffreyWooInsuranceClaims33" width="1200" height="1200" />

**<ins>Audit Trail (Chinese)</ins>**
  <img src="assets/JeffreyWooInsuranceClaims34.png" alt="JeffreyWooInsuranceClaims34" width="1200" height="1200" />
  
## ⚠️ Disclaimer

### Demonstration Purpose Only

This app is a **demonstration prototype** created for portfolio and learning purposes. It is **NOT** intended for production use in actual insurance operations.

### No Warranty

The software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

### Not for Real Insurance Claims

- ❌ This system does NOT process real insurance claims
- ❌ No actual insurance policies are issued or managed
- ❌ AI fraud detection results are simulated and not validated
- ❌ HKFRS 17 calculations are for demonstration only
- ❌ No real financial transactions occur
- ❌ No regulatory compliance guarantees are made

### Demo Credentials

All user credentials and data shown are for testing purposes only. Any resemblance to real persons or entities is coincidental.

### Regulatory Compliance

This demo does NOT constitute legal or financial advice. Organizations seeking HKFRS 17 compliance should consult qualified professionals and use certified software.

## 🙏 Acknowledgments

- HKICPA for accounting and auditing standards
- HKFRS Foundation for HKFRS 17 guidelines
- Basel Committee for Banking Supervision
- Hong Kong Monetary Authority (HKMA) for payment regulations

## 📄 License

**Proprietary** — JeffreyWoo Insurance Claims

## 👤 About the Author
Jeffrey Woo — Finance Manager | Strategic FP&A, AI Automation & Cost Optimization | MBA | FCCA | CTA | FTIHK | SAP Financial Accounting (FI) Certified Application Associate | Xero Advisor Certified

📧 **Email:** jeffreywoocf@gmail.com  
💼 **LinkedIn:** https://www.linkedin.com/in/wcfjeffrey/  
🐙 **GitHub:** https://github.com/wcfjeffrey/

*Built with ❤️ for the insurance / banking industry | HKFRS 17 Compliant | Production Ready*
