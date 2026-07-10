import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useLayoutEffect, useState } from "react"
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { AppButton, CenteredMessage, ErrorText, Field } from "../components/ui"
import { apiFetch } from "../lib/api"
import { titleCase } from "../lib/format"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { MaintenanceStatus, MaintenanceTicket, Unit } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "MaintenanceForm">

const STATUSES: MaintenanceStatus[] = ["open", "in_progress", "closed"]

export default function MaintenanceFormScreen({ route, navigation }: Props) {
  const ticketId = route.params?.ticketId
  const isEdit = Boolean(ticketId)

  const [units, setUnits] = useState<Unit[]>([])
  const [unitId, setUnitId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<MaintenanceStatus>("open")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? "Ticket" : "New Ticket" })
  }, [navigation, isEdit])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        if (isEdit && ticketId) {
          const t = await apiFetch<MaintenanceTicket>(
            `/api/v1/maintenance-tickets/${ticketId}`
          )
          if (!active) return
          setUnitId(t.unit_id)
          setTitle(t.title)
          setDescription(t.description ?? "")
          setStatus(t.status)
        } else {
          const unitList = await apiFetch<Unit[]>("/api/v1/units")
          if (!active) return
          setUnits(unitList)
        }
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : "Failed to load data.")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [isEdit, ticketId])

  async function handleCreate() {
    setError(null)
    if (!unitId) {
      setError("Select a unit.")
      return
    }
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError("Title is required.")
      return
    }
    const payload: Record<string, unknown> = {
      unit_id: unitId,
      title: trimmedTitle,
    }
    const d = description.trim()
    if (d) payload.description = d

    setSaving(true)
    try {
      await apiFetch("/api/v1/maintenance-tickets", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      navigation.goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create ticket.")
      setSaving(false)
    }
  }

  // Ask for confirmation before changing the ticket status.
  function confirmStatusChange(next: MaintenanceStatus) {
    if (!ticketId || next === status || saving) return
    Alert.alert(
      "Change status?",
      `Mark this ticket as "${titleCase(next)}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => handleStatusChange(next) },
      ]
    )
  }

  async function handleStatusChange(next: MaintenanceStatus) {
    if (!ticketId || next === status) return
    setError(null)
    setSaving(true)
    try {
      await apiFetch(`/api/v1/maintenance-tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      })
      setStatus(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <CenteredMessage loading text="Loading…" />

  // EDIT MODE: show ticket details + status controls.
  if (isEdit) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.ticketTitle}>{title}</Text>
          {description ? (
            <Text style={styles.ticketDesc}>{description}</Text>
          ) : (
            <Text style={styles.ticketDescMuted}>No description.</Text>
          )}
        </View>

        <Text style={styles.fieldLabel}>Status</Text>
        <View style={styles.pillRow}>
          {STATUSES.map((s) => {
            const selected = status === s
            return (
              <TouchableOpacity
                key={s}
                style={[styles.pill, selected ? styles.pillSelected : null]}
                onPress={() => confirmStatusChange(s)}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.pillText,
                    selected ? styles.pillTextSelected : null,
                  ]}
                >
                  {titleCase(s)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {error ? <ErrorText text={error} /> : null}
      </ScrollView>
    )
  }

  // CREATE MODE.
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.fieldLabel}>Unit *</Text>
      {units.length === 0 ? (
        <Text style={styles.helper}>
          No units found. Add a unit under a property first.
        </Text>
      ) : (
        <View style={styles.selectWrap}>
          {units.map((u) => {
            const selected = unitId === u.id
            return (
              <TouchableOpacity
                key={u.id}
                style={[styles.option, selected ? styles.optionSelected : null]}
                onPress={() => setUnitId(u.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected ? styles.optionTextSelected : null,
                  ]}
                >
                  Unit {u.unit_number}
                  {u.description ? ` · ${u.description}` : ""}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      <Field
        label="Title *"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Leaking kitchen tap"
        editable={!saving}
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Add any details…"
        multiline
        editable={!saving}
      />

      {error ? <ErrorText text={error} /> : null}

      <View style={styles.spacerMd} />
      <AppButton title="Create Ticket" onPress={handleCreate} loading={saving} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  ticketTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  ticketDesc: { fontSize: 15, color: colors.text, marginTop: spacing.sm },
  ticketDescMuted: { fontSize: 15, color: colors.muted, marginTop: spacing.sm },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  helper: { fontSize: 14, color: colors.muted, marginBottom: spacing.md },
  selectWrap: { marginBottom: spacing.md },
  option: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: "#EFF4FF" },
  optionText: { fontSize: 15, color: colors.text },
  optionTextSelected: { color: colors.primaryDark, fontWeight: "700" },
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
  spacerMd: { height: spacing.md },
})
