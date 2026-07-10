import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useLayoutEffect, useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { DateField } from "../components/DateField"
import { AppButton, CenteredMessage, ErrorText, Field } from "../components/ui"
import { apiFetch } from "../lib/api"
import {
  digitsOnly,
  formatCurrencyInput,
  formatMoney,
  toNumber,
} from "../lib/format"
import { PAYMENT_METHODS } from "../lib/paymentMethods"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { PaymentMethod, RentCharge } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "RentCollect">

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
  const [amount, setAmount] = useState("") // raw digits, e.g. "15000"
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [paidDate, setPaidDate] = useState(todayISO())
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
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
          setAmount(digitsOnly(String(Math.max(remaining, 0))))
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
    setAmountError(null)
    setDateError(null)

    const amt = toNumber(amount)
    let hasError = false
    if (amt == null || amt <= 0) {
      setAmountError("Enter an amount greater than ₹0.")
      hasError = true
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
      setDateError("Pick a valid date.")
      hasError = true
    }
    if (hasError || amt == null) return

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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Remaining balance</Text>
          <Text style={styles.summaryValue}>{formatMoney(remaining)}</Text>
          <Text style={styles.summarySub}>
            {formatMoney(charge.amount_paid)} paid of{" "}
            {formatMoney(charge.amount)}
          </Text>
        </View>

        <Field
          label="Amount received *"
          value={formatCurrencyInput(amount)}
          onChangeText={(t) => {
            setAmount(digitsOnly(t))
            if (amountError) setAmountError(null)
          }}
          keyboardType="numeric"
          placeholder="₹0"
          editable={!saving}
        />
        {amountError ? <ErrorText text={amountError} /> : null}

        <View style={styles.spacerSm} />
        <Text style={styles.fieldLabel}>Method</Text>
        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map((m) => {
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
                  {m.icon} {m.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.spacerSm} />
        <DateField
          label="Paid date"
          value={paidDate}
          onChangeText={(t) => {
            setPaidDate(t)
            if (dateError) setDateError(null)
          }}
          error={dateError ?? undefined}
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
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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