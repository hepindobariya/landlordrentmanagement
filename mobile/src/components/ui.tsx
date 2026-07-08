import React from "react"
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardTypeOptions,
} from "react-native"
import { colors, spacing } from "../theme"

type AppButtonProps = {
  title: string
  onPress: () => void
  variant?: "primary" | "danger" | "secondary"
  loading?: boolean
  disabled?: boolean
}

export function AppButton({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: AppButtonProps) {
  const isDisabled = disabled || loading
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "danger" && styles.buttonDanger,
        variant === "secondary" && styles.buttonSecondary,
        isDisabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "secondary" ? colors.primary : colors.white}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "secondary" && styles.buttonTextSecondary,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  )
}

type FieldProps = {
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  multiline?: boolean
  editable?: boolean
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
  editable = true,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
      />
    </View>
  )
}

export function ErrorText({ text }: { text: string }) {
  return <Text style={styles.errorText}>{text}</Text>
}

type CenteredMessageProps = {
  text: string
  subtext?: string
  loading?: boolean
  error?: boolean
  actionLabel?: string
  onAction?: () => void
}

export function CenteredMessage({
  text,
  subtext,
  loading = false,
  error = false,
  actionLabel,
  onAction,
}: CenteredMessageProps) {
  return (
    <View style={styles.centered}>
      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.centeredSpinner}
        />
      ) : null}
      <Text style={[styles.centeredText, error && styles.errorText]}>
        {text}
      </Text>
      {subtext ? <Text style={styles.centeredSubtext}>{subtext}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonDanger: { backgroundColor: colors.danger },
  buttonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  buttonTextSecondary: { color: colors.primary },
  field: { marginBottom: spacing.md },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: "top" },
  errorText: { color: colors.danger, fontSize: 14, marginTop: spacing.xs },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  centeredSpinner: { marginBottom: spacing.md },
  centeredText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  centeredSubtext: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  retryButtonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
})
