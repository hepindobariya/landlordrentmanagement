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
import { CenteredMessage } from "../components/ui"
import { apiFetch } from "../lib/api"
import { titleCase } from "../lib/format"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { MaintenanceTicket, Unit } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "Maintenance">

export default function MaintenanceScreen({ navigation }: Props) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([])
  const [units, setUnits] = useState<Record<string, Unit>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Maintenance",
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("MaintenanceForm", {})}
        >
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
      const [ticketList, unitList] = await Promise.all([
        apiFetch<MaintenanceTicket[]>("/api/v1/maintenance-tickets"),
        apiFetch<Unit[]>("/api/v1/units"),
      ])
      setTickets(ticketList)
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
  }, [])

  useFocusEffect(
    useCallback(() => {
      load("initial")
    }, [load])
  )

  if (loading) return <CenteredMessage loading text="Loading tickets…" />

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
      data={tickets}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        tickets.length === 0 ? styles.emptyContainer : styles.listContent
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
          text="No maintenance tickets"
          subtext="Tap the + button to log a repair request."
        />
      }
      renderItem={({ item }) => {
        const unit = units[item.unit_id]
        const isClosed = item.status === "closed"
        return (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate("MaintenanceForm", { ticketId: item.id })
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View
                style={[
                  styles.badge,
                  isClosed
                    ? styles.badgeClosed
                    : item.status === "in_progress"
                      ? styles.badgeProgress
                      : styles.badgeOpen,
                ]}
              >
                <Text style={styles.badgeText}>{titleCase(item.status)}</Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>
              Unit {unit ? unit.unit_number : "—"}
            </Text>
          </TouchableOpacity>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  addText: { color: colors.primary, fontWeight: "700", fontSize: 26 },
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
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 },
  cardSubtitle: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  badgeOpen: { backgroundColor: "#FEE2E2" },
  badgeProgress: { backgroundColor: "#FEF3C7" },
  badgeClosed: { backgroundColor: "#DCFCE7" },
  badgeText: { fontSize: 12, fontWeight: "700", color: colors.text },
})
