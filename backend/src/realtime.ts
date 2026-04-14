import type { Server } from "socket.io";

let io: Server | null = null;

export function setSocketIO(server: Server): void {
  io = server;
}

export function emitClaimUpdate(
  claimId: string,
  payload: Record<string, unknown>,
): void {
  io?.emit("claim:update", { claimId, ...payload, ts: Date.now() });
}

export function emitDashboardRefresh(topic: string): void {
  io?.emit("dashboard:refresh", { topic, ts: Date.now() });
}
