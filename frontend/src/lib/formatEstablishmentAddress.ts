export function formatEstablishmentAddress(e: {
  addressLine: string | null
  barangay: string | null
  city: string | null
}): string | null {
  const parts = [e.addressLine, e.barangay, e.city].filter((x): x is string => Boolean(x?.trim()))
  return parts.length ? parts.join(' · ') : null
}
