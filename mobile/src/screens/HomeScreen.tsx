import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useCallback, useLayoutEffect, useState } from "react"
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { CenteredMessage } from "../components/ui"
import { apiFetch } from "../lib/api"
import { formatMoney } from "../lib/format"
import { supabase } from "../lib/supabase"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { Summary } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "Home">

type NavRow = {
  key: keyof RootStackParamList
  label: string
  hint: string
}

const NAV_ROWS: NavRow[] = [
  { key: "Properties", label: "Properties & Units", hint: "Buildings and rentable units" },
  { key: "Tenants", label: "Tenants", hint: "People who rent from you" },
  { key: "Leases", label: "Leases & Rent", hint: "Agreements, charges, payments" },
  { key: "Maintenance", label: "Maintenance", hint: "Repair requests and tickets" },
]

export default function HomeScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Dashboard",
      headerLeft: () => (
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      ),
    })
  }, [navigation])

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const data = await apiFetch<Summary>("/api/v1/reports/summary")
      setSummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load("initial")
    }, [load])
  )

  if (loading) {
    return <CenteredMessage loading text="Loading dashboard…" />
  }

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
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load("refresh")}
          tintColor={colors.primary}
        />
      }
    >
      {summary ? (
        <>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Collected this month</Text>
            <Text style={styles.heroValue}>
              {formatMoney(summary.collected_this_month)}
            </Text>
            <Text style={styles.heroSub}>
              of {formatMoney(summary.expected_this_month)} expected
            </Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {formatMoney(summary.outstanding_total)}
              </Text>
              <Text style={styles.statLabel}>Outstanding</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{summary.occupancy_pct}%</Text>
              <Text style={styles.statLabel}>
                Occupancy ({summary.occupied}/{summary.units})
              </Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{summary.properties}</Text>
              <Text style={styles.statLabel}>Properties</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{summary.tickets_open}</Text>
              <Text style={styles.statLabel}>Open tickets</Text>
            </View>
          </View>

          {summary.outstanding_by_property.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Outstanding by property</Text>
              {summary.outstanding_by_property.map((row) => (
                <View
                  key={row.property_id ?? "unassigned"}
                  style={styles.obpRow}
                >
                  <Text style={styles.obpName}>{row.property_name}</Text>
                  <Text style={styles.obpAmount}>
                    {formatMoney(row.outstanding)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manage</Text>
        {NAV_ROWS.map((row) => (
          <TouchableOpacity
            key={row.key}
            style={styles.navRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(row.key as never)}
          >
            <View style={styles.navRowText}>
              <Text style={styles.navRowLabel}>{row.label}</Text>
              <Text style={styles.navRowHint}>{row.hint}</Text>
            </View>
            <Text style={styles.navRowChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  logoutText: { color: colors.danger, fontWeight: "600", fontSize: 15 },
  content: { padding: spacing.md },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroLabel: { color: colors.white, opacity: 0.85, fontSize: 14 },
  heroValue: {
    color: colors.white,
    fontSize: 32,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  heroSub: { color: colors.white, opacity: 0.85, fontSize: 14, marginTop: spacing.xs },
  statRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 13, color: colors.muted, marginTop: spacing.xs },
  section: { marginTop: spacing.sm, marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  obpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  obpName: { fontSize: 15, color: colors.text, flex: 1 },
  obpAmount: { fontSize: 15, fontWeight: "700", color: colors.danger },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  navRowText: { flex: 1 },
  navRowLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
  navRowHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  navRowChevron: { fontSize: 26, color: colors.muted, marginLeft: spacing.sm },
})
