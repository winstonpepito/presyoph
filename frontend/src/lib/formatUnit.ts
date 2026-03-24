/** Trim numeric string for display (e.g. "1.500000" → "1.5"). */
function trimQty(s: string): string {
  const n = Number(s)
  if (Number.isNaN(n)) return s
  return String(n)
}

/**
 * Short label for what the price applies to (e.g. "per 1.5 L", "per piece").
 */
export function formatPerUnit(
  unit: string | null | undefined,
  unitQuantity: string | null | undefined,
): string {
  if (!unit && (unitQuantity == null || unitQuantity === '')) return ''
  const u = unit ?? 'pcs'
  const qRaw = unitQuantity != null && unitQuantity !== '' ? String(unitQuantity) : '1'
  const n = Number(qRaw)
  if (Number.isNaN(n) || n <= 0) return ''

  if (u === 'pcs') {
    if (n === 1) return 'per piece'
    return `per ${trimQty(qRaw)} pcs`
  }
  if (u === 'dozen') {
    if (n === 1) return 'per dozen'
    return `per ${trimQty(qRaw)} dozen`
  }
  if (u === 'bundle') {
    return n === 1 ? 'per bundle' : `per ${trimQty(qRaw)} bundles`
  }
  return `per ${trimQty(qRaw)} ${u}`
}

/** Same as {@link formatPerUnit} but without the leading "per " (for compact tags). */
export function formatUnitSummary(
  unit: string | null | undefined,
  unitQuantity: string | null | undefined,
): string {
  const s = formatPerUnit(unit, unitQuantity)
  return s.startsWith('per ') ? s.slice(4) : s
}
