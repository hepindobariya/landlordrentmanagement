import DateTimePicker from "@react-native-community/datetimepicker"
import React, { useState } from "react"
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { colors, spacing } from "../theme"

type DateFieldProps = {
  label: string
  value: string // "YYYY-MM-DD" or ""
  onChangeText: (text: string) => void
  error?: string
  editable?: boolean
}

// Auto-insert hyphens while typing: 20260710 -> 2026-07-10 (2026 -> 2026-).
function autoHyphenate(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8) // YYYYMMDD
  let out = digits.slice(0, 4)
  if (digits.length >= 4) out += "-"
  out += digits.slice(4, 6)
  if (digits.length >= 6) out += "-"
  out += digits.slice(6, 8)
  return out
}

export function DateField({
  label,
  value,
  onChangeText,
  error,
  editable = true,
}: DateFieldProps) {
  const [show, setShow] = useState(false)

  const maybe = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value) : new Date()
  const initialDate = isNaN(maybe.getTime()) ? new Date() : maybe

  function onPickerChange(event: { type?: string }, selected?: Date) {
    setShow(false) // Android auto-dismisses; hide either way.
    if (event?.type === "dismissed" || !selected) return
    const yyyy = selected.getFullYear()
    const mm = String(selected.getMonth() + 1).padStart(2, "0")
    const dd = String(selected.getDate()).padStart(2, "0")
    onChangeText(`${yyyy}-${mm}-${dd}`)
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, error ? styles.rowError : null]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(t) => onChangeText(autoHyphenate(t))}
          placeholder="Select date"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          editable={editable}
          maxLength={10}
        />
        <TouchableOpacity
          style={styles.calendarBtn}
          onPress={() => setShow(true)}
          disabled={!editable}
          activeOpacity={0.7}
        >
          <Text style={styles.calendarIcon}>📅</Text>
        </TouchableOpacity>
      </View>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  rowError: { borderColor: colors.danger },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  calendarBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  calendarIcon: { fontSize: 20 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
})
