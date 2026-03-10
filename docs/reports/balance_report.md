# Balance Pass Report (skills.md framework)

Date: 2026-02-25 (Updated)

## Alchemist Targeted Buff (2026-02-25)

**Problem**: Alchemist had ~70% first-3-floors survival rate, lowest among all classes.

**Root Cause Analysis**:
- Only 2 attack cards (fire_arrow) vs 4-5 strike for other classes
- Only 2 defense cards (defend) vs 4 defend for other classes  
- chain_reaction in starting deck was useless early (requires element buildup)
- element_spark provided no immediate combat value

**Changes**:

### characters.json
- alchemist startingDeck: removed chain_reaction, added fire_arrow + frost_armor
- New deck: element_spark x3, defend x2, fire_arrow x3, frost_armor x3 (11 cards)

### cards.json
- element_spark: added "Gain 3 Block" action (now provides immediate value)
- fire_arrow: damage 7 -> 8 (aligned with strike power)

### SpecialActions.ts (Element Reactions)
- Fire + Acid: Burn 5 -> 6
- Fire + Lightning: damage 10 -> 12

**Results** (20 runs per class):

| Class        | Before | After |
|--------------|--------|-------|
| informant    | 85%    | 85%   |
| brute        | 95%    | 95%   |
| tactician    | 100%   | 100%  |
| chronomancer | 95%    | 95%   |
| puppeteer    | 100%   | 100%  |
| alchemist    | 70%    | 100%  |

---

## Previous Balance Pass (2026-02-24)

Method: cost-first card normalization (preserve text sync), role-based threat budget pass for enemies, DP baseline HP alignment for characters, EUV-based economy repricing for potions/relics. Second pass adds toxicity surcharge (potions), corruption premium/discount (relics), and variance discount for chaos items, following skills.md.

## cards
- element_spark: added Gain 3 Block
- fire_arrow: damage 7 -> 8

## enemies
- slime_small: hp_range 11,15 -> 11,15
- slime_small: tackle damage 4 -> 5
- goblin: hp_range 22,28 -> 22,28
- goblin: attack damage 6 -> 7
- goblin: block 5 -> 6
- cultist: dark_strike damage 6 -> 7
- jaw_worm: chomp damage 11 -> 10
- jaw_worm: thrash damage 7 -> 6
- jaw_worm: thrash block 5 -> 6
- jaw_worm: bellow strength 3 -> 2
- gremlin_nob: rush damage 14 -> 13
- gremlin_nob: skull_bash damage 6 -> 7
- lagavulin: attack damage 18 -> 16
- slime_boss: hp_range 150,165 -> 150,165
- slime_boss: slam damage 18 -> 16
- slime_boss: prep block 15 -> 18
- predictor: hp_range 34,40 -> 34,40
- fission: hp_range 42,48 -> 42,48
- fission: pulse damage 8 -> 7
- barrier: shield_bash damage 5 -> 6
- barrier: fortify block 12 -> 14
- alchemy_master: hp_range 210,230 -> 210,230
- alchemy_master: brew_acid poison 3 -> 4
- alchemy_master: throw_concoction damage 15 -> 14
- time_guardian: hp_range 250,275 -> 250,275
- time_guardian: time_strike damage 18 -> 16
- time_guardian: rewind heal 20 -> 24
- puppet_queen: hp_range 190,215 -> 190,215
- puppet_queen: command buff 2 -> 3

## characters
- alchemist: startingDeck restructured (see above)

## potions
- no changes

## relics
- no changes
