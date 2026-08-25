/**
 * Warm palette, pulled from the app icon.
 *
 * The one deliberate choice worth knowing: overdue is amber, not red. Being
 * behind on calling your mum is a nudge, not an error — red is reserved for
 * things that actually failed.
 */
export const colors = {
  background: '#FFFBF7',
  surface: '#FFF4EC',
  card: '#FFFFFF',
  text: '#2A2018',
  textMuted: '#8A7A6D',
  border: '#F1E5D9',
  borderStrong: '#E6D5C5',

  accent: '#F4552F',
  accentSoft: '#FFEDE6',
  accentText: '#FFFFFF',

  overdue: '#C2650B',
  overdueSoft: '#FFF1DC',

  calm: '#2F855A',
  calmSoft: '#E7F5EC',

  danger: '#C1362F',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  small: { fontSize: 14, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.5 },
} as const;

/** Soft, low-contrast lift. Heavy shadows read as cheap on a warm background. */
export const shadow = {
  card: {
    shadowColor: '#8A5A3B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
