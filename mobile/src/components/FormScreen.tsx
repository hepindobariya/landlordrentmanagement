import React from "react"
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { spacing } from "../theme"

type FormScreenProps = {
  children: React.ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
}

// Shared keyboard-aware form wrapper: keeps the focused input above the
// keyboard on both platforms. Use in place of a bare ScrollView in form
// screens. Behavior: iOS uses padding, Android uses height; taps pass through
// to controls (keyboardShouldPersistTaps="handled"); extra bottom padding keeps
// the last inputs reachable.
export function FormScreen({
  children,
  contentContainerStyle,
}: FormScreenProps) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
})
