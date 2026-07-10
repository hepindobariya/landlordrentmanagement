import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import React, { useEffect, useState } from "react"
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { AppButton, CenteredMessage } from "../components/ui"
import { apiFetch } from "../lib/api"
import type { RootStackParamList } from "../navigation/AppNavigator"
import { colors, spacing } from "../theme"
import type { NotificationSettings, SummaryFrequency } from "../types"

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">

type LinkResponse = { deep_link: string; bot_username: string }

type ToggleRow = {
  key: keyof NotificationSettings
  label: string
  desc: string
}

const TOGGLES: ToggleRow[] = [
  { key: "notify_payment", label: "Payment received", desc: "When a payment is recorded" },
  { key: "notify_partial", label: "Partial payment", desc: "When a charge is partly paid" },
  { key: "notify_due", label: "Rent due soon", desc: "Upcoming rent reminders" },
  { key: "notify_overdue", label: "Overdue rent", desc: "When rent is past due" },
  { key: "notify_ticket_new", label: "New maintenance ticket", desc: "When a ticket is created" },
  { key: "notify_ticket_status", label: "Ticket status changes", desc: "When a ticket is updated" },
  { key: "notify_lease_new", label: "New lease", desc: "When a lease is created" },
  { key: "notify_lease_expiring", label: "Lease expiring", desc: "When a lease is ending soon" },
  { key: "notify_tenant_change", label: "Tenant changes", desc: "When a tenant is added" },
]

const FREQ: SummaryFrequency[] = ["off", "daily", "weekly"]
const FREQ_LABEL: Record<SummaryFrequency, string> = {
  off: "Off",
  daily: "Daily",
  weekly: "Weekly",
}

export default function NotificationsScreen(_props: Props) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const s = await apiFetch<NotificationSettings>(
        "/api/v1/notifications/settings"
      )
      setSettings(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function patch(update: Partial<NotificationSettings>) {
    if (!settings) return
    const prev = settings
    setSettings({ ...settings, ...update })
    setSaving(true)
    try {
      const s = await apiFetch<NotificationSettings>(
        "/api/v1/notifications/settings",
        { method: "PATCH", body: JSON.stringify(update) }
      )
      setSettings(s)
    } catch (e) {
      setSettings(prev) // revert on failure
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleConnect() {
    setLinking(true)
    try {
      const res = await apiFetch<LinkResponse>(
        "/api/v1/notifications/telegram/link",
        { method: "POST", body: JSON.stringify({}) }
      )
      const canOpen = await Linking.canOpenURL(res.deep_link)
      if (canOpen) {
        await Linking.openURL(res.deep_link)
      } else {
        Alert.alert("Open Telegram", `Open this link to connect:\n${res.deep_link}`)
      }
    } catch (e) {
      Alert.alert(
        "Couldn't start linking",
        e instanceof Error ? e.message : "Try again."
      )
    } finally {
      setLinking(false)
    }
  }

  function handleDisconnect() {
    Alert.alert(
      "Disconnect Telegram?",
      "You'll stop receiving alerts until you reconnect.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              const s = await apiFetch<NotificationSettings>(
                "/api/v1/notifications/telegram/unlink",
                { method: "POST", body: JSON.stringify({}) }
              )
              setSettings(s)
            } catch (e) {
              Alert.alert(
                "Couldn't disconnect",
                e instanceof Error ? e.message : "Try again."
              )
            }
          },
        },
      ]
    )
  }

  if (loading) return <CenteredMessage loading text="Loading…" />
  if (!settings)
    return (
      <CenteredMessage
        error
        text="Couldn't load notifications"
        subtext={error ?? undefined}
        actionLabel="Retry"
        onAction={() => {
          setLoading(true)
          setError(null)
          load()
        }}
      />
    )

  const linked = settings.telegram_linked

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Telegram</Text>
        <Text style={styles.cardStatus}>
          {linked ? "✅ Connected" : "Not connected"}
        </Text>
        <Text style={styles.cardHelp}>
          {linked
            ? "Alerts are delivered to your linked Telegram chat."
            : "Connect Telegram to receive alerts. You'll be taken to the bot — tap Start to finish."}
        </Text>
        <View style={styles.spacerSm} />
        {linked ? (
          <AppButton title="Disconnect" variant="danger" onPress={handleDisconnect} />
        ) : (
          <AppButton
            title="Connect Telegram"
            onPress={handleConnect}
            loading={linking}
          />
        )}
      </View>

      <Text style={styles.sectionTitle}>Alerts</Text>
      <View style={styles.card}>
        {TOGGLES.map((t, i) => (
          <View
            key={t.key as string}
            style={[styles.row, i < TOGGLES.length - 1 ? styles.rowDivider : null]}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{t.label}</Text>
              <Text style={styles.rowDesc}>{t.desc}</Text>
            </View>
            <Switch
              value={Boolean(settings[t.key])}
              onValueChange={(v) =>
                patch({ [t.key]: v } as Partial<NotificationSettings>)
              }
              disabled={saving}
            />
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Summary</Text>
      <View style={styles.card}>
        <Text style={styles.rowLabel}>Frequency</Text>
        <Text style={styles.rowDesc}>
          How often to send a collected-vs-billed summary.
        </Text>
        <View style={styles.spacerSm} />
        <View style={styles.pillRow}>
          {FREQ.map((f) => {
            const selected = settings.summary_frequency === f
            return (
              <TouchableOpacity
                key={f}
                style={[styles.pill, selected ? styles.pillSelected : null]}
                onPress={() => !saving && patch({ summary_frequency: f })}
                activeOpacity={0.8}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.pillText,
                    selected ? styles.pillTextSelected : null,
                  ]}
                >
                  {FREQ_LABEL[f]}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <View style={styles.spacerMd} />
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
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  cardStatus: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.xs,
  },
  cardHelp: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, paddingRight: spacing.md },
  rowLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowDesc: { fontSize: 13, color: colors.muted, marginTop: 2 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
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
  spacerSm: { height: spacing.sm },
  spacerMd: { height: spacing.md },
})
