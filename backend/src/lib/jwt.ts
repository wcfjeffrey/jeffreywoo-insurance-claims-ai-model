import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "../domain/roles.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-insecure-change-me";
const JWT_EXPIRES_SEC = Number(process.env.JWT_EXPIRES_SEC ?? 8 * 3600);

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  fullName: string;
};

export function signToken(payload: JwtPayload): string {
  const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_SEC };
  return jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      fullName: payload.fullName,
    },
    JWT_SECRET,
    signOptions,
  );
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & {
    role: UserRole;
    fullName: string;
  };
  return {
    sub: decoded.sub as string,
    email: decoded.email as string,
    role: decoded.role,
    fullName: decoded.fullName,
  };
}
