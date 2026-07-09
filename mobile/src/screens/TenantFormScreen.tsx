import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useLayoutEffect, useState } from "react"
import { Alert, ScrollView, StyleSheet, View } from "react-native"
import { AppButton, CenteredMessage, ErrorText, Field } from "../components/ui"
import { apiFetch } from "../lib/api"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { spacing } from "../theme"
import type { Tenant } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "TenantForm">

export default function TenantFormScreen({ route, navigation }: Props) {
  const tenantId = route.params?.tenantId
  const isEdit = Boolean(tenantId)

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? "Edit Tenant" : "New Tenant" })
  }, [navigation, isEdit])

  useEffect(() => {
    if (!isEdit || !tenantId) return
    let active = true
    ;(async () => {
      try {
        const t = await apiFetch<Tenant>(`/api/v1/tenants/${tenantId}`)
        if (!active) return
        setFullName(t.full_name)
        setEmail(t.email ?? "")
        setPhone(t.phone ?? "")
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : "Failed to load tenant.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [isEdit, tenantId])

  async function handleSave() {
    setError(null)
    const trimmedName = fullName.trim()
    if (!trimmedName) {
      setError("Full name is required.")
      return
    }

    const payload: Record<string, unknown> = { full_name: trimmedName }
    const e = email.trim()
    const p = phone.trim()
    if (e) payload.email = e
    if (p) payload.phone = p

    setSaving(true)
    try {
      if (isEdit && tenantId) {
        await apiFetch<Tenant>(`/api/v1/tenants/${tenantId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<Tenant>("/api/v1/tenants", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      navigation.goBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tenant.")
      setSaving(false)
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete tenant?",
      "This permanently deletes this tenant. Leases referencing them may be affected. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: handleDelete },
      ]
    )
  }

  async function handleDelete() {
    if (!tenantId) return
    setError(null)
    setDeleting(true)
    try {
      await apiFetch(`/api/v1/tenants/${tenantId}`, { method: "DELETE" })
      navigation.goBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tenant.")
      setDeleting(false)
    }
  }

  if (loading) return <CenteredMessage loading text="Loading…" />

  const busy = saving || deleting

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Field
        label="Full Name *"
        value={fullName}
        onChangeText={setFullName}
        placeholder="e.g. Priya Shah"
        editable={!busy}
      />
      <Field
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="e.g. 98765 43210"
        keyboardType="phone-pad"
        editable={!busy}
      />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="e.g. priya@example.com"
        keyboardType="email-address"
        editable={!busy}
      />

      {error ? <ErrorText text={error} /> : null}

      <View style={styles.spacerMd} />
      <AppButton
        title={isEdit ? "Save Changes" : "Create Tenant"}
        onPress={handleSave}
        loading={saving}
        disabled={deleting}
      />

      {isEdit ? (
        <>
          <View style={styles.spacerSm} />
          <AppButton
            title="Delete Tenant"
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
