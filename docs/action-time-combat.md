# ACTION TIME combat prototype

## Why this exists

Recent combat work has improved resources, risk and encounter goals, but the moment-to-moment interaction can still collapse into holding or repeating weapon inputs until the room is empty. ACTION TIME changes the cost model of every existing action instead of adding another weapon, gauge or ultimate.

The rule is deliberately simple:

> **When the caravan does nothing, the battlefield crawls. When the caravan acts, the battlefield acts too.**

This moves the game away from continuous button throughput and toward a stop/read/commit rhythm. Existing enemies, weapons, REDLINE, DEATH RIDE, route objectives and rewards remain available, but their timing has to be reconsidered by the player.

## Rules

- Live combat input is tagged with a world-time scale.
- No meaningful input: world simulation runs at **0.08x**.
- Move, primary fire, secondary fire, parry or DEATH RIDE: world simulation immediately returns to **1.00x**.
- Holding boost while stationary does not wake the world because it does not move the caravan or spend energy by itself.
- BOOST + FIRE still runs at 1.00x, so REDLINE cannot exploit slow time while dealing damage.
- Enemy movement, attack windups, projectiles, wave spawns, weapon cooldowns, heat recovery, boost energy and objective timers all share the same scaled simulation delta.
- The displayed clear-time clock still counts fixed combat ticks. Thinking is safer, but it is not free if the player cares about clear time.

## Intended player stories

The target is not "I found a stronger gun." It is moments such as:

- stopping with an artillery shell halfway across the screen, reading the lane, then choosing whether one shot is worth giving the shell full-speed travel time;
- refusing to fire while an overheated weapon barely cools, because waiting no longer gives free recovery;
- committing to a forward boost and watching every enemy windup snap back to full speed at the same instant;
- entering REDLINE knowing that the desperate volley also releases every threat that was crawling toward the caravan.

## Why 0.08x instead of a complete freeze

A complete freeze makes the optimal state visually dead and can stall scheduled waves before the first readable threat appears. A small residual flow keeps animation and danger legible while still creating an order-of-magnitude contrast between observation and action.

## Technical boundary

The rule is attached to commands produced by `InputManager`. Raw `PlayerCommand` objects created directly by simulation tests and tools default to 1x. This preserves the deterministic physics layer as a useful standalone test surface while allowing live gameplay to opt into ACTION TIME explicitly.

## Acceptance checks

1. Start a battle and release every combat input. Enemy movement and wave timing should become visibly slow, not fully paused.
2. Hold A/D or either fire button. The battlefield should immediately return to normal speed.
3. Release the input again. Enemy projectiles and windups should return to 0.08x rather than continuing at 1x.
4. Confirm that weapon cooldown and heat recovery also slow during observation; there must be no free cooldown exploit.
5. Confirm that SHIFT alone does not accelerate time, while SHIFT + movement and BOOST + FIRE do.
6. Confirm REDLINE, DEATH RIDE, route objectives, weapon-cache interruptions, pause/resume and the boss still function.
