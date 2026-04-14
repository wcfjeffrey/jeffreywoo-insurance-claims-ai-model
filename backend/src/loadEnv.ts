import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load `.env` from monorepo root and `backend/.env` so `npm run dev -w backend`
 * still sees variables when the shell cwd is `backend/`.
 */
export function loadEnv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const rootEnv = path.resolve(here, "../../.env");
  const backendEnv = path.resolve(here, "../.env");
  dotenv.config({ path: rootEnv });
  dotenv.config({ path: backendEnv, override: true });
}
