import { Feather } from "@expo/vector-icons"
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
import { colors, font, radius, shadow, spacing } from "../theme"
import type { Summary } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "Home">

type Action = { key: keyof RootStackParamList; label: string; icon: any }

const ACTIONS: Action[] = [
  { key: "Properties", label: "Properties", icon: "home" },
  { key: "Tenants", label: "Tenants", icon: "users" },
  { key: "Leases", label: "Leases", icon: "file-text" },
  { key: "Maintenance", label: "Maintenance", icon: "tool" },
]

const TOOLS: Action[] = [
  { key: "RentCalendar", label: "Rent calendar", icon: "calendar" },
  { key: "LegalLibrary", label: "Legal library", icon: "book-open" },
]

export default function HomeScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Dashboard",
      headerLeft: () => null,
      headerRight: () => (
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => supabase.auth.signOut()}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={18} color={colors.muted} />
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

  const expected = summary ? Number(summary.expected_this_month) : 0
  const collected = summary ? Number(summary.collected_this_month) : 0
  const pct = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0
  const progressStyle = [styles.progressFill, { width: `${pct}%` }]

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
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
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroLabel}>Collected this month</Text>
            <Text style={styles.heroValue}>{formatMoney(collected)}</Text>
            <View style={styles.progressTrack}>
              <View style={progressStyle} />
            </View>
            <Text style={styles.heroSub}>
              {pct}% of {formatMoney(expected)} expected
            </Text>
          </View>

          <View style={styles.statGrid}>
            <StatTile
              icon="trending-down"
              label="Outstanding"
              value={formatMoney(summary.outstanding_total)}
              bg={colors.dangerBg}
              fg={colors.danger}
            />
            <StatTile
              icon="pie-chart"
              label={`Occupied ${summary.occupied}/${summary.units}`}
              value={`${summary.occupancy_pct}%`}
              bg={colors.infoBg}
              fg={colors.info}
            />
            <StatTile
              icon="home"
              label="Properties"
              value={String(summary.properties)}
              bg={colors.primaryTint}
              fg={colors.primary}
            />
            <StatTile
              icon="tool"
              label="Open tickets"
              value={String(summary.tickets_open)}
              bg={colors.warnBg}
              fg={colors.warn}
            />
          </View>

          {summary.outstanding_by_property.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Outstanding by property</Text>
              <View style={styles.card}>
                {summary.outstanding_by_property.map((row, i) => {
                  const rowStyle = [
                    styles.obpRow,
                    i === 0 ? styles.obpRowFirst : null,
                  ]
                  return (
                    <View key={row.property_id ?? "unassigned"} style={rowStyle}>
                      <Text style={styles.obpName} numberOfLines={1}>
                        {row.property_name}
                      </Text>
                      <Text style={styles.obpAmount}>
                        {formatMoney(row.outstanding)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manage</Text>
        <View style={styles.actionGrid}>
          {ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={styles.actionCard}
              activeOpacity={0.8}
              onPress={() => (navigation as any).navigate(a.key)}
            >
              <View style={styles.actionIcon}>
                <Feather name={a.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
              <Feather name="chevron-right" size={18} color={colors.subtle} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Insights & tools</Text>
        <View style={styles.actionGrid}>
          {TOOLS.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={styles.actionCard}
              activeOpacity={0.8}
              onPress={() => (navigation as any).navigate(a.key)}
            >
              <View style={styles.actionIconAlt}>
                <Feather name={a.icon} size={20} color={colors.info} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
              <Feather name="chevron-right" size={18} color={colors.subtle} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function StatTile({
  icon,
  label,
  value,
  bg,
  fg,
}: {
  icon: any
  label: string
  value: string
  bg: string
  fg: string
}) {
  const iconStyle = [styles.statIcon, { backgroundColor: bg }]
  return (
    <View style={styles.statTile}>
      <View style={iconStyle}>
        <Feather name={icon} size={18} color={fg} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  logoutBtn: { padding: spacing.xs },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: "hidden",
    ...shadow.card,
  },
  heroGlow: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.primary,
    opacity: 0.22,
  },
  heroLabel: { color: "#AEC7C0", fontSize: font.small, fontWeight: "600" },
  heroValue: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "800",
    marginTop: spacing.xs,
    letterSpacing: 0.3,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginTop: spacing.md,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  heroSub: {
    color: "#C4D6D0",
    fontSize: font.small,
    marginTop: spacing.sm,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: "46%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: { fontSize: font.h2, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  section: { marginTop: spacing.lg },
  sectionTitle: {
    fontSize: font.small,
    fontWeight: "800",
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  obpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  obpRowFirst: { borderTopWidth: 0 },
  obpName: { fontSize: font.body, color: colors.text, flex: 1, marginRight: spacing.md },
  obpAmount: { fontSize: font.body, fontWeight: "800", color: colors.danger },
  actionGrid: { gap: spacing.sm },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  actionIconAlt: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.infoBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  actionLabel: { flex: 1, fontSize: font.body, fontWeight: "700", color: colors.text },
})
