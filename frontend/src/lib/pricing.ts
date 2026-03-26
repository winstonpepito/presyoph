export function comparablePrice(
  priceExact: string | null | undefined,
  priceMin: string | null | undefined,
  priceMax: string | null | undefined,
): number {
  if (priceExact != null && priceExact !== '') return Number(priceExact)
  if (priceMin != null && priceMin !== '') return Number(priceMin)
  if (priceMax != null && priceMax !== '') return Number(priceMax)
  return Number.POSITIVE_INFINITY
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(amount)
}

/** Same display rules as price lines on post cards (exact vs min–max). */
export function formatPricePostLabel(p: {
  priceExact: string | null | undefined
  priceMin: string | null | undefined
  priceMax: string | null | undefined
}): string {
  if (p.priceExact != null && p.priceExact !== '') {
    return formatPrice(Number(p.priceExact))
  }
  if (p.priceMin != null && p.priceMin !== '' && p.priceMax != null && p.priceMax !== '') {
    return `${formatPrice(Number(p.priceMin))} – ${formatPrice(Number(p.priceMax))}`
  }
  return '—'
}
