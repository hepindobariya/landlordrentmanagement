import { Feather } from "@expo/vector-icons"
import React from "react"
import type { KeyboardTypeOptions } from "react-native"
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { colors, font, radius, shadow, spacing } from "../theme"

type ButtonVariant = "primary" | "danger" | "secondary"

// Primary action button. Keeps the same prop API used across every screen.
export function AppButton({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: {
  title: string
  onPress: () => void
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
}) {
  const isDisabled = disabled || loading
  const containerStyle = [
    styles.btn,
    variant === "primary" ? styles.btnPrimary : null,
    variant === "danger" ? styles.btnDanger : null,
    variant === "secondary" ? styles.btnSecondary : null,
    isDisabled ? styles.btnDisabled : null,
  ]
  const textStyle = [
    styles.btnText,
    variant === "secondary" ? styles.btnTextSecondary : styles.btnTextOnColor,
  ]
  const spinnerColor = variant === "secondary" ? colors.primary : colors.white
  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

// Labelled text input.
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
  editable = true,
}: {
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  multiline?: boolean
  editable?: boolean
}) {
  const inputStyle = [
    styles.input,
    multiline ? styles.inputMultiline : null,
    !editable ? styles.inputDisabled : null,
  ]
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={inputStyle}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
      />
    </View>
  )
}

// Inline error message.
export function ErrorText({ text }: { text: string }) {
  return (
    <View style={styles.errorWrap}>
      <Feather name="alert-circle" size={16} color={colors.danger} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  )
}

// Full-height centered state: loading, empty, or error.
export function CenteredMessage({
  text,
  subtext,
  loading = false,
  error = false,
  actionLabel,
  onAction,
}: {
  text: string
  subtext?: string
  loading?: boolean
  error?: boolean
  actionLabel?: string
  onAction?: () => void
}) {
  const iconWrapStyle = [styles.centerIcon, error ? styles.centerIconError : null]
  return (
    <View style={styles.centered}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <View style={iconWrapStyle}>
          <Feather
            name={error ? "alert-triangle" : "inbox"}
            size={26}
            color={error ? colors.danger : colors.primary}
          />
        </View>
      )}
      <Text style={styles.centerText}>{text}</Text>
      {subtext ? <Text style={styles.centerSub}>{subtext}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.centerAction}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={styles.centerActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
  },
  btnPrimary: { backgroundColor: colors.primary, ...shadow.card },
  btnDanger: { backgroundColor: colors.danger },
  btnSecondary: {
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontSize: font.body, fontWeight: "700" },
  btnTextOnColor: { color: colors.white },
  btnTextSecondary: { color: colors.primaryDark },

  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: font.small,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: spacing.xs,
    marginLeft: 2,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: font.body,
    color: colors.text,
  },
  inputMultiline: { minHeight: 96, paddingTop: 14, textAlignVertical: "top" },
  inputDisabled: { backgroundColor: colors.background, color: colors.muted },

  errorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: font.small,
    fontWeight: "600",
    flex: 1,
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  centerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  centerIconError: { backgroundColor: colors.dangerBg },
  centerText: {
    fontSize: font.h3,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  centerSub: {
    fontSize: font.body,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 21,
  },
  centerAction: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  centerActionText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: font.body,
  },
})
