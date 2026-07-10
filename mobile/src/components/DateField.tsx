import DateTimePicker from "@react-native-community/datetimepicker"
import React, { useState } from "react"
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { formatDate } from "../lib/format"
import { colors, spacing } from "../theme"

type DateFieldProps = {
  label: string
  value: string // "YYYY-MM-DD" or ""
  onChangeText: (text: string) => void
  error?: string
  editable?: boolean
  placeholder?: string
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// Tap-to-open date picker. Displays the value as "DD MMM YYYY" but always
// stores/returns an ISO "YYYY-MM-DD" string. No manual typing.
export function DateField({
  label,
  value,
  onChangeText,
  error,
  editable = true,
  placeholder = "Select date",
}: DateFieldProps) {
  const [show, setShow] = useState(false)

  const hasValue = ISO_RE.test(value)
  const parsed = hasValue ? new Date(`${value}T00:00:00`) : new Date()
  const initialDate = isNaN(parsed.getTime()) ? new Date() : parsed

  function onPickerChange(event: { type?: string }, selected?: Date) {
    // Android dismisses itself; hide either way.
    if (Platform.OS !== "ios") setShow(false)
    if (event?.type === "dismissed" || !selected) {
      setShow(false)
      return
    }
    const yyyy = selected.getFullYear()
    const mm = String(selected.getMonth() + 1).padStart(2, "0")
    const dd = String(selected.getDate()).padStart(2, "0")
    onChangeText(`${yyyy}-${mm}-${dd}`)
    if (Platform.OS === "ios") setShow(false)
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, error ? styles.inputError : null]}
        onPress={() => editable && setShow(true)}
        activeOpacity={0.7}
        disabled={!editable}
      >
        <Text style={hasValue ? styles.valueText : styles.placeholderText}>
          {hasValue ? formatDate(value) : placeholder}
        </Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {show ? (
        <DateTimePicker
          value={initialDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  valueText: { fontSize: 16, color: colors.text },
  placeholderText: { fontSize: 16, color: colors.muted },
  calendarIcon: { fontSize: 18, marginLeft: spacing.sm },
  errorText: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
})
