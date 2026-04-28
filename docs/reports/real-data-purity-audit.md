# Real-data purity audit

**Date:** 2026-04-27
**Scope:** Scoring, insight, and risk pipeline. Read-only audit. No code changed.

The point of this audit is to surface every numeric literal in the pipeline that influences user-visible output, classify it, and produce a concrete target list for the next two scoring-enrichment phases.

## Classification key

- **A — Real-data-derived.** The value comes from the user's own data. No action.
- **B — Calibration constant.** A defensible domain default (statistical convention, medical guideline, UX cap, numerical stability floor). Keep, but ensure the justification is in a code comment.
- **C — Replaceable with user-derived value.** Currently fixed; should adapt to the user's own history. Phase 33 target.
- **D — Should be a user-facing setting.** Currently fixed; really a preference (sensitivity dial, hydration target, weekly volume goal). Future Settings phase.

## Files audited

1. [src/lib/scoring/derive.ts](#srclibscoring derivets)
2. [src/lib/scoring/baseline.ts](#srclibscoringbaselinets)
3. [src/lib/scoring/parity.ts](#srclibscoringparityts)
4. [src/lib/insights/generate.ts](#srclibinsightsgeneratets)
5. [src/services/scoring.ts](#srcservicesscoringts)
6. [src/services/engine.ts](#srcservicesenginets)
7. [src/lib/providers/oura-sync.server.ts](#srclibprovidersoura-syncserverts)
8. [src/lib/providers/oura-sync-batch.server.ts](#srclibprovidersoura-sync-batchserverts)
9. [src/routes/_app/dashboard.tsx](#srcroutes_appdashboardtsx)
10. [src/routes/_app/reports.tsx](#srcroutes_appreportstsx)

---

## src/lib/scoring/derive.ts

| Constant | Value | Class | Recommendation |
| --- | --- | --- | --- |
| `meanRounded` formula | `Math.round(sum/n)` over present sub-scores | A | None. `overall_score` is the rounded mean of whichever sub-scores the user has on that day — fully derived from user data. |
| `DerivedDailyScore` shape | excludes `stress_score`, `nutrition_score` | — | Structural gap, not a constant. The sync path never writes `stress_score` because the derivation type doesn't carry one — see Summary §1. |

No numeric thresholds in this file. Clean.

## src/lib/scoring/baseline.ts

| Constant | Value | Class | Recommendation |
| --- | --- | --- | --- |
| `MIN_BASELINE_DAYS` | 5 | B | Below 5 days the mean is statistically unreliable; existing comment explains. Keep. |
| `MAX_BASELINE_DAYS` | 14 | B | Caps the window so old regimes don't drown out recent shifts. Could become D (settings dial) for power users; not a Phase 33 target. |
| `STDDEV_FLOOR` | 3 | B | Numerical stability for flat windows. Comment present. Keep. |
| `ELEVATED_Z` | -1.0 | B | 1σ is statistical convention. Candidate for D (user-controlled sensitivity dial) once we ship a Settings surface; not Phase 33. |
| `HIGH_Z` | -2.0 | B | 2σ is statistical convention. Same as `ELEVATED_Z`. |
| `HIGH_OVERALL_Z` | -1.5 | B | Slightly more sensitive trigger for the aggregate signal. Document the asymmetry alongside the existing comment block (currently it's just declared). |

Pipeline math here is fully user-derived (mean / stddev / z-score over the user's own scores). The constants are only the cutoffs for how big a deviation has to be before we call it elevated/high — those are properly calibration constants.

## src/lib/scoring/parity.ts

| Constant | Value | Class | Recommendation |
| --- | --- | --- | --- |
| `FIELDS` | the four score columns | — | Structural list, not a threshold. None. |
| `sampleLimit` default | 20 | B | Operational cap on mismatch sampling. Keep. |

Clean. Pure structural comparison.

## src/lib/insights/generate.ts

| Constant | Value | Class | Recommendation |
| --- | --- | --- | --- |
| `MAX_INSIGHTS` | 2 | B | UX cap on how many insight strings render per day. Keep. |
| `SIGNIFICANT_BELOW_Z` | -1.5 | B | 1.5σ sits between `ELEVATED_Z` and `HIGH_Z`; intentional. Document the relationship in a code comment. |
| `SIGNIFICANT_ABOVE_Z` | 1.5 | B | Same. |
| Fallback `latest.overall_score < 50` | 50 | **C** | Replace with "latest is in the user's bottom percentile of their last 14–30 days" once they have history. Keep the literal as a cold-start fallback for users with <`MIN_BASELINE_DAYS` of data. **Phase 33b target.** |
| Fallback `latest.sleep_score < 60` | 60 | **C** | Same — bottom-percentile-of-self once history exists. **Phase 33b target.** |
| Fallback `latest.activity_score < 50` | 50 | **C** | Same. **Phase 33b target.** |
| Trend rule `latest.overall_score > previous.overall_score` | day-over-day | A | Pure user-data comparison. Keep. |

The baseline-aware branch (lines 33-63) is already real-data-driven — Phase 33b only needs to replace the fixed-threshold fallbacks with percentile cuts on the user's own history.

## src/services/scoring.ts

This file is the **manual-log scoring path** (used by `saveLogAndRefresh` when a user enters a log via the form). The sync path goes through `derive.ts` instead, so these constants only affect users who self-report.

| Constant | Value | Class | Recommendation |
| --- | --- | --- | --- |
| `NEUTRAL` | 60 | B | Graceful-degradation default when a sub-score input is missing. Documented. Keep. |
| `scoreSleep` optimal band | 7–9h | B | Matches NSF adult sleep guidance. Add a one-line comment citing the source. |
| `scoreSleep` step bands (6–7, 9–10, 5–6, >10) | various | B | Same source. Keep. |
| `scoreActivity` thresholds | 60 / 30 / 15 min | B | WHO 150min/week ≈ 30min × 5d baseline. Keep. Could become D (per-user fitness goal) eventually. |
| `scoreStress` formula | `105 − level × 10` | B | Linear inversion of self-reported 1–10. Keep. |
| `scoreRecovery` weights | 0.5/0.4/0.1 + medBonus | B | Heuristic blend. Could be **C** if we ever ship adaptive weighting (give more weight to whichever input correlates best with the user's overall trend). Out of scope for Phase 33; flagging for the longer roadmap. |
| `scoreNutrition` water bands | 2.5 / 2 / 1.5 / 1 L | B → **D** | Generic adult hydration target. Should become a user setting (body-weight-adjusted, climate-adjusted). **Settings-phase target, not Phase 33.** |
| `WEIGHTS` for overall | 0.25/0.2/0.2/0.2/0.15 | B → C | Acceptable defaults; ultimate target is per-user adaptive weighting. **Roadmap, not Phase 33.** |
| `scoreLabel` cuts | 85/70/55/40 | B | Display label bands. Keep. Could be D. |

Net: nothing in `scoring.ts` is a Phase 33 blocker, but the water target (`scoreNutrition`) is the most user-specific value masquerading as a universal default — flag it for the eventual Settings phase.

## src/services/engine.ts

This is the **manual-log insight/recommendation generator**. Same caveat as `scoring.ts`: only fires for self-report users. Where this file overlaps the sync-path generator (`src/lib/insights/generate.ts`), the recommendation is to push everything onto the same baseline-aware machinery in Phase 33b rather than maintain two ladders.

| Constant | Value | Class | Recommendation |
| --- | --- | --- | --- |
| Sleep stddev `<= 0.5` (consistent) | 0.5h | C | Replace with "this user's stddev is in the lowest tercile of their own rolling history" — same machinery as Phase 33b. |
| Sleep stddev `>= 1.5` (inconsistent) | 1.5h | C | Same. |
| Stress trend `recent3 > prev + 1` | ±1 unit | C | Already user-derived (compares the user's own averages); the `±1` cutoff itself could be ½ of the user's own stress-stddev. Phase 33b. |
| `latest.water_liters < 1.5` | 1.5 L | D | Same as `scoreNutrition` — user-setting target, not Phase 33. |
| `sleep_hours >= 7 && stress_level <= 4` | 7h, 4 | C / D | Sleep cut: NSF default but candidate for D. Stress cut: candidate for C (user's own stress-low tercile). |
| `exercise_minutes < 20` | 20 | D | Should align with the user's activity goal. |
| `sleep_hours < 7` (rec) | 7h | D | Same. |
| `water_liters < 2` (rec) | 2 L | D | Same. |
| `stress_level >= 6` (rec) | 6/10 | C | Replace with user's own top tercile. |
| `meditation_minutes === 0` (rec) | binary | A | Binary check — fine. |
| Caps: `insights.slice(0,5)`, `recs.slice(0,4)` | 5 / 4 | B | UX caps. Keep. |

Net: many Class C / D entries here, but none are Phase 33 blockers in isolation. The cleanest direction is to **unify on the baseline-aware generator** (`src/lib/insights/generate.ts`) for the manual-log path too in Phase 33b, deleting most of `engine.ts`'s threshold ladder.

## src/lib/providers/oura-sync.server.ts

| Constant | Value | Class | Recommendation |
| --- | --- | --- | --- |
| `DEFAULT_LOOKBACK_DAYS` | 14 | B | First-sync window. Short enough for fast initial load, long enough to seed `MIN_BASELINE_DAYS`. Keep. |
| `EXPIRY_SKEW_MS` | 60_000 | B | Token-refresh defensive skew. Documented. Keep. |
| `INSIGHT_CONTEXT_DAYS` | 15 | B | This is `MAX_BASELINE_DAYS + 1` — the latest day plus the baseline window. Today it's a magic number; **recommendation:** import `MAX_BASELINE_DAYS` from `baseline.ts` and compute `INSIGHT_CONTEXT_DAYS = MAX_BASELINE_DAYS + 1` so the relationship is mechanical. Tiny refactor; could fold into Phase 33a. |
| `SYNC_INSIGHT_CATALOG` descriptions | static strings | B | Display copy, not pipeline thresholds. Keep. |

## src/lib/providers/oura-sync-batch.server.ts

| Constant | Value | Class | Recommendation |
| --- | --- | --- | --- |
| `MAX_FIRST_ERROR_LEN` | 500 | B | DB column width / log size cap. Keep. |
| `MAX_FAILURE_SAMPLES` | 20 | B | Operational sample cap. Keep. |

Clean. No pipeline thresholds.

## src/routes/_app/dashboard.tsx

| Constant | Value | Class | Recommendation |
| --- | --- | --- | --- |
| Health Rating: `overall_score / 20` | divisor 20 | B | Maps 0–100 → 0–5. Display normalization. Keep. |
| Delta sign for KPI tile (`delta > 0`) | 0 | A | Pure user-data comparison. Keep. |
| `WeeklyInsightCard` cuts: `delta > 2`, `delta < -2` | ±2 pts | B → **C** | Display-only "improved/dipped" cutoff. Could become user-derived (e.g. "moved by more than ½σ of weekly delta"). Low priority — labelling, not gating. **Optional Phase 33b stretch.** |
| `RiskForecastCard` thresholds | — | A | Card consumes `computeRisk` directly — fully baseline-driven. None. |

## src/routes/_app/reports.tsx

| Constant | Value | Class | Recommendation |
| --- | --- | --- | --- |
| `avg7` / `prev7` window | 7-day rolling | B | Reporting cadence. Keep. |
| `adherence` formula | `doneCount / totalActionable` | A | Pure user-data ratio. Keep. |
| `delta > 0` sign | 0 | A | Pure user-data comparison. Keep. |
| `summaryLine` thresholds | (in `buildSummary`) | unaudited | Worth a follow-up read; `buildSummary` lives elsewhere and was outside this audit's file list. **Add to Phase 33b sweep.** |

---

## Summary — Phase 33 target list

Ranked by leverage (impact × confidence × small blast radius):

### 1. Stress score from HRV — **Phase 33a** (confirmed gap)

`health_scores.stress_score` exists as a column. The manual-log path (`services/scoring.ts`) populates it from self-reported stress level. **The Oura sync path never writes it.** `deriveDailyScores`'s output type doesn't even carry a `stress_score` field, so `persistDerivedScores` can't set one.

Oura's daily readiness payload (already captured raw in `wearable_daily_snapshots.payload`) contains HRV-derived contributors (`hrv_balance`, `resting_heart_rate`, `body_temperature`, etc.). Phase 33a should:

- Extend `DerivationRecordType` and `DerivedDailyScore` to carry `stress_score`.
- Add a small pure derivation that maps the readiness payload's HRV-related contributors into a 0–100 stress signal.
- Wire it through `persistDerivedScores`.
- Add tests using fixture readiness payloads.

Real-data only: every input is from the user's own readiness samples.

### 2. Per-user percentile thresholds — **Phase 33b** (clears most Class-C entries)

Replace the fixed-threshold fallback ladder in `src/lib/insights/generate.ts` (overall<50 / sleep<60 / activity<50) with **percentile cuts on the user's own rolling history**. Concretely:

- Compute the user's bottom-quartile cut for each sub-score over the last 14–30 days.
- Fire the fallback insight when the latest day is below that cut, not below the literal 50/60.
- Keep the literal cuts as a true cold-start fallback (when fewer than `MIN_BASELINE_DAYS` are available).

Then unify the manual-log generator (`services/engine.ts`) onto the same machinery, replacing its threshold ladder. This collapses two parallel insight engines into one, eliminating most Class-C entries in this audit.

### 3. Tiny mechanical refactor — fold into 33a

In `oura-sync.server.ts`, replace the literal `INSIGHT_CONTEXT_DAYS = 15` with `MAX_BASELINE_DAYS + 1` imported from `baseline.ts`. Three-line change. Removes one magic number that has a real semantic relationship to baseline math.

### Out of scope (deliberately)

- **`scoreNutrition` water bands** and any other Class-D entries (per-user goal settings) belong to a future **Settings phase**, not Phase 33.
- **Adaptive `WEIGHTS` for overall_score** is a longer roadmap item — needs more data per user before it's well-conditioned. Don't pursue in Phase 33.
- **`buildSummary` thresholds** in reports.tsx — out of this audit's file list. Add to Phase 33b's sweep when we get there.

## What this audit confirmed

- The **adaptive baseline path** (baseline.ts → generate.ts baseline-aware branch → computeRisk → RiskForecastCard) is already real-data-driven. The constants in it are calibration cutoffs, not decisions about the user.
- The **fixed-threshold fallback ladder** is the main remaining source of "constant masquerading as judgment" — and it's narrow enough to clean up in one pure-rule phase (33b).
- The **sync path is missing stress entirely**, even though the data is captured. That's the highest-leverage single change available right now (33a).
