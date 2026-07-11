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
import { AppButton, CenteredMessage, ErrorText, Field } from "../components/ui"
import { apiFetch } from "../lib/api"
import { formatDate, formatMoney, titleCase } from "../lib/format"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { Lease, RentCharge, Tenant, Unit } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "LeaseDetail">

export default function LeaseDetailScreen({ route, navigation }: Props) {
  const { leaseId } = route.params

  const [lease, setLease] = useState<Lease | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [unit, setUnit] = useState<Unit | null>(null)
  const [charges, setCharges] = useState<RentCharge[]>([])
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
      const [tenantData, unitData, chargeData] = await Promise.all([
        apiFetch<Tenant>(`/api/v1/tenants/${leaseData.tenant_id}`).catch(
          () => null
        ),
        apiFetch<Unit>(`/api/v1/units/${leaseData.unit_id}`).catch(() => null),
        apiFetch<RentCharge[]>(`/api/v1/rent-charges?lease_id=${leaseId}`),
      ])
      setLease(leaseData)
      setTenant(tenantData)
      setUnit(unitData)
      setCharges(chargeData)
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
              </View>
              <View style={styles.chargeRight}>
                <View
                  style={[
                    styles.badge,
                    isPaid
                      ? styles.badgePaid
                      : c.status === "partial"
                        ? styles.badgePartial
                        : styles.badgeDue,
                  ]}
                >
                  <Text style={styles.badgeText}>{titleCase(c.status)}</Text>
                </View>
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
  chargeRight: { alignItems: "flex-end" },
  chargeRemaining: { fontSize: 12, color: colors.danger, marginTop: 4 },
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
