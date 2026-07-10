// Shared types that mirror the backend records.
// Note: Postgres `numeric` columns can arrive as strings over the wire, so
// money-ish fields are typed `number | string` and should be run through
// Number()/formatMoney() before display or math.

export type PropertyType = "residential" | "commercial"
export type Furnishing = "unfurnished" | "semi_furnished" | "furnished"

export type Property = {
  id: string
  landlord_id: string
  name: string
  address: string | null
  // Batch 1 metadata (all optional / nullable).
  property_type: PropertyType | null
  furnishing: Furnishing | null
  maps_link: string | null
  floors: number | null
  area_sqft: number | string | null
  amenities: string | null
  owner_name: string | null
  owner_phone: string | null
  owner_email: string | null
  owner_pan: string | null
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

export type Tenant = {
  id: string
  landlord_id: string
  full_name: string
  email: string | null
  phone: string | null
  created_at: string
}

export type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly"
export type BillingMode = "prepaid" | "postpaid"
export type LeaseStatus = "active" | "ended"

export type Lease = {
  id: string
  landlord_id: string
  unit_id: string
  tenant_id: string
  rent_amount: number | string
  deposit: number | string
  start_date: string
  end_date: string | null
  billing_cycle: BillingCycle
  billing_mode: BillingMode
  status: LeaseStatus
  created_at: string
}

export type RentChargeStatus = "due" | "paid" | "partial"

export type RentCharge = {
  id: string
  landlord_id: string
  lease_id: string
  amount: number | string
  amount_paid: number | string
  due_date: string
  paid_date: string | null
  status: RentChargeStatus
  created_at: string
}

export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "card" | "other"

export type Payment = {
  id: string
  landlord_id: string
  rent_charge_id: string
  lease_id: string | null
  amount: number | string
  method: PaymentMethod
  paid_date: string
  reference: string | null
  note: string | null
  receipt_no: string | null
  created_at: string
}

export type MaintenanceStatus = "open" | "in_progress" | "closed"

export type MaintenanceTicket = {
  id: string
  landlord_id: string
  unit_id: string
  title: string
  description: string | null
  status: MaintenanceStatus
  created_at: string
}

export type OutstandingByProperty = {
  property_id: string | null
  property_name: string
  outstanding: number
}

export type Summary = {
  month: string
  collected_this_month: number
  expected_this_month: number
  outstanding_total: number
  outstanding_charges: number
  outstanding_by_property: OutstandingByProperty[]
  properties: number
  units: number
  occupied: number
  occupancy_pct: number
  tickets_open: number
}

// --- Stage 4: notifications ---
export type NotificationType =
  | "payment"
  | "partial"
  | "due"
  | "overdue"
  | "ticket_new"
  | "ticket_status"
  | "lease_new"
  | "lease_expiring"
  | "tenant_change"
  | "summary"

export type SummaryFrequency = "off" | "daily" | "weekly"

// Public shape returned by GET/PATCH /notifications/settings (no secrets).
export type NotificationSettings = {
  telegram_linked: boolean
  notify_payment: boolean
  notify_partial: boolean
  notify_due: boolean
  notify_overdue: boolean
  notify_ticket_new: boolean
  notify_ticket_status: boolean
  notify_lease_new: boolean
  notify_lease_expiring: boolean
  notify_tenant_change: boolean
  notify_summary: boolean
  summary_frequency: SummaryFrequency
}
