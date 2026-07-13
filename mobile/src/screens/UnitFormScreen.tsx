import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useLayoutEffect, useState } from "react"
import { Alert, ScrollView, StyleSheet, View } from "react-native"
import { AppButton, CenteredMessage, ErrorText, Field } from "../components/ui"
import { apiFetch } from "../lib/api"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { spacing } from "../theme"
import type { Unit } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "UnitForm">

type ParseResult =
  | { ok: true; value?: number }
  | { ok: false; message: string }

function parseOptionalCount(text: string, label: string): ParseResult {
  const t = text.trim()
  if (t === "") return { ok: true, value: undefined }
  const n = Number(t)
  if (!Number.isInteger(n) || n < 0) {
    return {
      ok: false,
      message: `${label} must be a whole number (0 or more).`,
    }
  }
  return { ok: true, value: n }
}

export default function UnitFormScreen({ route, navigation }: Props) {
  const { propertyId, unitId } = route.params
  const isEdit = Boolean(unitId)

  const [unitNumber, setUnitNumber] = useState("")
  const [description, setDescription] = useState("")
  const [bedrooms, setBedrooms] = useState("")
  const [bathrooms, setBathrooms] = useState("")
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? "Edit Unit" : "New Unit" })
  }, [navigation, isEdit])

  useEffect(() => {
    if (!isEdit || !unitId) return
    let active = true
    ;(async () => {
      try {
        const u = await apiFetch<Unit>(`/api/v1/units/${unitId}`)
        if (!active) return
        setUnitNumber(u.unit_number)
        setDescription(u.description ?? "")
        setBedrooms(u.bedrooms != null ? String(u.bedrooms) : "")
        setBathrooms(u.bathrooms != null ? String(u.bathrooms) : "")
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : "Failed to load unit.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [isEdit, unitId])

  async function handleSave() {
    setError(null)
    const trimmedUnit = unitNumber.trim()
    if (!trimmedUnit) {
      setError("Unit number is required.")
      return
    }

    const bed = parseOptionalCount(bedrooms, "Bedrooms")
    if (!bed.ok) {
      setError(bed.message)
      return
    }
    const bath = parseOptionalCount(bathrooms, "Bathrooms")
    if (!bath.ok) {
      setError(bath.message)
      return
    }

    const payload: Record<string, unknown> = { unit_number: trimmedUnit }
    const desc = description.trim()
    if (desc) payload.description = desc
    if (bed.value !== undefined) payload.bedrooms = bed.value
    if (bath.value !== undefined) payload.bathrooms = bath.value

    setSaving(true)
    try {
      if (isEdit && unitId) {
        await apiFetch<Unit>(`/api/v1/units/${unitId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      } else {
        payload.property_id = propertyId
        await apiFetch<Unit>("/api/v1/units", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      navigation.goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save unit.")
      setSaving(false)
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete unit?",
      "This permanently deletes this unit. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: handleDelete },
      ]
    )
  }

  async function handleDelete() {
    if (!unitId) return
    setError(null)
    setDeleting(true)
    try {
      await apiFetch(`/api/v1/units/${unitId}`, { method: "DELETE" })
      navigation.goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete unit.")
      setDeleting(false)
    }
  }

  if (loading) return <CenteredMessage loading text="Loading…" />

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Field
        label="Unit number *"
        value={unitNumber}
        onChangeText={setUnitNumber}
        placeholder="e.g. 101"
        editable={!saving && !deleting}
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Corner unit, south facing"
        multiline
        editable={!saving && !deleting}
      />
      <Field
        label="Bedrooms"
        value={bedrooms}
        onChangeText={setBedrooms}
        placeholder="e.g. 2"
        keyboardType="number-pad"
        editable={!saving && !deleting}
      />
      <Field
        label="Bathrooms"
        value={bathrooms}
        onChangeText={setBathrooms}
        placeholder="e.g. 1"
        keyboardType="number-pad"
        editable={!saving && !deleting}
      />

      {error ? <ErrorText text={error} /> : null}

      <View style={styles.spacerMd} />
      <AppButton
        title={isEdit ? "Save Changes" : "Create Unit"}
        onPress={handleSave}
        loading={saving}
        disabled={deleting}
      />

      {isEdit ? (
        <>
          <View style={styles.spacerSm} />
          <AppButton
            title="Delete Unit"
            variant="danger"
            onPress={confirmDelete}
            loading={deleting}
            disabled={saving}
          />
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  spacerMd: { height: spacing.md },
  spacerSm: { height: spacing.sm },
})
