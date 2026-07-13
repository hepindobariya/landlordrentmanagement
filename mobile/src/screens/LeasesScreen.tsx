import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useCallback, useLayoutEffect, useState } from "react"
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { CenteredMessage, StatusBadge } from "../components/ui"
import { apiFetch } from "../lib/api"
import { formatMoney } from "../lib/format"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { Lease, Tenant, Unit } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "Leases">

export default function LeasesScreen({ navigation }: Props) {
  const [leases, setLeases] = useState<Lease[]>([])
  const [tenants, setTenants] = useState<Record<string, Tenant>>({})
  const [units, setUnits] = useState<Record<string, Unit>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<"active" | "ended">("active")
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Leases",
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate("LeaseForm", {})}>
          <Text style={styles.addText}>＋</Text>
        </TouchableOpacity>
      ),
    })
  }, [navigation])

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const [leaseList, tenantList, unitList] = await Promise.all([
        apiFetch<Lease[]>(`/api/v1/leases?status=${filter}`),
        apiFetch<Tenant[]>("/api/v1/tenants"),
        apiFetch<Unit[]>("/api/v1/units"),
      ])
      setLeases(leaseList)
      const tMap: Record<string, Tenant> = {}
      tenantList.forEach((t) => {
        tMap[t.id] = t
      })
      setTenants(tMap)
      const uMap: Record<string, Unit> = {}
      unitList.forEach((u) => {
        uMap[u.id] = u
      })
      setUnits(uMap)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useFocusEffect(
    useCallback(() => {
      load("initial")
    }, [load])
  )

  if (loading) return <CenteredMessage loading text="Loading leases…" />

  if (error) {
    return (
      <CenteredMessage
        error
        text={error}
        actionLabel="Try Again"
        onAction={() => load("initial")}
      />
    )
  }

  return (
    <FlatList
      data={leases}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={<FilterTabs value={filter} onChange={setFilter} />}
      contentContainerStyle={
        leases.length === 0 ? styles.emptyContainer : styles.listContent
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load("refresh")}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        <CenteredMessage
          text={filter === "active" ? "No active leases" : "No archived leases"}
          subtext={
            filter === "active"
              ? "Tap the + button to create a lease linking a tenant to a unit."
              : "Leases you end will appear here with their settlement details."
          }
        />
      }
      renderItem={({ item }) => {
        const tenant = tenants[item.tenant_id]
        const unit = units[item.unit_id]
        return (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate("LeaseDetail", { leaseId: item.id })
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {tenant ? tenant.full_name : "Unknown tenant"}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.cardSubtitle}>
              Unit {unit ? unit.unit_number : "—"} · {formatMoney(item.rent_amount)}
              /{item.billing_cycle}
            </Text>
          </TouchableOpacity>
        )
      }}
    />
  )
}

function FilterTabs({
  value,
  onChange,
}: {
  value: "active" | "ended"
  onChange: (v: "active" | "ended") => void
}) {
  const activeStyle = [styles.tab, value === "active" ? styles.tabActive : null]
  const endedStyle = [styles.tab, value === "ended" ? styles.tabActive : null]
  const activeText = [
    styles.tabText,
    value === "active" ? styles.tabTextActive : null,
  ]
  const endedText = [
    styles.tabText,
    value === "ended" ? styles.tabTextActive : null,
  ]
  return (
    <View style={styles.tabs}>
      <TouchableOpacity
        style={activeStyle}
        activeOpacity={0.8}
        onPress={() => onChange("active")}
      >
        <Text style={activeText}>Active</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={endedStyle}
        activeOpacity={0.8}
        onPress={() => onChange("ended")}
      >
        <Text style={endedText}>Archived</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  addText: { color: colors.primary, fontWeight: "700", fontSize: 26 },
  tabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  tabTextActive: { color: colors.white },
  listContent: { padding: spacing.md },
  emptyContainer: { flexGrow: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.text, flex: 1 },
  cardSubtitle: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
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
