import { Feather } from "@expo/vector-icons"
import React, { useState } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { colors, font, radius, shadow, spacing } from "../theme"

type Topic = {
  id: string
  icon: any
  title: string
  summary: string
  points: string[]
}

// India-focused, plain-language reference. Educational only — not legal advice.
const TOPICS: Topic[] = [
  {
    id: "deposit",
    icon: "shield",
    title: "Security deposit",
    summary: "How much you can hold and when to refund it.",
    points: [
      "The Model Tenancy Act, 2021 caps the security deposit at 2 months' rent for residential premises and 6 months' rent for commercial premises.",
      "The deposit should be refunded at the time the tenant vacates, after deducting any lawful dues (unpaid rent, damage beyond normal wear).",
      "Many states recommend returning the balance within about a month of handover.",
      "Deposit rules vary by state rent-control law — always confirm the cap in your state.",
    ],
  },
  {
    id: "increase",
    icon: "trending-up",
    title: "Rent increase & notice",
    summary: "Revising rent and the notice you must give.",
    points: [
      "Rent is usually revised by mutual agreement; many agreements set a fixed annual escalation (commonly around 5–10%).",
      "The Model Tenancy Act expects advance written notice — typically about 3 months — before a revision takes effect.",
      "To end or change a tenancy, give the notice period written into the agreement (often 1–3 months).",
      "Keep every revision in writing and acknowledged by both sides.",
    ],
  },
  {
    id: "registration",
    icon: "file-text",
    title: "Agreement registration & stamp duty",
    summary: "When a rent agreement must be stamped and registered.",
    points: [
      "Agreements of 12 months or more generally must be registered under the Registration Act, 1908.",
      "The common workaround — an 11-month agreement — avoids compulsory registration but is weaker evidence in a dispute.",
      "Stamp duty is a state subject and varies; e-stamping is available in most states.",
      "A properly stamped and registered agreement is far stronger if you ever need to recover dues or evict.",
    ],
  },
  {
    id: "mta",
    icon: "book-open",
    title: "Model Tenancy Act, 2021",
    summary: "The central template states are adopting.",
    points: [
      "Requires a written agreement between landlord and tenant, filed with a Rent Authority.",
      "Caps deposits (2 months residential / 6 months commercial) and sets a dispute-resolution path via Rent Courts and Tribunals.",
      "Defines landlord duties (structural repairs) and tenant duties (day-to-day upkeep, no unauthorised sub-letting).",
      "It is a model law — it applies only as each state adopts/adapts it, so check your state's version.",
    ],
  },
  {
    id: "tds",
    icon: "percent",
    title: "TDS & tax on rent",
    summary: "When tax must be deducted, and HRA receipts.",
    points: [
      "Section 194-IB: an individual/HUF tenant paying rent above ₹50,000 per month must deduct TDS (2% since Oct 2024) once a year.",
      "Section 194-I applies to businesses paying rent above the annual threshold.",
      "Salaried tenants claiming HRA need valid rent receipts; the landlord's PAN is required when annual rent exceeds ₹1,00,000.",
      "Commercial rent may attract GST depending on registration and turnover.",
    ],
  },
  {
    id: "rights",
    icon: "users",
    title: "Landlord & tenant rights",
    summary: "Eviction grounds and basic protections.",
    points: [
      "Common lawful grounds to evict: sustained non-payment of rent, unauthorised sub-letting, misuse of the premises, or a bona-fide need by the owner — following due process.",
      "A landlord generally cannot cut essential services (water/electricity) or force eviction without following the law.",
      "Tenants are entitled to peaceful enjoyment, essential services, and reasonable notice before entry.",
      "Disputes are meant to go through the Rent Authority/Rent Court rather than self-help eviction.",
    ],
  },
]

export default function LegalLibraryScreen() {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.disclaimer}>
        <Feather name="info" size={16} color={colors.info} />
        <Text style={styles.disclaimerText}>
          General educational information about Indian rental law — not legal
          advice. Rules vary by state; consult a professional for your case.
        </Text>
      </View>

      {TOPICS.map((t) => {
        const open = openId === t.id
        return (
          <View key={t.id} style={styles.card}>
            <TouchableOpacity
              style={styles.cardHead}
              activeOpacity={0.7}
              onPress={() => setOpenId(open ? null : t.id)}
            >
              <View style={styles.iconWrap}>
                <Feather name={t.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.headText}>
                <Text style={styles.cardTitle}>{t.title}</Text>
                <Text style={styles.cardSummary} numberOfLines={1}>
                  {t.summary}
                </Text>
              </View>
              <Feather
                name={open ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.subtle}
              />
            </TouchableOpacity>
            {open ? (
              <View style={styles.body}>
                {t.points.map((p, i) => (
                  <View key={`${t.id}-${i}`} style={styles.pointRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.pointText}>{p}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  disclaimer: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.infoBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  disclaimerText: { flex: 1, fontSize: font.small, color: colors.text, lineHeight: 19 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
    ...shadow.card,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1 },
  cardTitle: { fontSize: font.body, fontWeight: "700", color: colors.text },
  cardSummary: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  pointRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
  },
  pointText: { flex: 1, fontSize: font.small, color: colors.text, lineHeight: 20 },
})
