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

export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "failed"

export type Tenant = {
  id: string
  landlord_id: string
  full_name: string
  email: string | null
  phone: string | null
  pan: string | null
  aadhaar_last4: string | null
  verification_status: VerificationStatus | null
  verified_at: string | null
  created_at: string
}

export type CoTenant = {
  id: string
  landlord_id: string
  tenant_id: string
  full_name: string
  relation: string | null
  phone: string | null
  email: string | null
  same_address: boolean
  created_at: string
}

export type TenantReference = {
  id: string
  landlord_id: string
  tenant_id: string
  full_name: string
  relation: string | null
  phone: string | null
  email: string | null
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
  increment_pct: number | string | null
  increment_months: number | null
  last_revised_date: string | null
  deposit_returned: number | string | null
  final_settlement_date: string | null
  settlement_notes: string | null
  created_at: string
}

export type UtilityBilling = "metered" | "fixed"

export type LeaseUtility = {
  id: string
  landlord_id: string
  lease_id: string
  kind: string
  billing: UtilityBilling
  rate: number | string
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
  period_start: string | null
  period_end: string | null
  status: RentChargeStatus
  created_at: string
}

// A rent charge enriched with the tenant name, returned by the calendar route.
export type CalendarCharge = {
  id: string
  lease_id: string
  amount: number | string
  amount_paid: number | string
  due_date: string
  paid_date: string | null
  status: RentChargeStatus
  tenant_name: string
}

// One month of the collections trend (from /reports/trends).
export type MonthTrend = {
  month: string
  collected: number
  expected: number
  outstanding: number
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
  late_fee: number | string
  remarks: string | null
  receipt_no: string | null
  created_at: string
}

export type ExpenseCategory =
  | "mortgage"
  | "taxes"
  | "insurance"
  | "repairs"
  | "landscape"
  | "pest_control"
  | "management_fee"
  | "appliance"
  | "utilities"
  | "other"

export type RecurInterval = "monthly" | "quarterly" | "yearly"

export type Expense = {
  id: string
  landlord_id: string
  property_id: string | null
  lease_id: string | null
  category: ExpenseCategory
  title: string | null
  amount: number | string
  spent_on: string
  is_recurring: boolean
  recur_interval: RecurInterval | null
  tenant_payable: boolean
  paid: boolean
  receipt_url: string | null
  remarks: string | null
  created_at: string
}

export type ExpenseCategoryTotal = {
  category: ExpenseCategory
  total: number
}

export type ExpenseSummary = {
  total: number
  paid_total: number
  unpaid_total: number
  tenant_payable_total: number
  count: number
  by_category: ExpenseCategoryTotal[]
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
