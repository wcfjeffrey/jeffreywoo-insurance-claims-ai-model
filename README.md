# JeffreyWoo Insurance Claims

Full-stack **AI-assisted insurance claim and accounting** platform: Node.js (Express) API, React (Vite) UI, PostgreSQL, optional OpenAI features, Socket.io for live dashboards, Docker/Kubernetes-oriented deployment.

## Features (summary)

| Area | Implementation |
|------|------------------|
| **Roles** | Customer, Claim Officer, Accounting Staff, Manager — JWT auth + route guards |
| **Claims** | Draft → submit → review → escalate → approve/reject → payment pipeline; document uploads |
| **AI** | Rule-based fraud/coverage scoring; optional GPT for chat and natural-language claim filters |
| **Accounting** | Payout calculation (tax/FX hooks), cash-flow forecast, ledger sync stub (SAP/Oracle-style), ROI summary |
| **HKMA** | Payment submission adapter (simulated when `HKMA_OPENAPI_BASE_URL` is unset) |
| **Compliance** | Event log (IFRS/Basel-style hooks); manager monitoring endpoint |
| **Audit** | `audit_log` on key actions; manager UI |
| **Exports** | Excel (claims), PDF summary |
| **i18n** | English / 中文 (UI strings) |
| **Realtime** | Socket.io `claim:update` for dashboard refresh |

## Prerequisites

- Node.js **20+**
- PostgreSQL **16** (local install or Docker)
- Optional: Docker for DB-only or full stack; optional OpenAI API key

## Local development

1. **Environment**

   Copy `.env.example` to `.env` at the repo root. For the API, ensure `DATABASE_URL` points at your Postgres instance.

   ```bash
   cp .env.example .env
   ```

2. **Database**

   ```bash
   npm run db:up
   ```

3. **Install & run (API + Vite)**

   ```bash
   npm install
   npm run dev
   ```

   - API: `http://localhost:3001`
   - UI: `http://localhost:5173` (proxies `/api` and `/socket.io` to the API)

4. **Seed demo users & sample claims**

   ```bash
   npm run db:seed
   ```

### Demo accounts (after seed)

| Email | Role | Password |
|-------|------|----------|
| `customer@jwinsurance.test` | Customer | `Password123` |
| `officer@jwinsurance.test` | Claim Officer | `Password123` |
| `accounting@jwinsurance.test` | Accounting Staff | `Password123` |
| `manager@jwinsurance.test` | Manager | `Password123` |

Sample claims `CLM-2026-0001`–`0003` are created for the customer (mixed statuses, fraud scores).

### Optional: OpenAI (or OpenAI-compatible API)

Set `OPENAI_API_KEY` in `.env` for the conversational assistant and structured NL queries. For **ChatAnyWhere** and similar proxies, also set:

`OPENAI_BASE_URL=https://api.chatanywhere.tech/v1`

(Include the `/v1` path.) Without a key, the API uses deterministic heuristics for NL query and a static hint for chat.

### Optional: HKMA Open API

Set `HKMA_OPENAPI_BASE_URL` and `HKMA_OPENAPI_TOKEN` to call a real endpoint; otherwise payments are **simulated** and a reference is still stored for audit.

## Docker (Postgres only vs full stack)

- **Postgres only** (typical for local dev with `npm run dev`):

  ```bash
  docker compose up -d
  ```

- **Full stack** (API + nginx + SPA + Postgres):

  ```bash
  docker compose --profile full up -d --build
  ```

  - UI: `http://localhost:8080`
  - API direct: `http://localhost:3001`

  The API container runs SQL migrations on startup. To load demo users and sample claims, run the seed **from your dev machine** (with `DATABASE_URL` pointing at the Postgres service), for example:

  ```bash
  # Windows (PowerShell): $env:DATABASE_URL="postgresql://app:app@localhost:5432/app"
  # macOS/Linux: export DATABASE_URL=postgresql://app:app@localhost:5432/app
  npm run db:seed
  ```

  For production, use a non-root container user, inject secrets via your orchestrator, and use a managed PostgreSQL instance.

## Kubernetes

Example manifests live under `deploy/k8s/`. Replace image names, create a `Secret` with `database-url` and `jwt-secret`, and point ingress at the `web` and `api` services.

## API layout (selected)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/login` | Returns JWT |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/claims` | List / create (customer or manager) |
| POST | `/api/claims/:id/submit` | Customer submit |
| POST | `/api/claims/:id/transition` | Workflow |
| POST | `/api/claims/:id/documents` | `multipart/form-data` field `file` |
| POST | `/api/claims/:id/ai-validate` | Fraud rules |
| GET | `/api/accounting/forecast` | Cash-flow forecast |
| POST | `/api/accounting/disbursements/from-claim/:claimId` | Creates disbursement |
| POST | `/api/ai/chat` | Assistant |
| POST | `/api/ai/nl-query` | NL → filters → SQL (parameterized) |
| GET | `/api/reports/claims.xlsx` | Excel |
| GET | `/api/reports/summary.pdf` | PDF |

## Project structure

```
backend/          Express API, services, migrations
backend/db/       SQL migrations + optional seed SQL
frontend/         React SPA (Vite)
docker/           Dockerfiles + nginx for SPA
deploy/k8s/       Kubernetes examples
```

## Security notes

- Change `JWT_SECRET` for any shared or production deployment.
- Configure HTTPS and reverse-proxy headers in production.
- Integrate real SMTP / SMS / Teams / Slack webhooks where `notifications` are queued.

## License

Proprietary — JeffreyWoo Insurance Claims (demo / internal use).
