export type PricePostView = {
  id: string
  createdAt: string
  anonymous: boolean
  unit: string | null
  unitQuantity: string | null
  priceExact: string | null
  priceMin: string | null
  priceMax: string | null
  latitude: number
  longitude: number
  locationLabel: string | null
  product: {
    id: string
    name: string
    brand: string | null
    slug: string
    unit: string | null
    unitQuantity: string | null
    category: { id: string; name: string; slug: string } | null
  }
  establishment: {
    id: string
    name: string
    slug: string
    addressLine: string | null
    barangay: string | null
    city: string | null
  }
  user: { id: string; name: string | null; image: string | null } | null
  canEdit?: boolean
  canDelete?: boolean
}
