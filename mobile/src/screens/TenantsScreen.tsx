import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useCallback, useLayoutEffect, useState } from "react"
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native"
import { CenteredMessage } from "../components/ui"
import { apiFetch } from "../lib/api"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { Tenant } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "Tenants">

export default function TenantsScreen({ navigation }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Tenants",
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate("TenantForm", {})}>
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
      const data = await apiFetch<Tenant[]>("/api/v1/tenants")
      setTenants(data)
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

  if (loading) return <CenteredMessage loading text="Loading tenants…" />

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
      data={tenants}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        tenants.length === 0 ? styles.emptyContainer : styles.listContent
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
          text="No tenants yet"
          subtext="Add your first tenant to get started."
          actionLabel="Add Tenant"
          onAction={() => navigation.navigate("TenantForm", {})}
        />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate("TenantDetail", { tenantId: item.id })
          }
        >
          <Text style={styles.cardTitle}>{item.full_name}</Text>
          <Text style={styles.cardSubtitle}>
            {item.phone ?? item.email ?? "No contact on file"}
          </Text>
        </TouchableOpacity>
      )}
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
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  cardSubtitle: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
})
