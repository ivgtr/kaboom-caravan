# Combat Break & Burst Pacing

## Problem

The combat loop had accumulated useful decisions (distance bands, parry, Breakthrough, combat cores and battlefield objectives), but ordinary enemy contact still resolved mostly as sustained HP attrition. Later encounters raised pressure mainly by adding durable enemies at increasingly short spawn intervals. That made difficulty busier without making individual engagements feel substantially better.

## Design goal

Make the existing controls feel better before adding another button or resource meter.

The new loop is:

1. A small enemy pack arrives together.
2. The player focuses fire, advances into an effective range or lands a parry.
3. Damaged enemies cross a BREAK threshold and are staggered.
4. Armored enemies lose armor when BREAK occurs, so the rest of the kill accelerates.
5. Broken enemies contribute only 20% frontline pressure while staggered, creating a short recovery window.
6. The next attack beat arrives after a deliberate gap.

The intent is a repeated **pressure -> break -> finish -> breathe** rhythm instead of a continuous drip-feed of attrition.

## Enemy tuning

Normal enemies retain their previous HP so existing parry and combat-core opportunities do not disappear just because the global time-to-kill became too short. The sponge problem is targeted instead:

- Heavy HP is reduced from 110 to 100 and armor from 4 to 3.
- Boss HP is reduced from 440 to 400.
- Heavy / boss have two BREAK points and progressively lose armor.
- Basic / rusher / artillery / bomber have one BREAK point.
- Elite max HP scaling is included when calculating thresholds so elites do not break prematurely.

BREAK holds an enemy in place and suppresses frontline pressure. If an attack telegraph is already active, its timer is paused rather than deleted. This gives the player breathing room without removing parry opportunities or invalidating the Counter core.

BREAK does not alter the enemy's simulation position. A previous implementation physically pushed enemies backward, which could make a damaged target evade an already-fired projectile. Keeping collision position stable makes BREAK feel like a reward rather than an accidental dodge.

## Encounter pacing

Regular waves keep their enemy counts and role composition, but spawns are grouped into short attack beats. Most beats contain two or three enemies separated by a roughly two-second recovery gap.

This changes difficulty from a steady accumulation problem into a sequence of readable local problems. A clean burst creates room; a poor burst lets the pack overlap with the next one.

## Validation

`enemyBreak.test.ts` covers:

- threshold-triggered stagger and pressure suppression;
- repeated armor damage on heavy enemies;
- paused ranged telegraphs that resume after BREAK rather than disappearing.

The existing enemy/wave tests continue to cover native movement, ranged attacks, bomber contact behavior, wave lifecycle and boss phases. Full-run deterministic tests remain important because BREAK must not make Relay, Siege or Counter irrelevant.

## Follow-up tuning

The constants in `enemyDefinitions.ts` are intentionally centralized for playtesting. The first things to tune from real runs should be:

1. BREAK thresholds and stagger duration;
2. Heavy/Boss HP and armor loss;
3. the recovery gap between attack beats.

The mechanic should be judged primarily by whether a player can feel the difference between a cleanly handled pack and a sloppy one, not by whether total run win rate stays identical.
