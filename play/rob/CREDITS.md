# Credits and licence

## 3D model

> "R.O.B. (Robotic Operating Buddy)" (https://skfb.ly/oWXI7) by Wrld_Bld is licensed
> under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).

- **Author:** Wrld_Bld (https://sketchfab.com/eric.schirmer123)
- **Source:** https://sketchfab.com/3d-models/rob-robotic-operating-buddy-c263ae1351654aa985673e266bc02d8c
- **Licence:** Creative Commons Attribution 4.0 (CC BY 4.0): "Author must be credited.
  Commercial use is allowed." (verbatim from the Sketchfab API)

The attribution line above is reproduced verbatim, as supplied, and is also displayed on
`index.html` itself.

### What was changed (rebuild of 18/19 Oct 2026)

The artist's original upload is used as the source: `source/Rob.fbx` from Sketchfab's "source"
download (`rob-robotic-operating-buddy.zip`), with his 33 texture maps. The derived copies of
the model (Sketchfab's glTF, GLB and USDZ conversions) are not used. `tools/rob/rob_build.py`
derives the viewer's model from it; every step is logged (`plan/build.log`):

- the FBX holds two themes of the same sculpt; **`white_theme`** (the NES unit: light grey
  body, red nameplate, black end blocks) is kept and `dark_theme` (the same geometry in a flat
  silver) is dropped;
- the artist's maps are wired to his five materials (the FBX itself carries no images);
- the mesh is **separated into the 559 loose shells it is built from** and those shells are
  assigned, whole, to the rig's nine groups. No face is cut, bent or stretched; the toy's real
  seams all fall on the artist's own part breaks;
- **229 shells that existed twice** (identical duplicates at the neck and among the base's
  lettering) are reduced to one each;
- the four **neck pins are lengthened 3 mm** upward into the head so they never end in the air
  when the head tilts (a length change on a hidden end);
- the **head is turned back to face forward**: the artist posed it 24.6 degrees to the robot's
  right; the toy's head cannot turn, so the whole head group is rotated about the neck axis as
  one rigid piece (nothing reshaped);
- the **arms are straightened at the shoulder**: the artist posed them drooping 19 degrees; each
  arm, one rigid piece, is rotated level about its own shoulder pivot, as the design patent's side
  views draw the toy (19 Oct 2026; nothing reshaped);
- the **shoulder caps are levelled**: the artist posed each cap pitched 20 degrees with its crown
  above the body top; on the toy the shoulders and body are one moulding with the shoulder tops
  just below the body top. Each cap and its two slot pieces are rotated level about the cap's
  centroid and dropped 3 mm below the body top, rigidly, as part of the upper body
  (19 Oct 2026; nothing reshaped);
- the **arms are recoloured** to the NES unit's grey, measured on the Evan-Amos photograph
  (the arms' lit faces are 0.65 of the shell's; `plan/arm-colour/`): a copy of the artist's
  `metal_white` material with its base-colour, metallic and roughness maps removed, a constant
  base colour of 0.65 x the body map's median (0.372 sRGB), roughness 0.55 and metallic 0; his
  normal map is kept. The foot band and the other dark parts keep his material; the black end
  blocks stay black;
- the **column is rebuilt as one post**: the artist modelled it as six chamfered blocks on a dark
  core with two thin rods; the toy's column (US D296,347 FIG. 2, 4 and 5; the Evan-Amos and
  Sintegrity photographs) is one smooth post with a toothed rack strip let into each front corner.
  The post keeps the blocks' footprint and height, its grey is the median of the artist's own
  base-colour texels under the blocks, and the racks are new geometry at the measured 1.17 mm
  pitch (`plan/spine/`, 21 Oct 2026; `--spine source` keeps the artist's blocks);
- the **neck bracket goes with the head** (21 Oct 2026): the neck block, its four posts and
  pins and the mounting frame were left in the artist's turned pose when the head was turned back
  to face forward; they are now turned with it (the same 24.6 degree rigid rotation) and belong to
  the head's node, so they tilt with the head as the part that tilts it. The round column cap stays;
- the **head's top panel is grown 1.0 mm per side** (21 Oct): the artist's panel was 0.7 to
  0.8 mm smaller than the shell's roof opening, so the hollow inside showed through a slit at the
  rear right corner; the panel is scaled about its own centre, nothing else reshaped;
- **five face bars are added as new geometry** (21 Oct, from a photograph of the toy):
  the horizontal bars stacked between the two lenses on the black face plate, the middle three a
  little shorter than the top and bottom ones, sized from the lenses (`stage_face_bars`);
- the **upper body's top stop is the top of the column** (21 Oct): the artist's rest pose
  left 20 mm of column above the shell; the shell, caps, arms and hands are raised 20.1 mm so the
  collar sits under the column cap, the travel grows by the same amount (88.5 mm, six stops), and
  the bottom stop still clears the hub; the model loads at that top stop;
- the **head LED** gets its own emissive material (`led`) so the page can switch it;
- **two pairs of hands are added as new geometry**, drawn from the Gyromite and Stack-Up
  manuals: the forked Gyro Hands and the cup-shaped Block Hands (`tools/rob/rob_build.py`,
  `stage_hands`). The artist's own clip hands are kept as a third set; the bare end blocks are
  the fourth state;
- a **rig** is added: empties on the measured pivots (turntable axis, the two shoulder bosses,
  the head's tilt axis), every node with identity rotation at rest, the whole scaled to the
  toy's 242 mm. The source ships no rig and no animation. The head is parented to the fixed
  base, as on the toy;
- the **coiled cord** (221,184 triangles, 42 % of the file) is left out of the web model; the
  page draws a coil between the cord's two anchors so it can follow the body, sized from the
  real cord in the Evan-Amos photograph (20 mm across, 3.5 mm wire, 4.5 mm pitch;
  `plan/cord/`), not from the artist's shell, which was 38 mm across;
- for the web file, shells of 500 triangles or more are reduced (planar dissolve at 2.5 deg,
  the biggest shells also collapsed to 60 %), 286,460 -> 103,192 triangles plus the new hands;
  the 2048 px maps are resampled to 1024 px JPEG. `work/rob_build.blend` keeps everything at
  full weight, cord included;
- the joint limits, stops, timings and anchors travel in the `.glb` as glTF `extras` on
  `ROB_Root`.

The arm slope is a build parameter (`--arm-slope`); the published file uses level (0 deg), as
the toy is built; the artist's 19 deg is kept as `_old/rob-slope19-2026-10-19.glb`.

CC BY 4.0 permits adaptation provided the author is credited and the changes are indicated;
this section is that indication.

## The accessories (24 Oct 2026)

The gyros, the spinner and its D cell, the gyro tray with Controller 2 and its two levers, the gyro
holder, the five Stack-Up blocks and their five trays, the hand pairs as box items, and the parts box
are **our own geometry**, built parametrically by `tools/rob/acc_build.py` into `accessories.glb`
No model of them was taken from anyone.
The gyro's label is drawn by `tools/rob/acc_label.py` (a red disc, the word GYRO, a checked rim; no
maker's mark). Controller 2 is drawn by `rob-accessories.mjs` when the scene loads (2 Nov 2026), after
the site's own NES controller picture: our own rounded slab, a face plate drawn on a small canvas
(the grey bars, SELECT and START, the Nintendo name as plain red lettering, B and A), the black cross,
the red buttons, the two pills and the cord. The build's plain pad in `accessories.glb` is replaced at
load; its size and its data are kept.

Two measurements were read from a published replacement part: the Stack-Up block (39.6 mm across,
15.4 mm tall, with its peg and socket) and its stand (48 mm tall), from **"NES R.O.B. Stack-up
Replacement parts" by archonik** (https://www.thingiverse.com/thing:2399494, also
https://github.com/arhneu/stackup), licensed **CC BY 4.0**. His files are kept for the record under
`reference/accessories/stackup-arhneu/` and nothing of them ships; only the numbers were used.

The other sizes come from the photographs listed in `reference/SOURCES.md` and the two instruction
booklets, scaled to this model by one factor (1.18).

## Software

- **three.js** (r169), MIT licence, https://threejs.org/ , vendored under `vendor/three/`, with
  its full licence text in `vendor/three/LICENSE` (RESOLVED 2026-10-28; also
  licenses/THIRD-PARTY-NOTICES section 9).
- **Blender** 5.2.2 LTS, GPL, used headlessly for every build and render step.
- **PyMuPDF** and **Pillow** (system Python), for reading the reference scans and composing
  the comparison sheets.

## Reference material (research only, nothing of it ships)

Listed with origin and licence in `reference/SOURCES.md`: photographs from Wikimedia Commons
(Evan-Amos CC BY-SA 3.0; Sintegrity CC BY-SA 4.0; Chapuisat CC BY 2.0; Phil Bond CC BY-SA 3.0;
Solomon203 CC BY-SA 4.0), US patents 4,729,563 and D296,347 (public domain), the Gyromite and
Stack-Up instruction booklets (archive.org scans), the NESdev wiki pages `R.O.B.` and
`R.O.B._Firmware`.

`tools/rob/build_rob.py` is an older, independent procedural model built from the photographs
and the design patent; it is kept as a parametric reference only and is not used by the viewer.

## Trademark

R.O.B. and the Robotic Operating Buddy design are trademarks of Nintendo. This is an
unaffiliated, non-commercial technical test page.
