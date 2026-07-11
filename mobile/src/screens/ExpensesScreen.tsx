import { Feather } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useCallback, useLayoutEffect, useState } from "react"
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { CenteredMessage } from "../components/ui"
import { apiFetch } from "../lib/api"
import {
  formatDate,
  formatMoney,
  formatMoneyCompact,
  titleCase,
} from "../lib/format"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, font, radius, shadow, spacing } from "../theme"
import type {
  Expense,
  ExpenseCategory,
  ExpenseSummary,
  Property,
} from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "Expenses">

const CATEGORY_ICON: Record<string, any> = {
  mortgage: "credit-card",
  taxes: "percent",
  insurance: "shield",
  repairs: "tool",
  landscape: "feather",
  pest_control: "target",
  management_fee: "briefcase",
  appliance: "cpu",
  utilities: "zap",
  other: "tag",
}

const FILTERS: Array<{ key: "all" | ExpenseCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "repairs", label: "Repairs" },
  { key: "taxes", label: "Taxes" },
  { key: "insurance", label: "Insurance" },
  { key: "mortgage", label: "Mortgage" },
  { key: "utilities", label: "Utilities" },
  { key: "management_fee", label: "Mgmt fee" },
  { key: "landscape", label: "Landscape" },
  { key: "pest_control", label: "Pest" },
  { key: "appliance", label: "Appliance" },
  { key: "other", label: "Other" },
]

export default function ExpensesScreen({ navigation }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [properties, setProperties] = useState<Record<string, Property>>({})
  const [filter, setFilter] = useState<"all" | ExpenseCategory>("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Expenses",
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate("ExpenseForm", {})}>
          <Text style={styles.addText}>＋</Text>
        </TouchableOpacity>
      ),
    })
  }, [navigation])

  const load = useCallback(
    async (mode: "initial" | "refresh", cat: "all" | ExpenseCategory) => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const listPath =
          cat === "all"
            ? "/api/v1/expenses"
            : `/api/v1/expenses?category=${cat}`
        const [list, sum, props] = await Promise.all([
          apiFetch<Expense[]>(listPath),
          apiFetch<ExpenseSummary>("/api/v1/expenses/summary"),
          apiFetch<Property[]>("/api/v1/properties"),
        ])
        setExpenses(list)
        setSummary(sum)
        const pMap: Record<string, Property> = {}
        props.forEach((p) => {
          pMap[p.id] = p
        })
        setProperties(pMap)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useFocusEffect(
    useCallback(() => {
      load("initial", filter)
    }, [load, filter])
  )

  if (loading) return <CenteredMessage loading text="Loading expenses…" />

  if (error) {
    return (
      <CenteredMessage
        error
        text={error}
        actionLabel="Try Again"
        onAction={() => load("initial", filter)}
      />
    )
  }

  const listHeader = (
    <View>
      {summary ? (
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Total expenses</Text>
          <Text style={styles.heroValue}>
            {formatMoneyCompact(summary.total)}
          </Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroChip}>
              Paid {formatMoneyCompact(summary.paid_total)}
            </Text>
            <Text style={styles.heroChipWarn}>
              Unpaid {formatMoneyCompact(summary.unpaid_total)}
            </Text>
          </View>
          <Text style={styles.heroSub}>
            Tenant-payable {formatMoneyCompact(summary.tenant_payable_total)} ·{" "}
            {summary.count} entries
          </Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key
          const chipStyle = [
            styles.filterChip,
            active ? styles.filterChipActive : null,
          ]
          const textStyle = [
            styles.filterText,
            active ? styles.filterTextActive : null,
          ]
          return (
            <TouchableOpacity
              key={f.key}
              style={chipStyle}
              activeOpacity={0.8}
              onPress={() => setFilter(f.key)}
            >
              <Text style={textStyle}>{f.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )

  return (
    <FlatList
      data={expenses}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={listHeader}
      contentContainerStyle={
        expenses.length === 0 ? styles.emptyContainer : styles.listContent
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load("refresh", filter)}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        <CenteredMessage
          text="No expenses yet"
          subtext="Tap the + button to log a repair, tax, insurance or other cost."
        />
      }
      renderItem={({ item }) => {
        const prop = item.property_id ? properties[item.property_id] : null
        const iconName = CATEGORY_ICON[item.category] ?? "tag"
        return (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate("ExpenseForm", { expenseId: item.id })
            }
          >
            <View style={styles.cardIcon}>
              <Feather name={iconName} size={18} color={colors.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title || titleCase(item.category)}
              </Text>
              <Text style={styles.cardSub} numberOfLines={1}>
                {titleCase(item.category)} · {formatDate(item.spent_on)}
                {prop ? ` · ${prop.name}` : ""}
              </Text>
              <View style={styles.tagRow}>
                {item.is_recurring ? (
                  <Text style={styles.tagInfo}>Recurring</Text>
                ) : null}
                {item.tenant_payable ? (
                  <Text style={styles.tagWarn}>Tenant-payable</Text>
                ) : null}
                {!item.paid ? (
                  <Text style={styles.tagDanger}>Unpaid</Text>
                ) : null}
              </View>
            </View>
            <Text style={styles.cardAmount}>{formatMoney(item.amount)}</Text>
          </TouchableOpacity>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  addText: { color: colors.primary, fontWeight: "700", fontSize: 26 },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  emptyContainer: { flexGrow: 1 },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadow.card,
  },
  heroLabel: { color: "#AEC7C0", fontSize: font.small, fontWeight: "600" },
  heroValue: {
    color: colors.white,
    fontSize: 32,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  heroRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  heroChip: {
    color: colors.white,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    fontSize: font.small,
    fontWeight: "700",
    overflow: "hidden",
  },
  heroChipWarn: {
    color: colors.white,
    backgroundColor: "rgba(220,74,61,0.55)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    fontSize: font.small,
    fontWeight: "700",
    overflow: "hidden",
  },
  heroSub: { color: "#C4D6D0", fontSize: font.small, marginTop: spacing.sm },
  filterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingRight: spacing.md,
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: { fontSize: font.small, fontWeight: "600", color: colors.muted },
  filterTextActive: { color: colors.white },
  card: {
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
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  cardBody: { flex: 1, marginRight: spacing.sm },
  cardTitle: { fontSize: font.body, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tagInfo: {
    fontSize: font.tiny,
    fontWeight: "700",
    color: colors.info,
    backgroundColor: colors.infoBg,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  tagWarn: {
    fontSize: font.tiny,
    fontWeight: "700",
    color: colors.warn,
    backgroundColor: colors.warnBg,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  tagDanger: {
    fontSize: font.tiny,
    fontWeight: "700",
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  cardAmount: { fontSize: font.body, fontWeight: "800", color: colors.text },
})
