# Player Chassis Prompt v004

## Initial edit

Use case: precise-object-edit

Asset type: final assembled player vehicle base sprite for a 2D game

Input target: the idle cell from `veh_player_motion_v002`. Preserve its Kaboom
Caravan identity, warm-ivory and coral body, mint windows, deep-navy chassis,
rounded proportions, camera angle, thick outline and soft toon lighting.

Create one clean production-ready base Caravan as a single cohesive illustration.
Remove the rear cyan tank, purple cargo crate, loose luggage, mounted weapons and
equipment attachments. Reconstruct the rear panel cleanly. Add a subtle roof
turret socket and empty side hardpoint sockets. The result must look finished with
zero equipment. Use a flat `#ff00ff` background with no shadow or floor.

## Corrective pass: wheel axes

Preserve the clean body exactly. Correct only the wheel system:

- exactly two visible wheels total
- both wheels use the same outer diameter
- both circular Hub centers use exactly the same horizontal Y coordinate
- both tire bottoms touch the same horizontal ground baseline
- wheels are perfectly circular and viewed straight-on
- fenders naturally occlude the upper tire edges
- remove every partially hidden or duplicated third wheel
- no Cyan rotation markers; Runtime renders these from measured Hub anchors

Keep the vehicle level and stationary. No equipment, weapon, cargo, exposed
suspension, walking pose, text, logo or watermark.
