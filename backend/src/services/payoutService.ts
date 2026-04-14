/** HKD-focused payout with simple tax and FX hooks */

const DEFAULT_TAX_RATE = Number(process.env.DEFAULT_TAX_RATE ?? 0);

export type PayoutBreakdown = {
  gross: number;
  taxAmount: number;
  net: number;
  currency: string;
  fxRate: number;
  baseCurrency: string;
};

export function computePayout(
  approvedAmount: number,
  currency: string,
  options?: { fxRate?: number; taxRate?: number; baseCurrency?: string },
): PayoutBreakdown {
  const baseCurrency = options?.baseCurrency ?? "HKD";
  const fxRate =
    options?.fxRate ?? (currency === baseCurrency ? 1 : Number(process.env.DEFAULT_FX_RATE ?? 1));
  const taxRate = options?.taxRate ?? DEFAULT_TAX_RATE;
  const gross = Math.round(approvedAmount * fxRate * 100) / 100;
  const taxAmount = Math.round(gross * taxRate * 100) / 100;
  const net = Math.round((gross - taxAmount) * 100) / 100;
  return {
    gross,
    taxAmount,
    net,
    currency,
    fxRate,
    baseCurrency,
  };
}
