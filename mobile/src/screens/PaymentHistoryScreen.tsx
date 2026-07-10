import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useCallback, useLayoutEffect, useState } from "react"
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { CenteredMessage } from "../components/ui"
import { apiFetch } from "../lib/api"
import { formatDate, formatMoney } from "../lib/format"
import { paymentMethodMeta } from "../lib/paymentMethods"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { Payment } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "PaymentHistory">

export default function PaymentHistoryScreen({ route, navigation }: Props) {
  const { leaseId, chargeId } = route.params ?? {}

  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Payment History" })
  }, [navigation])

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (chargeId) params.set("rent_charge_id", chargeId)
        else if (leaseId) params.set("lease_id", leaseId)
        const data = await apiFetch<Payment[]>(
          `/api/v1/payments?${params.toString()}`
        )
        setPayments(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [leaseId, chargeId]
  )

  useFocusEffect(
    useCallback(() => {
      load("initial")
    }, [load])
  )

  if (loading) return <CenteredMessage loading text="Loading payments…" />

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

  const total = payments.reduce((a, p) => a + Number(p.amount ?? 0), 0)

  return (
    <FlatList
      data={payments}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        payments.length === 0 ? styles.emptyContainer : styles.listContent
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load("refresh")}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        payments.length > 0 ? (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total received</Text>
            <Text style={styles.totalValue}>{formatMoney(total)}</Text>
            <Text style={styles.totalSub}>
              {payments.length} payment{payments.length === 1 ? "" : "s"}
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <CenteredMessage
          text="No payments yet"
          subtext="Payments recorded against this rent will show up here."
        />
      }
      renderItem={({ item }) => {
        const meta = paymentMethodMeta(item.method)
        return (
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{meta.icon}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.method}>{meta.label}</Text>
              <Text style={styles.sub}>
                {formatDate(item.paid_date)}
                {item.reference ? ` · ${item.reference}` : ""}
              </Text>
              {item.note ? (
                <Text style={styles.note} numberOfLines={2}>
                  {item.note}
                </Text>
              ) : null}
            </View>
            <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
          </View>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.md },
  emptyContainer: { flexGrow: 1 },
  totalCard: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  totalLabel: { color: colors.white, opacity: 0.85, fontSize: 14 },
  totalValue: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  totalSub: { color: colors.white, opacity: 0.85, fontSize: 13, marginTop: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  icon: { fontSize: 20 },
  info: { flex: 1 },
  method: { fontSize: 16, fontWeight: "700", color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  note: { fontSize: 13, color: colors.muted, marginTop: 2, fontStyle: "italic" },
  amount: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginLeft: spacing.sm,
  },
})