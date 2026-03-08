# Pre-Runtime Refactor Baseline Snapshot

**Date:** 2026-03-08
**Purpose:** Lock current baseline before runtime ownership refactoring

---

## Current Profession Survival Spread

| Character  | Survival Rate (First 3 Floors) | Survival Rate (All 5) | Avg Max Floor | Overall Score |
|------------|-------------------------------|----------------------|---------------|---------------|
| informant  | 58.3%                         | 41.7%                | 2.42          | 2470.21       |
| brute      | 83.3%                         | 50.0%                | 3.00          | 2673.90       |
| tactician  | 100%                          | 75.0%                | 3.58          | 2430.96       |
| chronomancer| 41.7%                         | 16.7%                | 2.08          | 2508.56       |
| puppeteer  | 33.3%                         | 0%                   | 1.42          | 1482.08       |
| alchemist  | 16.7%                         | 16.7%                | 0.75          | 1511.67       |

**Spread Analysis:**
- Survival spread (first 3): 83.33%
- Survival spread (all 5): 75%
- Notable outliers: Tactician (dominant early), Brute (dominant overall), Puppeteer/Alchemist (underperforming)

---

## Current Shop Affordability

| Character | Card | Potion | Relic |
|-----------|------|--------|-------|
| informant | 1.0  | 0.67   | 0.33  |
| brute     | 1.0  | 0.67   | 0.33  |
| tactician | 1.0  | 0.67   | 0.33  |
| chronomancer| 1.0 | 0.67   | 0.33  |
| puppeteer | 1.0  | 0.67   | 0.33  |
| alchemist | 1.0  | 0.67   | 0.33  |

**Reward-to-Price Ratios:**
- Card: 1.15 (affordable)
- Potion: 0.77 (marginal)
- Relic: 0.37 (expensive)
- Removal: 0.80 (marginal)

---

## Current Bundle State

From `baseline_audit.json`:
- Errors: 0
- Warnings: 6 (drift warnings on damage, block, draw, card price, relic price, potion price)
- All values match baseline exactly (no actual drift)

---

## UI Smoke Status

Not captured in this snapshot. Refer to last Playwright run.

---

## Files Copied

- `baseline_audit.pre_runtime_refactor.json`
- `combat_regression.pre_runtime_refactor.json`
- `economy_regression.pre_runtime_refactor.json`
