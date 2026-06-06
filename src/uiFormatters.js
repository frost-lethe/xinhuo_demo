export function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
