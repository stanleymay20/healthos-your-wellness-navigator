// Shared versioned-consent constants. Importable from both client and
// server. When the legal team bumps a document, increment the version
// string here and the rest of the app picks it up: onboarding shows the
// new version on the checkboxes, Settings shows existing users their
// stale acceptance state, and a future re-prompt phase can use these
// to decide who to interrupt.

export const CONSENT_DOCS = ["tos", "privacy"] as const;
export type ConsentDoc = (typeof CONSENT_DOCS)[number];

// Calendar-versioned. When the doc text changes, change this string.
export const ACTIVE_VERSIONS: Record<ConsentDoc, string> = {
  tos: "2026-04-26",
  privacy: "2026-04-26",
};

export const DOC_LABELS: Record<ConsentDoc, string> = {
  tos: "Terms of Service",
  privacy: "Privacy Policy",
};

// Placeholder URLs — replace once the legal pages exist.
export const DOC_URLS: Record<ConsentDoc, string> = {
  tos: "/legal/terms",
  privacy: "/legal/privacy",
};
