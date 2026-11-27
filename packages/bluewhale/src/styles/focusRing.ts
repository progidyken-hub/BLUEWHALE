/**
 * Accessible focus ring for keyboard and screen-reader users.
 *
 * WCAG 2.2 SC 1.4.11 / 2.4.13: the focus indicator must have at least a 3:1
 * contrast ratio against the colours next to it, and it must not depend on
 * colour alone. The ring below is a thick outline drawn *outside* the
 * control (with a gap), so focus also changes the control's outline
 * shape and size, not just its colour. A white halo keeps it visible on dark
 * backgrounds too.
 */

export const FOCUS_RING = {
  /** Ring colour (Tailwind blue-700). */
  color: '#1d4ed8',
  /** Halo between the control and the ring, which keeps it visible on any background. */
  haloColor: '#ffffff',
  /** Ring thickness: 3x the 1px resting border. */
  width: '3px',
  /** Gap between the control edge and the ring. */
  offset: '2px',
} as const;

/** Colours the ring is drawn next to; each must reach 3:1 against it. */
export const FOCUS_RING_ADJACENT_COLORS = {
  pageBackground: '#ffffff',
  surfaceBackground: '#f8fafc',
  restingBorder: '#cbd5e1',
} as const;

/** Elements in the deposit form that receive the focus ring. */
export const FOCUS_RING_SELECTORS = [
  '.bw-address-input__input',
  '.bw-memo-field__input',
  '.bw-memo-field__type',
  '.bw-copy-button',
  '.bw-memo-conflict__convert',
] as const;

/**
 * CSS for the focus ring. `!important` is required because the components
 * ship inline defaults (some include `outline: none`), and inline styles
 * otherwise beat any stylesheet rule.
 */
export function focusRingCss(selectors: readonly string[] = FOCUS_RING_SELECTORS): string {
  const focusVisible = selectors.map((s) => `${s}:focus-visible`).join(',\n');
  const focusNotVisible = selectors.map((s) => `${s}:focus:not(:focus-visible)`).join(',\n');
  return [
    `${focusVisible} {`,
    `  outline: ${FOCUS_RING.width} solid ${FOCUS_RING.color} !important;`,
    `  outline-offset: ${FOCUS_RING.offset} !important;`,
    `  box-shadow: 0 0 0 ${FOCUS_RING.offset} ${FOCUS_RING.haloColor} !important;`,
    `}`,
    // Mouse/touch focus keeps the quieter resting look.
    `${focusNotVisible} {`,
    `  outline: none;`,
    `}`,
    // Windows High Contrast / forced colours: use the system highlight colour.
    `@media (forced-colors: active) {`,
    `  ${selectors.map((s) => `${s}:focus-visible`).join(', ')} {`,
    `    outline-color: Highlight !important;`,
    `  }`,
    `}`,
  ].join('\n');
}

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance for a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Expected #rrggbb colour, got "${hex}"`);
  const [r, g, b] = m.slice(1).map((h) => channelToLinear(parseInt(h, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#rrggbb` colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
