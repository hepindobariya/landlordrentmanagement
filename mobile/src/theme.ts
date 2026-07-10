// Design system — "Emerald & Navy".
// Psychology: green signals money, growth, trust and positive cash flow (and
// reads as calm, not stressful — important when chasing rent); deep navy adds
// stability and a premium, confident finance feel. Neutrals stay warm-cool and
// quiet so numbers and status colors pop.
//
// Token key names are kept stable so every screen recolors automatically.

export const colors = {
  // Brand — emerald
  primary: "#0E9F6E",
  primaryDark: "#0A7C57",
  primaryPressed: "#0C8A60",
  primaryTint: "#E7F7F0",
  primaryTintStrong: "#CDEEDF",

  // Deep navy / ink for premium surfaces + strong text
  ink: "#0B1B2B",
  navy: "#102A43",
  navySoft: "#1C3A57",

  // Neutrals
  background: "#F3F6F5",
  card: "#FFFFFF",
  text: "#13232F",
  muted: "#5B6B78",
  subtle: "#94A3AC",
  border: "#E3EAE8",
  white: "#FFFFFF",

  // Status
  success: "#0E9F6E",
  successBg: "#E7F7F0",
  warn: "#C8890B",
  warnBg: "#FBF1D9",
  danger: "#DC4A3D",
  dangerBg: "#FBEAE8",
  info: "#1C7ED6",
  infoBg: "#E7F1FB",
} as const

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const

export const font = {
  h1: 28,
  h2: 22,
  h3: 18,
  body: 15,
  small: 13,
  tiny: 11,
} as const

export const shadow = {
  card: {
    shadowColor: "#0B1B2B",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  floating: {
    shadowColor: "#0B1B2B",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const

// Deterministic soft tones for monogram avatars / accents.
export const avatarTones = [
  { bg: "#E7F7F0", fg: "#0A7C57" },
  { bg: "#E7F1FB", fg: "#1C6FB8" },
  { bg: "#FBF1D9", fg: "#A9720A" },
  { bg: "#EFEAFB", fg: "#6A44C9" },
  { bg: "#FBEAE8", fg: "#C43F33" },
  { bg: "#E4F3F1", fg: "#0B6E7A" },
] as const
