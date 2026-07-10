import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useCallback, useLayoutEffect, useState } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { CenteredMessage } from "../components/ui"
import { apiFetch } from "../lib/api"
import { formatMoney, titleCase } from "../lib/format"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { Lease, Tenant, Unit } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "TenantDetail">

export default function TenantDetailScreen({ route, navigation }: Props) {
  const { tenantId } = route.params

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [leases, setLeases] = useState<Lease[]>([])
  const [units, setUnits] = useState<Record<string, Unit>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Tenant",
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("TenantForm", { tenantId })}
        >
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      ),
    })
  }, [navigation, tenantId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tenantData, leaseList, unitList] = await Promise.all([
        apiFetch<Tenant>(`/api/v1/tenants/${tenantId}`),
        apiFetch<Lease[]>(`/api/v1/leases?tenant_id=${tenantId}`),
        apiFetch<Unit[]>("/api/v1/units"),
      ])
      setTenant(tenantData)
      setLeases(leaseList)
      const uMap: Record<string, Unit> = {}
      unitList.forEach((u) => {
        uMap[u.id] = u
      })
      setUnits(uMap)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenant.")
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  if (loading) return <CenteredMessage loading text="Loading tenant…" />

  if (error || !tenant) {
    return (
      <CenteredMessage
        error
        text={error ?? "Tenant not found"}
        actionLabel="Try Again"
        onAction={load}
      />
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.name}>{tenant.full_name}</Text>
        <View style={styles.divider} />
        <Row label="Phone" value={tenant.phone ?? "—"} />
        <Row label="Email" value={tenant.email ?? "—"} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Leases</Text>
      </View>

      {leases.length === 0 ? (
        <Text style={styles.emptyText}>No leases for this tenant yet.</Text>
      ) : (
        leases.map((lease) => {
          const unit = units[lease.unit_id]
          const isActive = lease.status === "active"
          return (
            <TouchableOpacity
              key={lease.id}
              style={styles.leaseRow}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate("LeaseDetail", { leaseId: lease.id })
              }
            >
              <View style={styles.leaseInfo}>
                <Text style={styles.leaseTitle}>
                  Unit {unit ? unit.unit_number : "—"}
                </Text>
                <Text style={styles.leaseSub}>
                  {formatMoney(lease.rent_amount)} / {lease.billing_cycle}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  isActive ? styles.badgeActive : styles.badgeEnded,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isActive ? styles.badgeTextActive : styles.badgeTextEnded,
                  ]}
                >
                  {titleCase(lease.status)}
                </Text>
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
  name: { fontSize: 20, fontWeight: "800", color: colors.text },
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
  emptyText: { fontSize: 14, color: colors.muted },
  leaseRow: {
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
  leaseInfo: { flex: 1 },
  leaseTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  leaseSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  badgeActive: { backgroundColor: "#DCFCE7" },
  badgeEnded: { backgroundColor: "#F1F5F9" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgeTextActive: { color: "#15803D" },
  badgeTextEnded: { color: colors.muted },
})