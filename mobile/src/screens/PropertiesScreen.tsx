import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { apiFetch } from "../lib/api"
import { supabase } from "../lib/supabase"
import { colors, spacing } from "../theme"

type Property = {
  id: string
  landlord_id: string
  name: string
  address: string | null
  created_at: string
}

export default function PropertiesScreen() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const data = await apiFetch<Property[]>("/api/v1/properties")
      setProperties(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load("initial")
  }, [load])

  async function handleLogout() {
    await supabase.auth.signOut()
    // The auth listener in App.tsx returns to the Login screen.
  }

  function renderBody() {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.mutedText}>Loading properties…</Text>
        </View>
      )
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => load("initial")}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }

    if (properties.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No properties yet</Text>
          <Text style={styles.mutedText}>
            Properties you add will show up here.
          </Text>
        </View>
      )
    }

    return (
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>
              {item.address ?? "No address on file"}
            </Text>
          </View>
        )}
      />
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Properties</Text>
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
          <Text style={styles.logout}>Log Out</Text>
        </TouchableOpacity>
      </View>
      {renderBody()}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  logout: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.danger,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  mutedText: {
    color: colors.muted,
    fontSize: 15,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  listContent: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.xs,
  },
})
