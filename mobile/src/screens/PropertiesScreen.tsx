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
import { supabase } from "../lib/supabase"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { Property } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "Properties">

export default function PropertiesScreen({ navigation }: Props) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Configure the navigator's header: title, Log Out (left), and + (right).
  // This replaces the old Stage 1 custom in-screen header.
  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Properties",
      headerLeft: () => (
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("PropertyForm", {})}
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
      const data = await apiFetch<Property[]>("/api/v1/properties")
      setProperties(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Reload whenever this screen comes into focus (e.g., after add/edit/delete).
  useFocusEffect(
    useCallback(() => {
      load("initial")
    }, [load])
  )

  if (loading) {
    return <CenteredMessage loading text="Loading properties…" />
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
    <FlatList
      data={properties}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        properties.length === 0 ? styles.emptyContainer : styles.listContent
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
          text="No properties yet"
          subtext="Tap the + button to add your first property."
        />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate("PropertyDetail", { propertyId: item.id })
          }
        >
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>
            {item.address ?? "No address on file"}
          </Text>
        </TouchableOpacity>
      )}
    />
  )
}

const styles = StyleSheet.create({
  logoutText: { color: colors.danger, fontWeight: "600", fontSize: 15 },
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
