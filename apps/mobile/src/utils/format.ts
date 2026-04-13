/**
 * Format centavos as "$1,234.50" MXN peso string.
 * Uses integer arithmetic — no floating-point rounding errors.
 */
export function formatMXN(centavos: number): string {
  const negative = centavos < 0;
  const abs = Math.abs(centavos);
  const pesos = Math.floor(abs / 100);
  const cents = abs % 100;
  const intStr = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const centStr = cents.toString().padStart(2, '0');
  return `${negative ? '-' : ''}$${intStr}.${centStr}`;
}

/**
 * Format CLABE as three groups of six for readability.
 * "645180026782123456" → "645180 026782 123456"
 */
export function formatCLABE(clabe: string): string {
  return clabe.replace(/(\d{6})(\d{6})(\d{6})/, '$1 $2 $3');
}

/**
 * Format an ISO date as a locale-aware time string.
 * "2024-01-15T10:30:00Z" → "10:30"
 */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format an ISO date as "15 ene · 10:30".
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  }) + ' · ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format seconds remaining as "MM:SS".
 */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Calculate effective fee percentage string for display.
 */
export function feePercent(amountCentavos: number, feeCentavos: number): string {
  if (amountCentavos <= 0) return '0.00%';
  return ((feeCentavos / amountCentavos) * 100).toFixed(2) + '%';
}
