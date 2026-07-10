import { Feather } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useCallback, useState } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { CenteredMessage } from "../components/ui"
import { apiFetch } from "../lib/api"
import { formatMoney } from "../lib/format"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, font, radius, shadow, spacing } from "../theme"
import type { CalendarCharge } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "RentCalendar">

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function monthKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`
}

export default function RentCalendarScreen({ navigation }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-12
  const [charges, setCharges] = useState<CalendarCharge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const key = monthKey(year, month)
      const data = await apiFetch<{ charges: CalendarCharge[] }>(
        `/api/v1/rent-charges/calendar?month=${key}`
      )
      setCharges(data.charges ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendar.")
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const goPrev = () => {
    setSelectedDay(null)
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const goNext = () => {
    setSelectedDay(null)
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const chargesForDay = (day: number) =>
    charges.filter((c) => Number(String(c.due_date).slice(8, 10)) === day)

  const expected = charges.reduce((a, c) => a + Number(c.amount ?? 0), 0)
  const collected = charges.reduce((a, c) => a + Number(c.amount_paid ?? 0), 0)
  const outstanding = Math.max(0, expected - collected)

  const startWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: Array<number | null> = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedCharges = selectedDay ? chargesForDay(selectedDay) : []

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.navBtn} onPress={goPrev} activeOpacity={0.7}>
          <Feather name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <TouchableOpacity style={styles.navBtn} onPress={goNext} activeOpacity={0.7}>
          <Feather name="chevron-right" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Collected</Text>
          <Text style={[styles.summaryValue, styles.collectedText]}>
            {formatMoney(collected)}
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Outstanding</Text>
          <Text style={[styles.summaryValue, styles.outstandingText]}>
            {formatMoney(outstanding)}
          </Text>
        </View>
      </View>

      {loading ? (
        <CenteredMessage loading text="Loading calendar…" />
      ) : error ? (
        <CenteredMessage
          error
          text={error}
          actionLabel="Try Again"
          onAction={load}
        />
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, i) => (
                <View key={`wd-${i}`} style={styles.headCell}>
                  <Text style={styles.headText}>{w}</Text>
                </View>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null) {
                  return <View key={`empty-${i}`} style={styles.dayCell} />
                }
                const dayCharges = chargesForDay(day)
                const hasUnpaid = dayCharges.some((c) => c.status === "due")
                const hasPartial = dayCharges.some(
                  (c) => c.status === "partial"
                )
                let dotStyle = null
                if (dayCharges.length > 0) {
                  dotStyle = hasUnpaid
                    ? styles.dotUnpaid
                    : hasPartial
                      ? styles.dotPartial
                      : styles.dotPaid
                }
                const isSelected = selectedDay === day
                const hasCharges = dayCharges.length > 0
                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    style={styles.dayCell}
                    activeOpacity={hasCharges ? 0.6 : 1}
                    onPress={() =>
                      setSelectedDay(
                        hasCharges ? (isSelected ? null : day) : null
                      )
                    }
                  >
                    <View
                      style={[
                        styles.dayInner,
                        isSelected ? styles.daySelected : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          isSelected ? styles.dayNumSelected : null,
                        ]}
                      >
                        {day}
                      </Text>
                      {dotStyle ? (
                        <View style={[styles.dot, dotStyle]} />
                      ) : (
                        <View style={styles.dotPlaceholder} />
                      )}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.legend}>
              <Legend color={colors.success} label="Paid" />
              <Legend color={colors.warn} label="Partial" />
              <Legend color={colors.danger} label="Unpaid" />
            </View>
          </View>

          {selectedDay ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Due on {selectedDay} {MONTH_NAMES[month - 1]}
              </Text>
              {selectedCharges.map((c) => {
                const remaining =
                  Number(c.amount) - Number(c.amount_paid ?? 0)
                const sub =
                  c.status === "paid"
                    ? "Paid"
                    : `${formatMoney(remaining)} left`
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.chargeRow}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigation.navigate("RentCollect", {
                        chargeId: c.id,
                        leaseId: c.lease_id,
                      })
                    }
                  >
                    <View style={styles.chargeInfo}>
                      <Text style={styles.chargeName} numberOfLines={1}>
                        {c.tenant_name}
                      </Text>
                      <Text style={styles.chargeMeta}>
                        {formatMoney(c.amount)} · {sub}
                      </Text>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={18}
                      color={colors.subtle}
                    />
                  </TouchableOpacity>
                )
              })}
            </View>
          ) : (
            <Text style={styles.hint}>
              Tap a highlighted day to see the rent due that day.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: { fontSize: font.h3, fontWeight: "800", color: colors.text },
  summaryRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  summaryTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  summaryLabel: { fontSize: font.small, color: colors.muted },
  summaryValue: { fontSize: font.h3, fontWeight: "800", marginTop: 2 },
  collectedText: { color: colors.success },
  outstandingText: { color: colors.danger },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  weekRow: { flexDirection: "row" },
  headCell: { width: "14.2857%", alignItems: "center", paddingVertical: 4 },
  headText: { fontSize: font.tiny, fontWeight: "700", color: colors.subtle },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.2857%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  dayInner: {
    width: 38,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  daySelected: { backgroundColor: colors.primaryTint },
  dayNum: { fontSize: font.small, color: colors.text, fontWeight: "600" },
  dayNumSelected: { color: colors.primaryDark, fontWeight: "800" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  dotPlaceholder: { width: 6, height: 6, marginTop: 3 },
  dotPaid: { backgroundColor: colors.success },
  dotPartial: { backgroundColor: colors.warn },
  dotUnpaid: { backgroundColor: colors.danger },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: font.small, color: colors.muted },
  section: { marginTop: spacing.lg },
  sectionTitle: {
    fontSize: font.small,
    fontWeight: "800",
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chargeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  chargeInfo: { flex: 1 },
  chargeName: { fontSize: font.body, fontWeight: "700", color: colors.text },
  chargeMeta: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  hint: {
    fontSize: font.small,
    color: colors.subtle,
    textAlign: "center",
    marginTop: spacing.lg,
  },
})
