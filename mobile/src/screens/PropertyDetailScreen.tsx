import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useCallback, useLayoutEffect, useState } from "react"
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { AppButton, CenteredMessage } from "../components/ui"
import { apiFetch } from "../lib/api"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { Property, Unit } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "PropertyDetail">

export default function PropertyDetailScreen({ route, navigation }: Props) {
  const { propertyId } = route.params
  const [property, setProperty] = useState<Property | null>(null)
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prop, unitList] = await Promise.all([
        apiFetch<Property>(`/api/v1/properties/${propertyId}`),
        apiFetch<Unit[]>(`/api/v1/units?property_id=${propertyId}`),
      ])
      setProperty(prop)
      setUnits(unitList)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  // Add an "Edit" button to the header once the property is loaded.
  useLayoutEffect(() => {
    navigation.setOptions({
      title: property?.name ?? "Property",
      headerRight: () =>
        property ? (
          <TouchableOpacity
            onPress={() => navigation.navigate("PropertyForm", { propertyId })}
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        ) : null,
    })
  }, [navigation, property, propertyId])

  if (loading) return <CenteredMessage loading text="Loading…" />
  if (error)
    return (
      <CenteredMessage
        error
        text={error}
        actionLabel="Try Again"
        onAction={load}
      />
    )
  if (!property) return <CenteredMessage text="Property not found." />

  return (
    <FlatList
      data={units}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View>
          <View style={styles.infoCard}>
            <Text style={styles.propertyName}>{property.name}</Text>
            <Text style={styles.propertyAddress}>
              {property.address ?? "No address on file"}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Units</Text>
          <AppButton
            title="+ Add Unit"
            onPress={() => navigation.navigate("UnitForm", { propertyId })}
          />
          <View style={styles.spacerMd} />
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.emptyUnits}>
          No units yet. Add your first unit above.
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.unitCard}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate("UnitForm", { propertyId, unitId: item.id })
          }
        >
          <Text style={styles.unitTitle}>Unit {item.unit_number}</Text>
          <Text style={styles.unitSub}>
            {[
              item.bedrooms != null ? `${item.bedrooms} bed` : null,
              item.bathrooms != null ? `${item.bathrooms} bath` : null,
            ]
              .filter(Boolean)
              .join(" · ") || (item.description ?? "Tap to edit")}
          </Text>
        </TouchableOpacity>
      )}
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  editText: { color: colors.primary, fontWeight: "700", fontSize: 15 },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  propertyName: { fontSize: 20, fontWeight: "700", color: colors.text },
  propertyAddress: { fontSize: 15, color: colors.muted, marginTop: spacing.xs },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  spacerMd: { height: spacing.md },
  emptyUnits: {
    color: colors.muted,
    fontSize: 15,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  unitCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  unitTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  unitSub: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
})
