import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useLayoutEffect, useState } from "react"
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { FormScreen } from "../components/FormScreen"
import { AppButton, CenteredMessage, DatePickerField, ErrorText, Field } from "../components/ui"
import { apiFetch } from "../lib/api"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type {
  BillingCycle,
  BillingMode,
  Lease,
  Tenant,
  Unit,
} from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "LeaseForm">

const CYCLES: BillingCycle[] = ["weekly", "monthly", "quarterly", "yearly"]

const MODES: { value: BillingMode; label: string; hint: string }[] = [
  {
    value: "prepaid",
    label: "Pre-paid",
    hint: "Rent collected in advance for the current period.",
  },
  {
    value: "postpaid",
    label: "Post-paid",
    hint: "Rent collected in arrears for the previous period.",
  },
]

export default function LeaseFormScreen({ route, navigation }: Props) {
  const leaseId = route.params?.leaseId
  const isEdit = Boolean(leaseId)

  const [units, setUnits] = useState<Unit[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [unitId, setUnitId] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [unitQuery, setUnitQuery] = useState("")
  const [tenantQuery, setTenantQuery] = useState("")
  const [rent, setRent] = useState("")
  const [deposit, setDeposit] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [cycle, setCycle] = useState<BillingCycle>("monthly")
  const [mode, setMode] = useState<BillingMode>("prepaid")
  const [status, setStatus] = useState<"active" | "ended">("active")
  const [incrementPct, setIncrementPct] = useState("")
  const [incrementMonths, setIncrementMonths] = useState("")
  const [lastRevised, setLastRevised] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? "Edit Lease" : "New Lease" })
  }, [navigation, isEdit])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        if (isEdit && leaseId) {
          const lease = await apiFetch<Lease>(`/api/v1/leases/${leaseId}`)
          if (!active) return
          setUnitId(lease.unit_id)
          setTenantId(lease.tenant_id)
          setRent(String(Number(lease.rent_amount)))
          setDeposit(String(Number(lease.deposit)))
          setStartDate(lease.start_date)
          setEndDate(lease.end_date ?? "")
          setCycle(lease.billing_cycle)
          setMode(lease.billing_mode ?? "prepaid")
          setStatus(lease.status)
          setIncrementPct(
            lease.increment_pct != null
              ? String(Number(lease.increment_pct))
              : ""
          )
          setIncrementMonths(
            lease.increment_months != null
              ? String(lease.increment_months)
              : ""
          )
          setLastRevised(lease.last_revised_date ?? "")
        } else {
          const [unitList, tenantList] = await Promise.all([
            apiFetch<Unit[]>("/api/v1/units"),
            apiFetch<Tenant[]>("/api/v1/tenants"),
          ])
          if (!active) return
          setUnits(unitList)
          setTenants(tenantList)
        }
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : "Failed to load data.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [isEdit, leaseId])

  function validDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
  }

  async function handleSave() {
    setError(null)

    const rentNum = Number(rent)
    if (!Number.isFinite(rentNum) || rentNum < 0) {
      setError("Enter a valid rent amount.")
      return
    }
    const depositNum = deposit.trim() ? Number(deposit) : 0
    if (!Number.isFinite(depositNum) || depositNum < 0) {
      setError("Enter a valid deposit amount.")
      return
    }
    if (endDate.trim() && !validDate(endDate.trim())) {
      setError("End date must be in YYYY-MM-DD format.")
      return
    }

    setSaving(true)
    try {
      if (isEdit && leaseId) {
        const payload: Record<string, unknown> = {
          rent_amount: rentNum,
          deposit: depositNum,
          billing_cycle: cycle,
          billing_mode: mode,
          status,
        }
        if (validDate(startDate.trim())) payload.start_date = startDate.trim()
        payload.end_date = endDate.trim() ? endDate.trim() : null
        payload.increment_pct = incrementPct.trim()
          ? Number(incrementPct)
          : null
        payload.increment_months = incrementMonths.trim()
          ? Number(incrementMonths)
          : null
        payload.last_revised_date = validDate(lastRevised.trim())
          ? lastRevised.trim()
          : null
        await apiFetch<Lease>(`/api/v1/leases/${leaseId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      } else {
        if (!unitId) {
          setError("Select a unit.")
          setSaving(false)
          return
        }
        if (!tenantId) {
          setError("Select a tenant.")
          setSaving(false)
          return
        }
        if (!validDate(startDate.trim())) {
          setError("Start date must be in YYYY-MM-DD format.")
          setSaving(false)
          return
        }
        const payload: Record<string, unknown> = {
          unit_id: unitId,
          tenant_id: tenantId,
          rent_amount: rentNum,
          deposit: depositNum,
          start_date: startDate.trim(),
          billing_cycle: cycle,
          billing_mode: mode,
        }
        if (endDate.trim()) payload.end_date = endDate.trim()
        if (incrementPct.trim()) payload.increment_pct = Number(incrementPct)
        if (incrementMonths.trim())
          payload.increment_months = Number(incrementMonths)
        if (validDate(lastRevised.trim()))
          payload.last_revised_date = lastRevised.trim()
        await apiFetch<Lease>("/api/v1/leases", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      navigation.goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save lease.")
      setSaving(false)
    }
  }

  function confirmEnd() {
    Alert.alert(
      "End this lease?",
      "This marks the lease as ended. You can still view its history.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "End Lease", style: "destructive", onPress: handleEnd },
      ]
    )
  }

  async function handleEnd() {
    if (!leaseId) return
    setError(null)
    setEnding(true)
    try {
      await apiFetch(`/api/v1/leases/${leaseId}/end`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      navigation.goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end lease.")
      setEnding(false)
    }
  }

  if (loading) return <CenteredMessage loading text="Loading…" />

  const busy = saving || ending
  const activeMode = MODES.find((m) => m.value === mode)
  const unitLabel = (u: Unit) =>
    `Unit ${u.unit_number}${u.description ? ` · ${u.description}` : ""}`
  const uq = unitQuery.trim().toLowerCase()
  const tq = tenantQuery.trim().toLowerCase()
  const filteredUnits = uq
    ? units.filter((u) => unitLabel(u).toLowerCase().includes(uq))
    : units
  const filteredTenants = tq
    ? tenants.filter((t) => t.full_name.toLowerCase().includes(tq))
    : tenants

  return (
    <FormScreen>
      {!isEdit ? (
        <>
          <Text style={styles.fieldLabel}>Unit *</Text>
          {units.length === 0 ? (
            <Text style={styles.helper}>
              No units found. Add a unit under a property first.
            </Text>
          ) : (
            <View style={styles.selectWrap}>
              <TextInput
                style={styles.searchInput}
                value={unitQuery}
                onChangeText={setUnitQuery}
                placeholder="Search units…"
                placeholderTextColor={colors.subtle}
              />
              {filteredUnits.length === 0 ? (
                <Text style={styles.helper}>No matching units.</Text>
              ) : (
                filteredUnits.slice(0, 20).map((u) => {
                  const selected = unitId === u.id
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.option, selected ? styles.optionSelected : null]}
                      onPress={() => setUnitId(u.id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected ? styles.optionTextSelected : null,
                        ]}
                      >
                        {unitLabel(u)}
                      </Text>
                    </TouchableOpacity>
                  )
                })
              )}
              {filteredUnits.length > 20 ? (
                <Text style={styles.helper}>
                  Showing first 20 — refine your search to narrow down.
                </Text>
              ) : null}
            </View>
          )}

          <Text style={styles.fieldLabel}>Tenant *</Text>
          {tenants.length === 0 ? (
            <Text style={styles.helper}>
              No tenants found. Add a tenant first.
            </Text>
          ) : (
            <View style={styles.selectWrap}>
              <TextInput
                style={styles.searchInput}
                value={tenantQuery}
                onChangeText={setTenantQuery}
                placeholder="Search tenants…"
                placeholderTextColor={colors.subtle}
              />
              {filteredTenants.length === 0 ? (
                <Text style={styles.helper}>No matching tenants.</Text>
              ) : (
                filteredTenants.slice(0, 20).map((t) => {
                  const selected = tenantId === t.id
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.option, selected ? styles.optionSelected : null]}
                      onPress={() => setTenantId(t.id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected ? styles.optionTextSelected : null,
                        ]}
                      >
                        {t.full_name}
                      </Text>
                    </TouchableOpacity>
                  )
                })
              )}
              {filteredTenants.length > 20 ? (
                <Text style={styles.helper}>
                  Showing first 20 — refine your search to narrow down.
                </Text>
              ) : null}
            </View>
          )}
        </>
      ) : null}

      <Field
        label="Rent amount *"
        value={rent}
        onChangeText={setRent}
        keyboardType="numeric"
        placeholder="e.g. 15000"
        editable={!busy}
      />
      <Field
        label="Deposit"
        value={deposit}
        onChangeText={setDeposit}
        keyboardType="numeric"
        placeholder="e.g. 30000"
        editable={!busy}
      />

      <Text style={styles.fieldLabel}>Billing cycle</Text>
      <View style={styles.pillRow}>
        {CYCLES.map((c) => {
          const selected = cycle === c
          return (
            <TouchableOpacity
              key={c}
              style={[styles.pill, selected ? styles.pillSelected : null]}
              onPress={() => setCycle(c)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.pillText,
                  selected ? styles.pillTextSelected : null,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <Text style={styles.fieldLabel}>Rent preference</Text>
      <View style={styles.pillRow}>
        {MODES.map((m) => {
          const selected = mode === m.value
          return (
            <TouchableOpacity
              key={m.value}
              style={[styles.pill, selected ? styles.pillSelected : null]}
              onPress={() => setMode(m.value)}
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
      {activeMode ? (
        <Text style={styles.modeHint}>{activeMode.hint}</Text>
      ) : null}

      <Text style={styles.fieldLabel}>Rent increment (optional)</Text>
      <Text style={styles.helper}>
        Auto-raise the rent on a schedule. The increase is applied when you
        generate a charge on or after the next revision date.
      </Text>
      <Field
        label="Increase by (%)"
        value={incrementPct}
        onChangeText={setIncrementPct}
        keyboardType="numeric"
        placeholder="e.g. 10"
        editable={!busy}
      />
      <Field
        label="Every (months)"
        value={incrementMonths}
        onChangeText={setIncrementMonths}
        keyboardType="numeric"
        placeholder="e.g. 12"
        editable={!busy}
      />
      <DatePickerField
        label="Last revised on"
        value={lastRevised}
        onChange={setLastRevised}
        editable={!busy}
        optional
      />

      <View style={styles.spacerSm} />
      <DatePickerField
        label={isEdit ? "Start date" : "Start date *"}
        value={startDate}
        onChangeText={setStartDate}
        editable={!busy}
      />
      <DatePickerField
        label="End date (optional)"
        value={endDate}
        onChangeText={setEndDate}
        editable={!busy}
      />

      {isEdit ? (
        <>
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.pillRow}>
            {(["active", "ended"] as const).map((s) => {
              const selected = status === s
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.pill, selected ? styles.pillSelected : null]}
                  onPress={() => setStatus(s)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selected ? styles.pillTextSelected : null,
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </>
      ) : null}

      {error ? <ErrorText text={error} /> : null}

      <View style={styles.spacerMd} />
      <AppButton
        title={isEdit ? "Save Changes" : "Create Lease"}
        onPress={handleSave}
        loading={saving}
        disabled={ending}
      />

      {isEdit ? (
        <>
          <View style={styles.spacerSm} />
          <AppButton
            title="End Lease"
            variant="danger"
            onPress={confirmEnd}
            loading={ending}
            disabled={saving}
          />
        </>
      ) : null}
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  helper: { fontSize: 14, color: colors.muted, marginBottom: spacing.md },
  modeHint: {
    fontSize: 13,
    color: colors.muted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  selectWrap: { marginBottom: spacing.md },
  searchInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  option: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  optionText: { fontSize: 15, color: colors.text },
  optionTextSelected: { color: colors.primaryDark, fontWeight: "700" },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    textTransform: "capitalize",
  },
  pillTextSelected: { color: colors.white },
  spacerSm: { height: spacing.sm },
  spacerMd: { height: spacing.md },
})
