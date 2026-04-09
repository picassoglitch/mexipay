const MINIMUM_FEE_CENTAVOS = 600;
const FEE_RATE_BP = 180;
const BP_DIVISOR = 10_000;

export function calculateFeeDisplay(amountCentavos: number): {
  feeMXN: string;
  netMXN: string;
} {
  const pctFee = Math.round((amountCentavos * FEE_RATE_BP) / BP_DIVISOR);
  const feeCentavos = Math.max(MINIMUM_FEE_CENTAVOS, pctFee);
  const netCentavos = amountCentavos - feeCentavos;
  return {
    feeMXN: (feeCentavos / 100).toFixed(2),
    netMXN: (netCentavos / 100).toFixed(2),
  };
}
