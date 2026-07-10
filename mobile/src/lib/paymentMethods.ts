import type { PaymentMethod } from "../types"

// Payment channels with their display label + icon. Shared by the collect and
// history screens so icons/labels never drift apart.
export const PAYMENT_METHODS: {
  value: PaymentMethod
  label: string
  icon: string
}[] = [
  { value: "cash", label: "Cash", icon: "💵" },
  { value: "upi", label: "UPI", icon: "📱" },
  { value: "bank_transfer", label: "Bank", icon: "🏦" },
  { value: "card", label: "Card", icon: "💳" },
  { value: "other", label: "Other", icon: "🧾" },
]

export function paymentMethodMeta(method: PaymentMethod): {
  value: PaymentMethod
  label: string
  icon: string
} {
  return (
    PAYMENT_METHODS.find((m) => m.value === method) ?? {
      value: method,
      label: "Other",
      icon: "🧾",
    }
  )
}