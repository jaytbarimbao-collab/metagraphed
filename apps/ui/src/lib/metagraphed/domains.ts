// Display helpers for the domains / capability-tag rollup (#6996). Kept in one
// place so the /domains overview and /domains/{tag} detail format the same
// fields identically.

/**
 * Present a capability-tag slug as a page label. Tags are lowercase single
 * words ("agents", "compute", …); this Title-cases each word so the UI reads
 * "Agents" without hardcoding a per-tag lookup. A blank/nullish tag returns
 * the em-dash fallback so a junk row never renders an empty label.
 */
export function formatDomainLabel(tag: string | null | undefined): string {
  if (!tag) return "—";
  return tag
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Format a fractional emission share (0..1) as a percentage. Domain-level
 * shares span ~0.3%–16%, so two decimals stay readable without losing the
 * small tags. Nullish / non-finite input renders the em-dash fallback.
 */
export function formatEmissionShare(share: number | null | undefined): string {
  if (share == null || !Number.isFinite(share)) return "—";
  return `${(share * 100).toFixed(2)}%`;
}

/**
 * Format a 0..1 ratio (top-N share, entropy_normalized, hhi, …) as a
 * percentage with a caller-chosen precision. Nullish / non-finite → em-dash.
 */
export function formatRatioPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}
