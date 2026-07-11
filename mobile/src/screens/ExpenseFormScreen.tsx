import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useLayoutEffect, useState } from "react"
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { DatePickerField } from "../components/DatePickerField"
import { AppButton, CenteredMessage, ErrorText, Field } from "../components/ui"
import { apiFetch } from "../lib/api"
import { titleCase } from "../lib/format"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, font, radius, spacing } from "../theme"
import type {
  Expense,
  ExpenseCategory,
  Property,
  RecurInterval,
} from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "ExpenseForm">

const CATEGORIES: ExpenseCategory[] = [
  "repairs",
  "taxes",
  "insurance",
  "mortgage",
  "utilities",
  "management_fee",
  "landscape",
  "pest_control",
  "appliance",
  "other",
]

const INTERVALS: RecurInterval[] = ["monthly", "quarterly", "yearly"]

function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function ExpenseFormScreen({ route, navigation }: Props) {
  const expenseId = route.params?.expenseId
  const isEdit = Boolean(expenseId)

  const [properties, setProperties] = useState<Property[]>([])
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [category, setCategory] = useState<ExpenseCategory>("repairs")
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [spentOn, setSpentOn] = useState(todayISO())
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurInterval, setRecurInterval] = useState<RecurInterval>("monthly")
  const [tenantPayable, setTenantPayable] = useState(false)
  const [paid, setPaid] = useState(true)
  const [remarks, setRemarks] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? "Edit expense" : "New expense" })
  }, [navigation, isEdit])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const propList = await apiFetch<Property[]>("/api/v1/properties")
        if (!active) return
        setProperties(propList)
        if (isEdit && expenseId) {
          const e = await apiFetch<Expense>(`/api/v1/expenses/${expenseId}`)
          if (!active) return
          setPropertyId(e.property_id)
          setCategory(e.category)
          setTitle(e.title ?? "")
          setAmount(e.amount != null ? String(e.amount) : "")
          setSpentOn(e.spent_on)
          setIsRecurring(e.is_recurring)
          setRecurInterval(e.recur_interval ?? "monthly")
          setTenantPayable(e.tenant_payable)
          setPaid(e.paid)
          setRemarks(e.remarks ?? "")
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Failed to load data.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [isEdit, expenseId])

  async function handleSave() {
    setError(null)
    const cleanAmount = amount.replace(/[\u20B9,\s]/g, "")
    const amt = Number(cleanAmount)
    if (!cleanAmount || Number.isNaN(amt) || amt < 0) {
      setError("Enter a valid amount.")
      return
    }
    const payload: Record<string, unknown> = {
      category,
      amount: amt,
      spent_on: spentOn,
      is_recurring: isRecurring,
      recur_interval: isRecurring ? recurInterval : null,
      tenant_payable: tenantPayable,
      paid,
      property_id: propertyId,
      title: title.trim() || null,
      remarks: remarks.trim() || null,
    }
    setSaving(true)
    try {
      if (isEdit && expenseId) {
        await apiFetch(`/api/v1/expenses/${expenseId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch("/api/v1/expenses", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      navigation.goBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense.")
      setSaving(false)
    }
  }

  function confirmDelete() {
    Alert.alert("Delete expense", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: handleDelete },
    ])
  }

  async function handleDelete() {
    if (!expenseId) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`/api/v1/expenses/${expenseId}`, { method: "DELETE" })
      navigation.goBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete expense.")
      setSaving(false)
    }
  }

  if (loading) return <CenteredMessage loading text="Loading…" />

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Category *</Text>
      <View style={styles.pillWrap}>
        {CATEGORIES.map((c) => {
          const selected = category === c
          const pillStyle = [styles.pill, selected ? styles.pillSelected : null]
          const textStyle = [
            styles.pillText,
            selected ? styles.pillTextSelected : null,
          ]
          return (
            <TouchableOpacity
              key={c}
              style={pillStyle}
              activeOpacity={0.8}
              onPress={() => setCategory(c)}
            >
              <Text style={textStyle}>{titleCase(c)}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <Field
        label="Amount *"
        value={amount}
        onChangeText={setAmount}
        placeholder="e.g. 5,000"
        keyboardType="numeric"
        editable={!saving}
      />

      <Field
        label="Title / note"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Plumber visit"
        editable={!saving}
      />

      <DatePickerField
        label="Spent on"
        value={spentOn}
        onChange={setSpentOn}
        editable={!saving}
      />

      <Text style={styles.label}>Property (optional)</Text>
      <View style={styles.selectWrap}>
        <TouchableOpacity
          style={[
            styles.option,
            propertyId === null ? styles.optionSelected : null,
          ]}
          activeOpacity={0.8}
          onPress={() => setPropertyId(null)}
        >
          <Text
            style={[
              styles.optionText,
              propertyId === null ? styles.optionTextSelected : null,
            ]}
          >
            Not linked
          </Text>
        </TouchableOpacity>
        {properties.map((p) => {
          const selected = propertyId === p.id
          const optStyle = [
            styles.option,
            selected ? styles.optionSelected : null,
          ]
          const txtStyle = [
            styles.optionText,
            selected ? styles.optionTextSelected : null,
          ]
          return (
            <TouchableOpacity
              key={p.id}
              style={optStyle}
              activeOpacity={0.8}
              onPress={() => setPropertyId(p.id)}
            >
              <Text style={txtStyle}>{p.name}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <ToggleRow
        label="Recurring expense"
        value={isRecurring}
        onChange={setIsRecurring}
        disabled={saving}
      />
      {isRecurring ? (
        <View style={styles.pillWrap}>
          {INTERVALS.map((i) => {
            const selected = recurInterval === i
            const pillStyle = [
              styles.pill,
              selected ? styles.pillSelected : null,
            ]
            const textStyle = [
              styles.pillText,
              selected ? styles.pillTextSelected : null,
            ]
            return (
              <TouchableOpacity
                key={i}
                style={pillStyle}
                activeOpacity={0.8}
                onPress={() => setRecurInterval(i)}
              >
                <Text style={textStyle}>{titleCase(i)}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      ) : null}

      <ToggleRow
        label="Billable to tenant"
        value={tenantPayable}
        onChange={setTenantPayable}
        disabled={saving}
      />
      <ToggleRow
        label="Already paid"
        value={paid}
        onChange={setPaid}
        disabled={saving}
      />

      <Field
        label="Remarks"
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Any extra details…"
        multiline
        editable={!saving}
      />

      {error ? <ErrorText text={error} /> : null}

      <View style={styles.spacer} />
      <AppButton
        title={isEdit ? "Save changes" : "Add expense"}
        onPress={handleSave}
        loading={saving}
      />
      {isEdit ? (
        <>
          <View style={styles.spacerSm} />
          <AppButton
            title="Delete expense"
            onPress={confirmDelete}
            variant="danger"
            disabled={saving}
          />
        </>
      ) : null}
    </ScrollView>
  )
}

function ToggleRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  const yesStyle = [styles.togglePill, value ? styles.togglePillActive : null]
  const noStyle = [styles.togglePill, !value ? styles.togglePillActive : null]
  const yesText = [styles.toggleText, value ? styles.toggleTextActive : null]
  const noText = [styles.toggleText, !value ? styles.toggleTextActive : null]
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.toggleGroup}>
        <TouchableOpacity
          style={yesStyle}
          activeOpacity={0.8}
          disabled={disabled}
          onPress={() => onChange(true)}
        >
          <Text style={yesText}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={noStyle}
          activeOpacity={0.8}
          disabled={disabled}
          onPress={() => onChange(false)}
        >
          <Text style={noText}>No</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  label: {
    fontSize: font.small,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: spacing.xs,
    marginLeft: 2,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pill: {
    borderRadius: radius.pill,
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
  pillText: { fontSize: font.small, fontWeight: "600", color: colors.text },
  pillTextSelected: { color: colors.white },
  selectWrap: { marginBottom: spacing.md },
  option: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  optionText: { fontSize: font.body, color: colors.text },
  optionTextSelected: { color: colors.primaryDark, fontWeight: "700" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  toggleLabel: {
    fontSize: font.body,
    color: colors.text,
    fontWeight: "600",
    flex: 1,
  },
  toggleGroup: {
    flexDirection: "row",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  togglePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  togglePillActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: font.small, fontWeight: "700", color: colors.muted },
  toggleTextActive: { color: colors.white },
  spacer: { height: spacing.md },
  spacerSm: { height: spacing.sm },
})
