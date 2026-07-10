import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useCallback, useLayoutEffect, useState } from "react"
import {
  FlatList,
  Linking,
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

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
}
const FURNISHING_LABELS: Record<string, string> = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi-furnished",
  furnished: "Furnished",
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

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

  const hasSpecs =
    property.property_type != null ||
    property.furnishing != null ||
    property.floors != null ||
    property.area_sqft != null ||
    (property.amenities != null && property.amenities.trim() !== "")

  const hasOwner =
    property.owner_name != null ||
    property.owner_phone != null ||
    property.owner_email != null ||
    property.owner_pan != null

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

            {hasSpecs ? (
              <View style={styles.detailBlock}>
                {property.property_type ? (
                  <DetailRow
                    label="Type"
                    value={
                      TYPE_LABELS[property.property_type] ??
                      property.property_type
                    }
                  />
                ) : null}
                {property.furnishing ? (
                  <DetailRow
                    label="Furnishing"
                    value={
                      FURNISHING_LABELS[property.furnishing] ??
                      property.furnishing
                    }
                  />
                ) : null}
                {property.floors != null ? (
                  <DetailRow label="Floors" value={String(property.floors)} />
                ) : null}
                {property.area_sqft != null ? (
                  <DetailRow
                    label="Area"
                    value={`${Number(property.area_sqft)} sq.ft`}
                  />
                ) : null}
                {property.amenities ? (
                  <DetailRow label="Amenities" value={property.amenities} />
                ) : null}
              </View>
            ) : null}

            {property.maps_link ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(property.maps_link as string)}
                activeOpacity={0.7}
                style={styles.mapsBtn}
              >
                <Text style={styles.mapsText}>Open in Google Maps</Text>
              </TouchableOpacity>
            ) : null}

            {hasOwner ? (
              <View style={styles.detailBlock}>
                <Text style={styles.ownerHeading}>Owner</Text>
                {property.owner_name ? (
                  <DetailRow label="Name" value={property.owner_name} />
                ) : null}
                {property.owner_phone ? (
                  <DetailRow label="Phone" value={property.owner_phone} />
                ) : null}
                {property.owner_email ? (
                  <DetailRow label="Email" value={property.owner_email} />
                ) : null}
                {property.owner_pan ? (
                  <DetailRow label="PAN" value={property.owner_pan} />
                ) : null}
              </View>
            ) : null}
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
  detailBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  detailLabel: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  ownerHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.subtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  mapsBtn: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    backgroundColor: colors.primaryTint,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mapsText: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
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
