import type { UserRole } from "../domain/roles.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        fullName: string;
      };
    }
  }
}

export {};
