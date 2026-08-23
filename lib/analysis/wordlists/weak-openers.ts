/**
 * WORD LIST — weak bullet openers.
 *
 * Phrases that describe assigned duties rather than owned accomplishments.
 * A bullet starting with one of these is flagged and offered a rewrite.
 *
 * Edit this file to tune detection; no logic lives here.
 */
export const WEAK_OPENERS: readonly string[] = [
  "responsible for",
  "was responsible for",
  "duties included",
  "my duties included",
  "tasked with",
  "was tasked with",
  "helped with",
  "helped to",
  "assisted with",
  "assisted in",
  "worked on",
  "worked with",
  "involved in",
  "participated in",
  "contributed to",
  "took part in",
  "in charge of",
  "responsible to",
  "familiar with",
  "exposure to",
  "gained experience",
];

/**
 * WORD LIST — strong action verbs (base forms and common past tenses).
 *
 * Used to check that a bullet opens with a real accomplishment verb. This
 * is intentionally broad rather than exhaustive: a bullet opening with a
 * verb not listed here is only flagged when it also matches no other
 * verb-like pattern, so false positives stay low.
 */
export const ACTION_VERBS: readonly string[] = [
  "accelerated", "achieved", "acquired", "adapted", "added", "administered",
  "advanced", "advised", "analyzed", "architected", "authored", "automated",
  "boosted", "broadened", "built", "centralized", "chaired", "championed",
  "clarified", "coached", "collaborated", "compiled", "completed", "composed",
  "computed", "conceived", "conducted", "configured", "consolidated",
  "constructed", "consulted", "converted", "coordinated", "created",
  "cultivated", "cut", "debugged", "decreased", "defined", "delivered",
  "demonstrated", "deployed", "designed", "detected", "determined",
  "developed", "devised", "diagnosed", "directed", "documented", "doubled",
  "drove", "earned", "edited", "eliminated", "enabled", "engineered",
  "enhanced", "established", "evaluated", "examined", "executed", "expanded",
  "expedited", "facilitated", "finalized", "focused", "forecasted",
  "formulated", "founded", "generated", "guided", "halved", "handled",
  "headed", "identified", "implemented", "improved", "increased",
  "influenced", "initiated", "innovated", "inspected", "installed",
  "instituted", "instructed", "integrated", "introduced", "invented",
  "investigated", "launched", "led", "leveraged", "maintained", "managed",
  "mapped", "marketed", "measured", "mentored", "migrated", "minimized",
  "modeled", "modernized", "monitored", "negotiated", "operated",
  "optimized", "orchestrated", "organized", "overhauled", "oversaw",
  "partnered", "performed", "pioneered", "planned", "prepared", "presented",
  "prioritized", "produced", "programmed", "promoted", "proposed",
  "prototyped", "provided", "published", "reached", "rebuilt", "received",
  "recommended", "reconciled", "recruited", "redesigned", "reduced",
  "refactored", "regenerated", "released", "remodeled", "reorganized",
  "repaired", "replaced", "reported", "researched", "resolved",
  "restructured", "revamped", "reviewed", "revised", "saved", "scaled",
  "scoped", "secured", "selected", "shaped", "shipped", "simplified",
  "solved", "spearheaded", "specified", "standardized", "streamlined",
  "strengthened", "structured", "supervised", "supported", "surpassed",
  "sustained", "tested", "trained", "transformed", "translated", "tripled",
  "troubleshot", "unified", "upgraded", "validated", "verified", "wrote",
];
