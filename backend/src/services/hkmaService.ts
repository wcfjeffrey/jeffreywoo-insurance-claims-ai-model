/**
 * Placeholder for HKMA Open API payment automation.
 * Replace HKMA_OPENAPI_BASE_URL and credentials for production.
 */

export type HkmaPaymentRequest = {
  disbursementId: string;
  amount: number;
  currency: string;
  creditorAccount: string;
  reference: string;
};

export type HkmaPaymentResult = {
  status: "accepted" | "simulated";
  reference: string;
  payload: Record<string, unknown>;
};

export async function submitHkmaPayment(
  req: HkmaPaymentRequest,
): Promise<HkmaPaymentResult> {
  const base = process.env.HKMA_OPENAPI_BASE_URL;
  if (!base) {
    return {
      status: "simulated",
      reference: `HKMA-SIM-${Date.now()}`,
      payload: {
        message: "HKMA_OPENAPI_BASE_URL not set — simulated acceptance",
        request: req,
      },
    };
  }

  const res = await fetch(`${base.replace(/\/$/, "")}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HKMA_OPENAPI_TOKEN ?? ""}`,
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HKMA API error: ${res.status} ${t}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    status: "accepted",
    reference: String(data.reference ?? ""),
    payload: data,
  };
}
