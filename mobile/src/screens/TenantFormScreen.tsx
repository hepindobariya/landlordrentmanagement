import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useLayoutEffect, useState } from "react"
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { FormScreen } from "../components/FormScreen"
import { AppButton, CenteredMessage, ErrorText, Field } from "../components/ui"
import { apiFetch } from "../lib/api"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type {
  CoTenant,
  Tenant,
  TenantReference,
  VerificationStatus,
} from "../types"

const STATUSES: VerificationStatus[] = [
  "unverified",
  "pending",
  "verified",
  "failed",
]

type Props = NativeStackScreenProps<RootStackParamList, "TenantForm">

export default function TenantFormScreen({ route, navigation }: Props) {
  const tenantId = route.params?.tenantId
  const isEdit = Boolean(tenantId)

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [pan, setPan] = useState("")
  const [aadhaar, setAadhaar] = useState("")
  const [verification, setVerification] =
    useState<VerificationStatus>("unverified")
  const [coTenants, setCoTenants] = useState<CoTenant[]>([])
  const [references, setReferences] = useState<TenantReference[]>([])
  const [coName, setCoName] = useState("")
  const [coRelation, setCoRelation] = useState("")
  const [coPhone, setCoPhone] = useState("")
  const [refName, setRefName] = useState("")
  const [refRelation, setRefRelation] = useState("")
  const [refPhone, setRefPhone] = useState("")
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
        const [t, cos, refs] = await Promise.all([
          apiFetch<Tenant>(`/api/v1/tenants/${tenantId}`),
          apiFetch<CoTenant[]>(
            `/api/v1/tenants/${tenantId}/co-tenants`
          ).catch(() => []),
          apiFetch<TenantReference[]>(
            `/api/v1/tenants/${tenantId}/references`
          ).catch(() => []),
        ])
        if (!active) return
        setFullName(t.full_name)
        setEmail(t.email ?? "")
        setPhone(t.phone ?? "")
        setPan(t.pan ?? "")
        setAadhaar(t.aadhaar_last4 ?? "")
        setVerification(t.verification_status ?? "unverified")
        setCoTenants(cos)
        setReferences(refs)
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
    const panVal = pan.trim()
    if (panVal) payload.pan = panVal
    const aadhaarVal = aadhaar.trim()
    if (aadhaarVal) {
      if (!/^\d{4}$/.test(aadhaarVal)) {
        setError("Aadhaar must be the last 4 digits.")
        return
      }
      payload.aadhaar_last4 = aadhaarVal
    }
    payload.verification_status = verification

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

  async function addCoTenant() {
    if (!tenantId || !coName.trim()) {
      setError("Enter the co-tenant's name.")
      return
    }
    try {
      await apiFetch(`/api/v1/tenants/${tenantId}/co-tenants`, {
        method: "POST",
        body: JSON.stringify({
          full_name: coName.trim(),
          relation: coRelation.trim() || undefined,
          phone: coPhone.trim() || undefined,
        }),
      })
      setCoName("")
      setCoRelation("")
      setCoPhone("")
      const cos = await apiFetch<CoTenant[]>(
        `/api/v1/tenants/${tenantId}/co-tenants`
      )
      setCoTenants(cos)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add co-tenant.")
    }
  }

  async function removeCoTenant(id: string) {
    if (!tenantId) return
    try {
      await apiFetch(`/api/v1/tenants/${tenantId}/co-tenants/${id}`, {
        method: "DELETE",
      })
      setCoTenants((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      Alert.alert(
        "Could not remove",
        err instanceof Error ? err.message : "Failed."
      )
    }
  }

  async function addReference() {
    if (!tenantId || !refName.trim()) {
      setError("Enter the reference's name.")
      return
    }
    try {
      await apiFetch(`/api/v1/tenants/${tenantId}/references`, {
        method: "POST",
        body: JSON.stringify({
          full_name: refName.trim(),
          relation: refRelation.trim() || undefined,
          phone: refPhone.trim() || undefined,
        }),
      })
      setRefName("")
      setRefRelation("")
      setRefPhone("")
      const refs = await apiFetch<TenantReference[]>(
        `/api/v1/tenants/${tenantId}/references`
      )
      setReferences(refs)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add reference.")
    }
  }

  async function removeReference(id: string) {
    if (!tenantId) return
    try {
      await apiFetch(`/api/v1/tenants/${tenantId}/references/${id}`, {
        method: "DELETE",
      })
      setReferences((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      Alert.alert(
        "Could not remove",
        err instanceof Error ? err.message : "Failed."
      )
    }
  }

  if (loading) return <CenteredMessage loading text="Loading…" />

  const busy = saving || deleting

  return (
    <FormScreen>
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

      <Text style={styles.sectionTitle}>Verification</Text>
      <View style={styles.pillRow}>
        {STATUSES.map((s) => {
          const selected = verification === s
          return (
            <TouchableOpacity
              key={s}
              style={[styles.pill, selected ? styles.pillSelected : null]}
              onPress={() => setVerification(s)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.pillText,
                  selected ? styles.pillTextSelected : null,
                ]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <Field
        label="PAN"
        value={pan}
        onChangeText={setPan}
        placeholder="e.g. ABCDE1234F"
        editable={!busy}
      />
      <Field
        label="Aadhaar (last 4)"
        value={aadhaar}
        onChangeText={setAadhaar}
        placeholder="e.g. 1234"
        keyboardType="numeric"
        editable={!busy}
      />

      {isEdit ? (
        <>
          <Text style={styles.sectionTitle}>Co-tenants</Text>
          {coTenants.length === 0 ? (
            <Text style={styles.helper}>None added yet.</Text>
          ) : (
            coTenants.map((c) => (
              <View key={c.id} style={styles.listRow}>
                <View style={styles.listInfo}>
                  <Text style={styles.listName}>{c.full_name}</Text>
                  {c.relation || c.phone ? (
                    <Text style={styles.listMeta}>
                      {[c.relation, c.phone].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => removeCoTenant(c.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          <View style={styles.childCard}>
            <Field
              label="Name"
              value={coName}
              onChangeText={setCoName}
              placeholder="e.g. Ravi Shah"
              editable={!busy}
            />
            <Field
              label="Relation"
              value={coRelation}
              onChangeText={setCoRelation}
              placeholder="e.g. Spouse"
              editable={!busy}
            />
            <Field
              label="Phone"
              value={coPhone}
              onChangeText={setCoPhone}
              placeholder="e.g. 98765 43210"
              keyboardType="phone-pad"
              editable={!busy}
            />
            <AppButton
              title="Add co-tenant"
              variant="secondary"
              onPress={addCoTenant}
            />
          </View>

          <Text style={styles.sectionTitle}>References</Text>
          {references.length === 0 ? (
            <Text style={styles.helper}>None added yet.</Text>
          ) : (
            references.map((r) => (
              <View key={r.id} style={styles.listRow}>
                <View style={styles.listInfo}>
                  <Text style={styles.listName}>{r.full_name}</Text>
                  {r.relation || r.phone ? (
                    <Text style={styles.listMeta}>
                      {[r.relation, r.phone].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => removeReference(r.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          <View style={styles.childCard}>
            <Field
              label="Name"
              value={refName}
              onChangeText={setRefName}
              placeholder="e.g. Anita Verma"
              editable={!busy}
            />
            <Field
              label="Relation"
              value={refRelation}
              onChangeText={setRefRelation}
              placeholder="e.g. Previous landlord"
              editable={!busy}
            />
            <Field
              label="Phone"
              value={refPhone}
              onChangeText={setRefPhone}
              placeholder="e.g. 98765 43210"
              keyboardType="phone-pad"
              editable={!busy}
            />
            <AppButton
              title="Add reference"
              variant="secondary"
              onPress={addReference}
            />
          </View>
        </>
      ) : (
        <Text style={styles.helper}>
          Save the tenant first to add co-tenants and references.
        </Text>
      )}

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
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  spacerMd: { height: spacing.md },
  spacerSm: { height: spacing.sm },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  helper: { fontSize: 14, color: colors.muted, marginBottom: spacing.md },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  listInfo: { flex: 1 },
  listName: { fontSize: 15, fontWeight: "700", color: colors.text },
  listMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  removeText: { fontSize: 13, fontWeight: "700", color: colors.danger },
  childCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  pillText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    textTransform: "capitalize",
  },
  pillTextSelected: { color: colors.white },
})
