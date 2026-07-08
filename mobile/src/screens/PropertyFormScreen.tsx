import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useLayoutEffect, useState } from "react"
import { Alert, ScrollView, StyleSheet, View } from "react-native"
import { AppButton, CenteredMessage, ErrorText, Field } from "../components/ui"
import { apiFetch } from "../lib/api"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { spacing } from "../theme"
import type { Property } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "PropertyForm">

export default function PropertyFormScreen({ route, navigation }: Props) {
  const propertyId = route.params?.propertyId
  const isEdit = Boolean(propertyId)

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
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

    const payload: Record<string, unknown> = { name: trimmedName }
    const addr = address.trim()
    if (addr) payload.address = addr

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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Field
        label="Name *"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Maple Court"
        editable={!saving && !deleting}
      />
      <Field
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="e.g. 12 Maple St"
        editable={!saving && !deleting}
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  spacerMd: { height: spacing.md },
  spacerSm: { height: spacing.sm },
})
