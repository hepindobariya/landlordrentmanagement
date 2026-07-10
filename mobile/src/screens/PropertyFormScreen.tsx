import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useLayoutEffect, useState } from "react"
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { FormScreen } from "../components/FormScreen"
import { AppButton, CenteredMessage, ErrorText, Field } from "../components/ui"
import { apiFetch } from "../lib/api"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { Furnishing, Property, PropertyType } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "PropertyForm">

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
]

const FURNISHINGS: { value: Furnishing; label: string }[] = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi-furnished" },
  { value: "furnished", label: "Furnished" },
]

export default function PropertyFormScreen({ route, navigation }: Props) {
  const propertyId = route.params?.propertyId
  const isEdit = Boolean(propertyId)

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null)
  const [furnishing, setFurnishing] = useState<Furnishing | null>(null)
  const [mapsLink, setMapsLink] = useState("")
  const [floors, setFloors] = useState("")
  const [areaSqft, setAreaSqft] = useState("")
  const [amenities, setAmenities] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [ownerPhone, setOwnerPhone] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [ownerPan, setOwnerPan] = useState("")

  const [loading, setLoading] = useState(isEdit) // load existing when editing
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? "Edit Property" : "New Property" })
  }, [navigation, isEdit])

  useEffect(() => {
    if (!isEdit || !propertyId) return
    let active = true
    ;(async () => {
      try {
        const p = await apiFetch<Property>(`/api/v1/properties/${propertyId}`)
        if (!active) return
        setName(p.name)
        setAddress(p.address ?? "")
        setPropertyType(p.property_type ?? null)
        setFurnishing(p.furnishing ?? null)
        setMapsLink(p.maps_link ?? "")
        setFloors(p.floors != null ? String(p.floors) : "")
        setAreaSqft(p.area_sqft != null ? String(Number(p.area_sqft)) : "")
        setAmenities(p.amenities ?? "")
        setOwnerName(p.owner_name ?? "")
        setOwnerPhone(p.owner_phone ?? "")
        setOwnerEmail(p.owner_email ?? "")
        setOwnerPan(p.owner_pan ?? "")
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : "Failed to load property.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [isEdit, propertyId])

  async function handleSave() {
    setError(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Name is required.")
      return
    }

    let floorsVal: number | null = null
    if (floors.trim()) {
      const n = Number(floors)
      if (!Number.isInteger(n) || n < 0) {
        setError("Floors must be a whole number (0 or more).")
        return
      }
      floorsVal = n
    }

    let areaVal: number | null = null
    if (areaSqft.trim()) {
      const n = Number(areaSqft)
      if (!Number.isFinite(n) || n < 0) {
        setError("Area must be a valid number.")
        return
      }
      areaVal = n
    }

    const email = ownerEmail.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid owner email or leave it blank.")
      return
    }

    const payload: Record<string, unknown> = {
      name: trimmedName,
      address: address.trim() || null,
      property_type: propertyType,
      furnishing: furnishing,
      maps_link: mapsLink.trim() || null,
      floors: floorsVal,
      area_sqft: areaVal,
      amenities: amenities.trim() || null,
      owner_name: ownerName.trim() || null,
      owner_phone: ownerPhone.trim() || null,
      owner_email: email || null,
      owner_pan: ownerPan.trim() ? ownerPan.trim().toUpperCase() : null,
    }

    setSaving(true)
    try {
      if (isEdit && propertyId) {
        await apiFetch<Property>(`/api/v1/properties/${propertyId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<Property>("/api/v1/properties", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      navigation.goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save property.")
      setSaving(false)
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete property?",
      "This permanently deletes this property and everything under it (units, leases, charges). This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: handleDelete },
      ]
    )
  }

  async function handleDelete() {
    if (!propertyId) return
    setError(null)
    setDeleting(true)
    try {
      await apiFetch(`/api/v1/properties/${propertyId}`, { method: "DELETE" })
      navigation.popToTop() // return to the Properties list
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete property.")
      setDeleting(false)
    }
  }

  if (loading) return <CenteredMessage loading text="Loading…" />

  const busy = saving || deleting

  return (
    <FormScreen>
      <Field
        label="Name *"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Maple Court"
        editable={!busy}
      />
      <Field
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="e.g. 12 Maple St"
        editable={!busy}
      />

      <Text style={styles.fieldLabel}>Property type</Text>
      <View style={styles.pillRow}>
        {PROPERTY_TYPES.map((opt) => {
          const selected = propertyType === opt.value
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.pill, selected ? styles.pillSelected : null]}
              onPress={() => setPropertyType(selected ? null : opt.value)}
              activeOpacity={0.8}
              disabled={busy}
            >
              <Text
                style={[
                  styles.pillText,
                  selected ? styles.pillTextSelected : null,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <Text style={styles.fieldLabel}>Furnishing</Text>
      <View style={styles.pillRow}>
        {FURNISHINGS.map((opt) => {
          const selected = furnishing === opt.value
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.pill, selected ? styles.pillSelected : null]}
              onPress={() => setFurnishing(selected ? null : opt.value)}
              activeOpacity={0.8}
              disabled={busy}
            >
              <Text
                style={[
                  styles.pillText,
                  selected ? styles.pillTextSelected : null,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={styles.spacerSm} />
      <Field
        label="Floors"
        value={floors}
        onChangeText={setFloors}
        keyboardType="numeric"
        placeholder="e.g. 3"
        editable={!busy}
      />
      <Field
        label="Area (sq.ft)"
        value={areaSqft}
        onChangeText={setAreaSqft}
        keyboardType="numeric"
        placeholder="e.g. 1200"
        editable={!busy}
      />
      <Field
        label="Google Maps link"
        value={mapsLink}
        onChangeText={setMapsLink}
        placeholder="https://maps.google.com/…"
        editable={!busy}
      />
      <Field
        label="Amenities"
        value={amenities}
        onChangeText={setAmenities}
        placeholder="e.g. Lift, Parking, Power backup"
        multiline
        editable={!busy}
      />

      <Text style={styles.sectionLabel}>Owner details</Text>
      <Field
        label="Owner name"
        value={ownerName}
        onChangeText={setOwnerName}
        placeholder="e.g. Ramesh Kumar"
        editable={!busy}
      />
      <Field
        label="Owner phone"
        value={ownerPhone}
        onChangeText={setOwnerPhone}
        keyboardType="phone-pad"
        placeholder="e.g. 98765 43210"
        editable={!busy}
      />
      <Field
        label="Owner email"
        value={ownerEmail}
        onChangeText={setOwnerEmail}
        keyboardType="email-address"
        placeholder="e.g. owner@email.com"
        editable={!busy}
      />
      <Field
        label="Owner PAN"
        value={ownerPan}
        onChangeText={setOwnerPan}
        placeholder="e.g. ABCDE1234F"
        editable={!busy}
      />

      {error ? <ErrorText text={error} /> : null}

      <View style={styles.spacerMd} />
      <AppButton
        title={isEdit ? "Save Changes" : "Create Property"}
        onPress={handleSave}
        loading={saving}
        disabled={deleting}
      />

      {isEdit ? (
        <>
          <View style={styles.spacerSm} />
          <AppButton
            title="Delete Property"
            variant="danger"
            onPress={confirmDelete}
            loading={deleting}
            disabled={saving}
          />
        </>
      ) : null}
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: spacing.xs,
    marginLeft: 2,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 14, fontWeight: "600", color: colors.text },
  pillTextSelected: { color: colors.white },
  spacerSm: { height: spacing.sm },
  spacerMd: { height: spacing.md },
})
