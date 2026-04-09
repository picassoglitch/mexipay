/**
 * MexiPay fee schedule
 *
 * Fee = max($6.00 MXN flat minimum, 1.8% of transaction amount)
 *
 * All values in centavos (1 MXN = 100 centavos).
 * Using integer arithmetic throughout to avoid floating-point rounding errors.
 */

const MINIMUM_FEE_CENTAVOS = 600; // $6.00 MXN
const FEE_RATE_BP = 180; // 1.80% expressed as basis points (1 bp = 0.01%)
const BP_DIVISOR = 10_000;

export interface FeeBreakdown {
  amountCentavos: number;
  feeCentavos: number;
  netCentavos: number;
  feePercent: string;
}

/**
 * Calculate MexiPay's processing fee for a given amount.
 *
 * @param amountCentavos  Gross charge amount in Mexican centavos (must be > 0)
 * @returns               Breakdown with fee, net amount, and effective rate string
 */
export function calculateFee(amountCentavos: number): FeeBreakdown {
  if (!Number.isInteger(amountCentavos) || amountCentavos <= 0) {
    throw new RangeError(`amountCentavos must be a positive integer, got ${amountCentavos}`);
  }

  // 1.8% fee rounded to nearest centavo
  const percentageFee = Math.round((amountCentavos * FEE_RATE_BP) / BP_DIVISOR);

  // Take whichever is larger: the flat minimum or the percentage fee
  const feeCentavos = Math.max(MINIMUM_FEE_CENTAVOS, percentageFee);

  const netCentavos = amountCentavos - feeCentavos;

  // Effective rate string for display ("1.80%" or higher for small amounts)
  const effectiveRate = ((feeCentavos / amountCentavos) * 100).toFixed(2);

  return {
    amountCentavos,
    feeCentavos,
    netCentavos,
    feePercent: `${effectiveRate}%`,
  };
}

/**
 * Format centavos as a human-readable MXN string ("$12.50 MXN")
 */
export function formatMXN(centavos: number): string {
  return `$${(centavos / 100).toFixed(2)} MXN`;
}
