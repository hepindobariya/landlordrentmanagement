import React, { useMemo, useState } from "react"
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { formatDate } from "../lib/format"
import { colors, font, radius, spacing } from "../theme"
import { WheelPicker } from "./WheelPicker"

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

function todayParts(): { d: number; m: number; y: number } {
  const now = new Date()
  return { d: now.getDate(), m: now.getMonth() + 1, y: now.getFullYear() }
}

function parseISO(value: string): { d: number; m: number; y: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

// A labelled date input that opens an iOS-style scroll-wheel picker.
// Displays dd-mm-yyyy; emits an ISO yyyy-mm-dd string via onChange.
export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Select date",
  editable = true,
  optional = false,
  minYear,
  maxYear,
}: {
  label: string
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  editable?: boolean
  optional?: boolean
  minYear?: number
  maxYear?: number
}) {
  const nowYear = new Date().getFullYear()
  const startYear = minYear ?? nowYear - 50
  const endYear = maxYear ?? nowYear + 10

  const years = useMemo(() => {
    const arr: number[] = []
    for (let y = startYear; y <= endYear; y++) arr.push(y)
    return arr
  }, [startYear, endYear])

  const [open, setOpen] = useState(false)
  const initial = parseISO(value) ?? todayParts()
  const [day, setDay] = useState(initial.d)
  const [month, setMonth] = useState(initial.m) // 1-12
  const [year, setYear] = useState(initial.y)

  function openPicker() {
    if (!editable) return
    const p = parseISO(value) ?? todayParts()
    setDay(p.d)
    setMonth(p.m)
    setYear(p.y)
    setOpen(true)
  }

  const maxDay = daysInMonth(year, month)
  const safeDay = Math.min(day, maxDay)

  const dayItems = useMemo(() => {
    const arr: string[] = []
    for (let d = 1; d <= maxDay; d++) arr.push(pad2(d))
    return arr
  }, [maxDay])

  const yearItems = useMemo(() => years.map((y) => String(y)), [years])

  function confirm() {
    const iso = `${year}-${pad2(month)}-${pad2(safeDay)}`
    onChange(iso)
    setOpen(false)
  }

  function clear() {
    onChange("")
    setOpen(false)
  }

  const boxStyle = [styles.box, !editable ? styles.boxDisabled : null]
  const yearIndex = Math.max(0, years.indexOf(year))

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={boxStyle}
        activeOpacity={0.7}
        onPress={openPicker}
        disabled={!editable}
      >
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDate(value) : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={hitSlop}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={confirm} hitSlop={hitSlop}>
                <Text style={styles.done}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.wheels}>
              <WheelPicker
                items={dayItems}
                selectedIndex={safeDay - 1}
                onChange={(i) => setDay(i + 1)}
              />
              <WheelPicker
                items={MONTHS}
                selectedIndex={month - 1}
                onChange={(i) => setMonth(i + 1)}
              />
              <WheelPicker
                items={yearItems}
                selectedIndex={yearIndex}
                onChange={(i) => setYear(years[i])}
              />
            </View>

            {optional ? (
              <TouchableOpacity style={styles.clearBtn} onPress={clear}>
                <Text style={styles.clearText}>Clear date</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 }

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: font.small,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: spacing.xs,
    marginLeft: 2,
  },
  box: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 50,
    justifyContent: "center",
  },
  boxDisabled: { backgroundColor: colors.background },
  valueText: { fontSize: font.body, color: colors.text, fontWeight: "600" },
  placeholderText: { fontSize: font.body, color: colors.subtle },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(11,27,43,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: font.body, fontWeight: "800", color: colors.text },
  cancel: { fontSize: font.body, color: colors.muted, fontWeight: "600" },
  done: { fontSize: font.body, color: colors.primary, fontWeight: "800" },
  wheels: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
  },
  clearBtn: { alignItems: "center", paddingVertical: spacing.md },
  clearText: { fontSize: font.small, color: colors.danger, fontWeight: "700" },
})
