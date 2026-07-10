import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useLayoutEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { AppButton, CenteredMessage, ErrorText, Field } from "../components/ui"
import { DatePickerField } from "../components/DatePickerField"
import { apiFetch } from "../lib/api"
import { formatMoney } from "../lib/format"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { PaymentMethod, RentCharge } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "RentCollect">

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
]

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export default function RentCollectScreen({ route, navigation }: Props) {
  const { chargeId, leaseId } = route.params

  const [charge, setCharge] = useState<RentCharge | null>(null)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [paidDate, setPaidDate] = useState(todayISO())
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Collect Rent" })
  }, [navigation])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const charges = await apiFetch<RentCharge[]>(
          `/api/v1/rent-charges?lease_id=${leaseId}`
        )
        if (!active) return
        const found = charges.find((c) => c.id === chargeId) ?? null
        setCharge(found)
        if (found) {
          const remaining =
            Number(found.amount) - Number(found.amount_paid ?? 0)
          setAmount(String(Math.max(remaining, 0)))
        }
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : "Failed to load charge.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [chargeId, leaseId])

  async function handleSave() {
    setError(null)
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount greater than 0.")
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
      setError("Date must be in YYYY-MM-DD format.")
      return
    }

    const payload: Record<string, unknown> = {
      rent_charge_id: chargeId,
      amount: amt,
      method,
      paid_date: paidDate,
    }
    const ref = reference.trim()
    const n = note.trim()
    if (ref) payload.reference = ref
    if (n) payload.note = n

    setSaving(true)
    try {
      await apiFetch("/api/v1/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      navigation.goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record payment.")
      setSaving(false)
    }
  }

  if (loading) return <CenteredMessage loading text="Loading…" />

  if (!charge) {
    return (
      <CenteredMessage
        error
        text="Charge not found"
        subtext="It may have been removed. Go back and try again."
      />
    )
  }

  const remaining = Number(charge.amount) - Number(charge.amount_paid ?? 0)

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Remaining balance</Text>
        <Text style={styles.summaryValue}>{formatMoney(remaining)}</Text>
        <Text style={styles.summarySub}>
          {formatMoney(charge.amount_paid)} paid of {formatMoney(charge.amount)}
        </Text>
      </View>

      <Field
        label="Amount received *"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0"
        editable={!saving}
      />

      <Text style={styles.fieldLabel}>Method</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => {
          const selected = method === m.value
          return (
            <TouchableOpacity
              key={m.value}
              style={[styles.pill, selected ? styles.pillSelected : null]}
              onPress={() => setMethod(m.value)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.pillText,
                  selected ? styles.pillTextSelected : null,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={styles.spacerSm} />
      <DatePickerField
        label="Paid date"
        value={paidDate}
        onChange={setPaidDate}
        editable={!saving}
      />
      <Field
        label="Reference (optional)"
        value={reference}
        onChangeText={setReference}
        placeholder="e.g. UPI txn id"
        editable={!saving}
      />
      <Field
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Any details to remember"
        multiline
        editable={!saving}
      />

      {error ? <ErrorText text={error} /> : null}

      <View style={styles.spacerMd} />
      <AppButton
        title="Record Payment"
        onPress={handleSave}
        loading={saving}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryLabel: { color: colors.white, opacity: 0.85, fontSize: 14 },
  summaryValue: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  summarySub: {
    color: colors.white,
    opacity: 0.85,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  methodRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: { fontSize: 14, fontWeight: "600", color: colors.text },
  pillTextSelected: { color: colors.white },
  spacerSm: { height: spacing.sm },
  spacerMd: { height: spacing.md },
})
