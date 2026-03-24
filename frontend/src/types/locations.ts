export type CityWithBarangays = {
  id: string
  slug: string
  name: string
  barangays: { id: string; name: string }[]
}

export type LocationsPayload = {
  defaultCitySlug: string
  cities: CityWithBarangays[]
}
