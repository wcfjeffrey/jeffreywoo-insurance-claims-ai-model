import pg from "pg";
import { loadEnv } from "../loadEnv.js";

loadEnv();

const url = process.env.DATABASE_URL;
if (!url || typeof url !== "string" || !url.trim()) {
  console.error(
    "DATABASE_URL is missing or invalid. Set it in the repo root `.env` (e.g. postgresql://app:app@localhost:5432/app for local Postgres).",
  );
  process.exit(1);
}

export const pool = new pg.Pool({
  connectionString: url,
  max: 20,
});
