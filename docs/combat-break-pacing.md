# Combat Break & Burst Pacing

## Problem

The combat loop had accumulated useful decisions (distance bands, parry, Breakthrough, combat cores and battlefield objectives), but ordinary enemy contact still resolved mostly as sustained HP attrition. Later encounters raised pressure mainly by adding more durable enemies at increasingly short spawn intervals. That made difficulty busier without making individual hits or kills feel substantially better.

## Design goal

Make the existing controls feel better before adding another button or resource meter.

The new loop is:

1. A small enemy pack arrives together.
2. The player focuses fire, advances into an effective range or lands a parry.
3. Damaged enemies cross a BREAK threshold, recoil and lose their current attack.
4. Armored enemies lose armor when BREAK occurs, so the rest of the kill accelerates.
5. Broken enemies contribute only 20% frontline pressure while staggered, creating a short recovery window.
6. The next attack beat arrives after a deliberate gap.

The intent is a repeated **pressure -> break -> finish -> breathe** rhythm instead of a continuous drip-feed of attrition.

## Enemy tuning

Normal enemy HP is reduced so basic targets leave the screen faster and heavy targets stop behaving like pure damage sponges. BREAK profiles are data-driven per enemy type:

- Basic / rusher / artillery / bomber: one break point.
- Heavy / boss: two break points and progressive armor damage.
- Faster enemies recoil farther but recover sooner.
- Heavy enemies recoil less but remain interrupted longer.
- Elite max HP scaling is included when calculating thresholds so elites do not break prematurely.

BREAK cancels an attack windup, holds the enemy in place for its stagger duration and temporarily suppresses frontline pressure.

## Encounter pacing

Regular waves keep their enemy counts and role composition, but spawns are grouped into short attack beats. Most beats contain two or three enemies separated by a roughly two-second recovery gap.

This changes difficulty from a steady accumulation problem into a sequence of readable local problems. A clean burst creates room; a poor burst lets the pack overlap with the next one.

## Validation

`enemyBreak.test.ts` covers:

- threshold-triggered recoil and stagger;
- repeated armor damage on heavy enemies;
- attack windup cancellation for ranged enemies.

The existing enemy/wave tests continue to cover native movement, ranged attacks, bomber contact behavior, wave lifecycle and boss phases.

## Follow-up tuning

The constants in `enemyDefinitions.ts` are intentionally centralized for playtesting. The first things to tune from real runs should be:

1. break thresholds and stagger duration;
2. heavy/boss HP;
3. the recovery gap between attack beats.

The mechanic should be judged primarily by whether a player can feel the difference between a cleanly handled pack and a sloppy one, not by whether total run win rate stays identical.
