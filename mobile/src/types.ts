// Shared types that mirror the backend's property & unit records.

export type Property = {
  id: string
  landlord_id: string
  name: string
  address: string | null
  created_at: string
}

export type Unit = {
  id: string
  landlord_id: string
  property_id: string
  unit_number: string
  description: string | null
  bedrooms: number | null
  bathrooms: number | null
  created_at: string
}
