import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useCallback, useLayoutEffect, useState } from "react"
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { DatePickerField } from "../components/DatePickerField"
import {
  AppButton,
  CenteredMessage,
  ErrorText,
  Field,
  StatusBadge,
} from "../components/ui"
import { apiFetch } from "../lib/api"
import { formatDate, formatMoney, titleCase } from "../lib/format"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { Lease, LeaseUtility, RentCharge, Tenant, Unit } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "LeaseDetail">

export default function LeaseDetailScreen({ route, navigation }: Props) {
  const { leaseId } = route.params

  const [lease, setLease] = useState<Lease | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [unit, setUnit] = useState<Unit | null>(null)
  const [charges, setCharges] = useState<RentCharge[]>([])
  const [utilities, setUtilities] = useState<LeaseUtility[]>([])
  const [utilKind, setUtilKind] = useState("")
  const [utilRate, setUtilRate] = useState("")
  const [utilBilling, setUtilBilling] = useState<"fixed" | "metered">("fixed")
  const [addingUtil, setAddingUtil] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showSettle, setShowSettle] = useState(false)
  const [depositReturned, setDepositReturned] = useState("")
  const [settleDate, setSettleDate] = useState("")
  const [settleNotes, setSettleNotes] = useState("")
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Lease",
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("LeaseForm", { leaseId })}
        >
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      ),
    })
  }, [navigation, leaseId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const leaseData = await apiFetch<Lease>(`/api/v1/leases/${leaseId}`)
      const [tenantData, unitData, chargeData, utilData] = await Promise.all([
        apiFetch<Tenant>(`/api/v1/tenants/${leaseData.tenant_id}`).catch(
          () => null
        ),
        apiFetch<Unit>(`/api/v1/units/${leaseData.unit_id}`).catch(() => null),
        apiFetch<RentCharge[]>(`/api/v1/rent-charges?lease_id=${leaseId}`),
        apiFetch<LeaseUtility[]>(`/api/v1/leases/${leaseId}/utilities`).catch(
          () => []
        ),
      ])
      setLease(leaseData)
      setTenant(tenantData)
      setUnit(unitData)
      setCharges(chargeData)
      setUtilities(utilData)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lease.")
    } finally {
      setLoading(false)
    }
  }, [leaseId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      await apiFetch("/api/v1/rent-charges/generate", {
        method: "POST",
        body: JSON.stringify({ lease_id: leaseId }),
      })
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate charge."
      Alert.alert("Could not generate charge", msg)
    } finally {
      setGenerating(false)
    }
  }

  async function addUtility() {
    const rateNum = Number(utilRate.replace(/[\u20B9,\s]/g, ""))
    if (!utilKind.trim()) {
      setError("Enter a utility name.")
      return
    }
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setError("Enter a valid rate.")
      return
    }
    setAddingUtil(true)
    setError(null)
    try {
      await apiFetch(`/api/v1/leases/${leaseId}/utilities`, {
        method: "POST",
        body: JSON.stringify({
          kind: utilKind.trim(),
          billing: utilBilling,
          rate: rateNum,
        }),
      })
      setUtilKind("")
      setUtilRate("")
      setUtilBilling("fixed")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add utility.")
    } finally {
      setAddingUtil(false)
    }
  }

  function confirmDeleteUtility(id: string) {
    Alert.alert("Remove utility?", "This removes this recurring charge.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteUtility(id) },
    ])
  }

  async function deleteUtility(id: string) {
    try {
      await apiFetch(`/api/v1/leases/${leaseId}/utilities/${id}`, {
        method: "DELETE",
      })
      await load()
    } catch (e) {
      Alert.alert(
        "Could not remove",
        e instanceof Error ? e.message : "Failed."
      )
    }
  }

  function openSettle() {
    setError(null)
    setDepositReturned(lease?.deposit != null ? String(lease.deposit) : "")
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, "0")
    setSettleDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
    setSettleNotes("")
    setShowSettle(true)
  }

  async function handleEndLease() {
    setError(null)
    setEnding(true)
    try {
      const cleaned = depositReturned.replace(/[\u20B9,\s]/g, "")
      const body: Record<string, unknown> = {
        end_date: settleDate || undefined,
        final_settlement_date: settleDate || undefined,
        settlement_notes: settleNotes.trim() || undefined,
      }
      if (cleaned) body.deposit_returned = Number(cleaned)
      await apiFetch(`/api/v1/leases/${leaseId}/end`, {
        method: "POST",
        body: JSON.stringify(body),
      })
      setShowSettle(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end lease.")
    } finally {
      setEnding(false)
    }
  }

  if (loading) return <CenteredMessage loading text="Loading lease…" />

  if (error || !lease) {
    return (
      <CenteredMessage
        error
        text={error ?? "Lease not found"}
        actionLabel="Try Again"
        onAction={load}
      />
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.tenantName}>
          {tenant ? tenant.full_name : "Unknown tenant"}
        </Text>
        <Text style={styles.metaLine}>
          Unit {unit ? unit.unit_number : "—"}
        </Text>
        <View style={styles.divider} />
        <Row label="Rent" value={`${formatMoney(lease.rent_amount)} / ${lease.billing_cycle}`} />
        <Row label="Deposit" value={formatMoney(lease.deposit)} />
        <Row label="Start" value={formatDate(lease.start_date)} />
        <Row label="End" value={formatDate(lease.end_date)} />
        <Row label="Status" value={titleCase(lease.status)} />
        {lease.status === "ended" ? (
          <>
            {lease.deposit_returned != null ? (
              <Row
                label="Deposit returned"
                value={formatMoney(lease.deposit_returned)}
              />
            ) : null}
            {lease.final_settlement_date ? (
              <Row
                label="Settled on"
                value={formatDate(lease.final_settlement_date)}
              />
            ) : null}
            {lease.settlement_notes ? (
              <Row label="Notes" value={lease.settlement_notes} />
            ) : null}
          </>
        ) : null}
      </View>

      {lease.status === "active" ? (
        showSettle ? (
          <View style={styles.card}>
            <Text style={styles.settleTitle}>End lease & settle</Text>
            <Text style={styles.settleHint}>
              Record the deposit returned and closing details. This marks the
              lease ended and moves it to the Archived tab.
            </Text>
            <Field
              label="Deposit returned"
              value={depositReturned}
              onChangeText={setDepositReturned}
              placeholder="e.g. 20,000"
              keyboardType="numeric"
              editable={!ending}
            />
            <DatePickerField
              label="Settlement date"
              value={settleDate}
              onChange={setSettleDate}
              editable={!ending}
            />
            <Field
              label="Settlement notes"
              value={settleNotes}
              onChangeText={setSettleNotes}
              placeholder="Deductions, condition, balance paid…"
              multiline
              editable={!ending}
            />
            {error ? <ErrorText text={error} /> : null}
            <View style={styles.spacerSm} />
            <AppButton
              title="Confirm end lease"
              variant="danger"
              onPress={handleEndLease}
              loading={ending}
            />
            <View style={styles.spacerSm} />
            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={() => setShowSettle(false)}
              disabled={ending}
            />
          </View>
        ) : (
          <>
            <AppButton
              title="End lease & settle"
              variant="danger"
              onPress={openSettle}
            />
            <View style={styles.spacerMd} />
          </>
        )
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recurring utilities</Text>
      </View>
      <Text style={styles.utilHint}>
        Fixed utilities are added on top of the rent when you generate a charge.
      </Text>
      {utilities.length === 0 ? (
        <Text style={styles.emptyText}>No utilities added.</Text>
      ) : (
        utilities.map((u) => (
          <View key={u.id} style={styles.utilRow}>
            <View style={styles.chargeInfo}>
              <Text style={styles.chargeAmount}>{titleCase(u.kind)}</Text>
              <Text style={styles.chargeDue}>
                {u.billing === "fixed" ? "Fixed" : "Metered"} ·{" "}
                {formatMoney(u.rate)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => confirmDeleteUtility(u.id)}>
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
      {lease.status === "active" ? (
        <View style={styles.card}>
          <Field
            label="Utility name"
            value={utilKind}
            onChangeText={setUtilKind}
            placeholder="e.g. Water, Maintenance"
            editable={!addingUtil}
          />
          <View style={styles.pillRow}>
            {(["fixed", "metered"] as const).map((b) => {
              const selected = utilBilling === b
              return (
                <TouchableOpacity
                  key={b}
                  style={[styles.pill, selected ? styles.pillSelected : null]}
                  onPress={() => setUtilBilling(b)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selected ? styles.pillTextSelected : null,
                    ]}
                  >
                    {b}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <Field
            label={
              utilBilling === "fixed" ? "Amount per cycle" : "Rate per unit"
            }
            value={utilRate}
            onChangeText={setUtilRate}
            placeholder="e.g. 500"
            keyboardType="numeric"
            editable={!addingUtil}
          />
          <AppButton
            title="Add utility"
            variant="secondary"
            onPress={addUtility}
            loading={addingUtil}
          />
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Rent charges</Text>
      </View>

      <AppButton
        title="Generate this month's charge"
        variant="secondary"
        onPress={handleGenerate}
        loading={generating}
      />

      <View style={styles.spacerMd} />

      {charges.length === 0 ? (
        <Text style={styles.emptyText}>
          No charges yet. Generate one to start tracking rent.
        </Text>
      ) : (
        charges.map((c) => {
          const remaining = Number(c.amount) - Number(c.amount_paid ?? 0)
          const isPaid = c.status === "paid"
          return (
            <TouchableOpacity
              key={c.id}
              style={styles.chargeRow}
              activeOpacity={isPaid ? 1 : 0.7}
              disabled={isPaid}
              onPress={() =>
                navigation.navigate("RentCollect", {
                  chargeId: c.id,
                  leaseId,
                })
              }
            >
              <View style={styles.chargeInfo}>
                <Text style={styles.chargeAmount}>{formatMoney(c.amount)}</Text>
                <Text style={styles.chargeDue}>
                  Due {formatDate(c.due_date)}
                </Text>
                {c.period_start && c.period_end ? (
                  <Text style={styles.chargePeriod}>
                    Rent for {formatDate(c.period_start)} – {formatDate(c.period_end)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.chargeRight}>
                <StatusBadge status={c.status} />
                {!isPaid ? (
                  <Text style={styles.chargeRemaining}>
                    {formatMoney(remaining)} left
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )
        })
      )}
    </ScrollView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  editText: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  content: { padding: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  tenantName: { fontSize: 20, fontWeight: "800", color: colors.text },
  metaLine: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  rowLabel: { fontSize: 15, color: colors.muted },
  rowValue: { fontSize: 15, fontWeight: "600", color: colors.text },
  sectionHeader: { marginBottom: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  spacerMd: { height: spacing.md },
  spacerSm: { height: spacing.sm },
  settleTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  settleHint: { fontSize: 13, color: colors.muted, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.muted },
  chargeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  chargeInfo: { flex: 1 },
  chargeAmount: { fontSize: 16, fontWeight: "700", color: colors.text },
  chargeDue: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chargePeriod: { fontSize: 12, color: colors.subtle, marginTop: 2 },
  chargeRight: { alignItems: "flex-end" },
  chargeRemaining: { fontSize: 12, color: colors.danger, marginTop: 4 },
  utilHint: { fontSize: 13, color: colors.muted, marginBottom: spacing.sm },
  utilRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  removeText: { fontSize: 13, fontWeight: "700", color: colors.danger },
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
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgePaid: { backgroundColor: "#DCFCE7" },
  badgePartial: { backgroundColor: "#FEF3C7" },
  badgeDue: { backgroundColor: "#FEE2E2" },
  badgeText: { fontSize: 12, fontWeight: "700", color: colors.text },
})
