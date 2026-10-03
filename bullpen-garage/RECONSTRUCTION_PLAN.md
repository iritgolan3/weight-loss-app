# The Bullpen: reconstruction plan (Phase 1)

Source video: "Tour The Most Amazing Luxury Garage Car Condo | The Bullpen" (https://youtu.be/uDjZLU8gtjk)

## 0. Evidence status

I could not watch the source video. This container's egress policy blocks
`youtube.com`, `ytimg.com`, `googlevideo.com`, Pinterest, the Wayback Machine
and the WheelHouse website (HTTP 403 from the proxy). The only external
evidence came from web-search result snippets:

| # | Evidence (from search snippets) | Confidence | Used for |
|---|---|---|---|
| E1 | The video tours "The Bullpen", described as "one of the finest garage condos". The owner, Erick, shares his garage. | medium | naming, sign |
| E2 | A blog cross-reference labels the video "The Bullpen (Wheel House Garage Condos)". | low/medium | building specs below |
| E3 | WheelHouse (Ponte Vedra / Nocatee, FL) units: **14 ft tall insulated panel overhead door**, **insulated steel man door**, **6 in structural concrete slab**, **mezzanine-ready design**, HVAC, water + sewer, **fire-protection (sprinkler) system**, **200 A electrical service** with interior lighting, **dedicated RV outlet**. | medium (if E2 holds) | architecture, details |
| E4 | WheelHouse suites range "from just over 700 sq ft to several thousand sq ft"; comparable FL condos have ~20 ft under the roof deck and mezzanines adding 30 to 50 % of floor area. | medium | overall volume |
| E5 | The brief itself says the video mentions a **central structural post** tied to the mezzanine, and shows custom cabinet walls, a workshop, a lounge (sofa, TV wall, bar and stools), and a mezzanine office/lounge with stairs and railings. | high (from the brief) | program |

**Everything else in this file is an assumption.** Every assumption is marked
`[A]` here and given a matching `ASSUMPTION` note in `bullpen/config.py`.
All layout and style values live in that file, so the scene can be refit to
the real video by editing numbers there and re-running the build.

## 1. Coordinate system and units

- Metric, unit scale 1.0, 1 BU = 1 m. Every object has scale (1, 1, 1);
  dimensions are baked into the mesh.
- Origin: floor level (top of slab coating), at the middle of the front
  wall's interior face.
- +X runs left to right for someone standing in the doorway looking in. +Y
  runs from the front (overhead door) to the back wall. +Z is up.

## 2. Building shell

| Item | Value | Basis |
|---|---|---|
| Interior width | 9.144 m (30 ft) [A] | E4 range; 30 ft is a common bay width |
| Interior depth | 18.288 m (60 ft) [A] | 1,800 sq ft unit: luxury end of E4 |
| Underside of roof deck | 6.40 m [A] | E4 (~20 ft or more); gives a 14 ft door with high-lift track |
| Roof structure | steel open-web bar joists (0.56 m deep), 1.52 m on centre, spanning the width; ribbed metal deck; painted white [A] | typical FL condo shell |
| Walls | painted gypsum on the side walls; painted CMU on the front wall [A] | |
| Slab | 6 in (152 mm) structural slab [E3]; saw-cut control joints at ~4.6 m spacing [A] | E3 |
| Floor finish | grey polyaspartic flake coating with a high-gloss clear coat [A] | most common car-condo finish |

### Front wall (y = 0)
- Overhead door: 3.658 m wide x 4.267 m tall (12 x 14 ft), insulated, ribbed steel, white, 7 sections, one row of window lites [E3 height; width A]. Centre at x = +1.10 [A].
- High-lift track, torsion spring tube, and a side-mounted jack-shaft opener on the right [A], which fits a 14 ft door under a ~20 ft deck.
- Insulated steel man door: 0.914 x 2.134 m (3 x 7 ft) at x = -3.20 [E3; position A].
- 200 A panel and the switch bank next to the man door [E3; position A].
- RV outlet (50 A) beside the overhead door [E3; position A].

## 3. Mezzanine and central post (E5)

- Rear mezzanine across the full width, 7.32 m (24 ft) deep, from y = 10.97 to 18.29 [A]. That is 67 m², about 37 % of the floor area (within E4).
- Finished floor level (FFL) +3.20 m [A]. Structure depth 0.36 m, so 2.84 m clear under the drywall soffit, enough for the lounge.
- Front edge: one W12 steel girder spanning wall to wall, carried by **one central HSS 150 x 150 post at x = 0, y = 10.97** [E5 says central; exact x/y A], plus wall posts at both ends.
- W8 joists at 1.22 m on centre run front to back onto a ledger on the rear wall. 19 mm sub-floor with oak LVP finish.
- Guard: 1.07 m (42 in) black steel, 50 mm top cap, 19 mm square pickets under 100 mm clear [A; code-compliant].
- Stair: straight run along the **left wall**, rising toward the back and landing at the mezzanine front edge. 18 risers of 177.8 mm, 17 treads with 280 mm going (4.76 m run), 1.07 m wide. Black steel plate stringers, 40 mm oak treads, open risers. Wall handrail plus a picket guard on the open side [A].

## 4. Zones (plan)

```
 y=18.29 +------------------------------------------------+  back wall
         | BAR (left wall)  |  TV / feature wall   | BATH  |
         |  back-bar shelves|  sofa, coffee table  | 2.6 x |
         |  + stools        |  lounge chairs, rug  | 2.7 m |
 y=10.97 +======== mezzanine edge (beam) ==== POST (x=0) ==+
         |S|                                   | cabinet  |
         |T|        CAR 1          CAR 2       | wall     |
         |A|      (nose in)      (nose in)     | (workshop|
         |I|                                   |  run)    |
         |R|                                   |  + tool  |
         |  detailing / memorabilia wall       |  chest   |
 y=0     +--[man door]-------[ overhead door ]---------+  front wall
        x=-4.57                                     x=+4.57
```

- **Workshop / cabinet wall** (right wall, y 0.9 to 10.4) [A]: 610 mm deep powder-coated steel modules. From the front: tall locker, 2 x drawer bases, sink base with a utility sink (E3 water), drawer bases, tall locker. Stainless worktop at 915 mm, wall cabinets 1.45 to 2.20 m, slatwall above the worktop with hand tools. Rolling tool chest, compressor and hose reel nearby.
- **Left wall, front zone** [A]: detailing shelves, framed automotive prints, extinguisher.
- **Lounge, under the mezzanine** [A]: a 75 in TV on a slatted oak feature wall, media console, a 3-seat sofa facing the back wall, two lounge chairs, coffee table, rug.
- **Bar** [A]: L-shaped bar along the left wall under the mezzanine. Quartz top, slatted front, 4 stools, back-bar shelving with bottles, beverage fridge, pendants.
- **Bathroom** [A]: rear-right corner, 2.6 x 2.7 m enclosure, 0.81 m door, WC and vanity [E3 water/sewer].
- **Mezzanine** [A]: office desk at the guard looking over the cars, desk chair, display shelving (helmets, die-cast models), loveseat, rug, mini-split head.
- **"THE BULLPEN" sign** [E1 name; form and position A]: back-lit sign over the bar.

## 5. Vehicles [A: no evidence about make, colour or count]
Placeholders that keep real-world size and clearance:
- Car_01: rear-engined sports coupe, 4.57 x 1.85 x 1.30 m, wheelbase 2.45 m, red, nose-in at x = -1.55.
- Car_02: front-engined GT coupe, 4.70 x 1.95 x 1.28 m, wheelbase 2.70 m, silver, nose-in at x = +1.75.
- Clearances: at least 0.9 m between car doors, 1.2 m to the cabinet face, and 0.6 m to the stair stringer.

## 6. Lighting [A]
- Bay: 6 x 2.44 m suspended linear LED (5000 K) at 5.4 m, plus 2 over the mezzanine (4000 K).
- Under the mezzanine: 9 recessed 4 in downlights (3000 K), 3 bar pendants (2700 K), a TV bias light and the sign glow.
- Under-cabinet LED strip (4000 K).
- Daylight from a sky texture and sun through the door lites.

## 7. Phases followed
1. This plan.
2. to 3. Shell blockout, then a proportion check with a top-view render and reference empties.
4. Mezzanine, post, stair, guards.
5. Cabinet modules and furniture.
6. Workshop equipment.
7. Decor and details.
8. PBR materials with imperfection layers.
9. Lighting.
10. Cameras.
11. to 12. Accuracy and realism passes with preview renders.

## 8. What is needed to make this accurate
Give the build access to the video, using either option below. Then
correct `bullpen/config.py` against real frames.
1. Allow `youtube.com`, `*.googlevideo.com` and `i.ytimg.com` in the
   environment's network settings.
2. Commit the video, or about 30 screenshots, to `bullpen-garage/reference/`.
