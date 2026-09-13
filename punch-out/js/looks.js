/* Punch-Out!! — how each boxer looks.
   Kept apart from roster.js so the fight data and the artwork can be tuned
   independently. Colours and proportions are matched by eye against the
   original's in-ring sprites and title-card portraits.

   build, measured in pixels up from the soles:
     shY      shoulder line          shW      shoulder width (full)
     hipY     hip line               waistW   waist width (full)
     guardY   resting glove height   elbowOut how far the elbows flare
     belly    gut bulge              spread   stance width */
(function () {
  'use strict';
  var PO = window.PO, C = PO.C, R = PO.Roster;

  function build(o) {
    var b = {
      shY: 62, hipY: 24, guardY: 46, shW: 42, waistW: 26, belly: 0,
      spread: 12, legW: 13, bootW: 15, bootH: 9, trunkH: 19,
      armW: 11, elbowOut: 13, gloveR: 8
    };
    for (var k in o) b[k] = o[k];
    return b;
  }

  var LOOKS = {
    /* France. Lanky, sad-eyed, enormous swept blond hair, low sloppy guard. */
    glassjoe: {
      ring: C.ringBlue, portraitBg: C.blueL,
      skin: C.skin, skinD: C.skinD, skinL: C.skinL,
      trunk: C.white, trunkD: C.grey, trunkL: C.white, belt: C.blueL,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.grey3, bootD: C.black,
      build: build({ shW: 36, waistW: 22, armW: 9, gloveR: 7, legW: 11, elbowOut: 12,
                     shY: 58, hipY: 23, trunkH: 18, guardY: 40 }),
      head: { hairKey: 'glassjoe', hair: C.orange, hairL: C.tan, hairD: C.orangeD,
              skin: C.skin, skinD: C.skinD, skinL: C.skinL,
              hw: 11, jaw: 'pointed', brow: 'none',
              eyes: 'sad', nose: 'long', mouth: 'frown',
              eyeGap: 3, browOffset: 9, chinPad: 5 }
    },
    /* Germany. Square head, angry eyes, wide military moustache. */
    vonkaiser: {
      ring: C.ringBlue, portraitBg: C.blueL,
      skin: C.skin, skinD: C.skinD, skinL: C.skinL,
      trunk: C.purple, trunkD: C.purpleD, belt: C.white,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.black, bootD: C.grey3,
      build: build({ shW: 41, waistW: 25, armW: 10, shY: 61, guardY: 46 }),
      head: { hairKey: 'vonkaiser', facialKey: 'vonkaiser',
              hair: C.brown, hairL: C.brownL, hairD: C.brownD, browCol: C.brownD,
              skin: C.skin, skinD: C.skinD, skinL: C.skinL,
              hw: 11, jaw: 'square', brow: 'angry',
              eyes: 'angry', nose: 'bulb', mouth: 'flat',
              eyeGap: 2, browOffset: 8, mouthGap: 3, chinPad: 5 }
    },
    /* Japan. White headband with a red sun, tight high guard. */
    pistonhonda: {
      ring: C.ringBlue, portraitBg: C.red,
      skin: C.tanSkin, skinD: C.tanSkinD, skinL: C.gold,
      trunk: C.black, trunkD: C.grey3, belt: C.white,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.black, bootD: C.grey3,
      build: build({ shW: 45, waistW: 27, shY: 63, elbowOut: 14, guardY: 50 }),
      head: { hairKey: 'pistonhonda', hair: C.black, hairL: C.grey3, hairD: C.black,
              browCol: C.black, skin: C.tanSkin, skinD: C.tanSkinD, skinL: C.gold,
              hw: 11, jaw: 'square', brow: 'angry',
              eyes: 'angry', nose: 'flat', mouth: 'flat',
              eyeGap: 2, browOffset: 8, mouthGap: 3, chinPad: 5, acc: { a: C.white, b: C.red } }
    },
    /* Spain. Long face, sideburns, a rose, and a very tucked-in guard. */
    donflamenco: {
      ring: C.ringGreen, portraitBg: C.violet,
      skin: C.skin, skinD: C.skinD, skinL: C.skinL,
      trunk: C.pink, trunkD: C.pinkD, belt: C.yellow,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.black, bootD: C.grey3,
      build: build({ shW: 42, waistW: 24, armW: 10, elbowOut: 11, shY: 63, guardY: 50 }),
      head: { hairKey: 'donflamenco', hair: C.black, hairL: C.grey3, hairD: C.black,
              browCol: C.black, skin: C.skin, skinD: C.skinD, skinL: C.skinL,
              hw: 10, jaw: 'pointed', brow: 'flat',
              eyes: 'wide', nose: 'hook', mouth: 'grin',
              eyeGap: 2, browOffset: 9, chinPad: 5 }
    },
    /* Hippo Island. Vast, orange, jowly, tiny crown, no visible ears. */
    kinghippo: {
      ring: C.ringGreen, portraitBg: C.violet,
      skin: C.orange, skinD: C.orangeD, skinL: C.tan,
      trunk: C.magenta, trunkD: C.pinkD, belt: C.yellow,
      glove: C.purple, gloveD: C.purpleD, gloveL: C.violet, boot: C.brownD, bootD: C.black,
      build: build({ shW: 68, waistW: 58, belly: 21, hipY: 20, shY: 56, spread: 21,
                     legW: 19, bootW: 21, bootH: 10, trunkH: 20, armW: 15,
                     elbowOut: 3, gloveR: 11, guardY: 30 }),
      head: { hairKey: 'kinghippo', hair: C.orange, hairL: C.tan, hairD: C.orangeD,
              browCol: C.orangeD, skin: C.orange, skinD: C.orangeD, skinL: C.tan,
              hw: 12, jaw: 'jowly', brow: 'heavy',
              eyes: 'beady', nose: 'snout', mouth: 'wide',
              eyeGap: 4, browOffset: 7, mouthGap: 0, chinPad: 3, ears: false,
              acc: { a: C.blueL, b: C.yellow } }
    },
    /* India. Big white turban with a jewel, navy trunks. */
    greattiger: {
      ring: C.ringGreen, portraitBg: C.orange,
      skin: C.darkSkinL, skinD: C.darkSkin, skinL: C.tanSkin,
      trunk: C.navy, trunkD: C.blueD, belt: C.yellow,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.brownD, bootD: C.black,
      build: build({ shW: 43, waistW: 26, armW: 10, shY: 62, elbowOut: 14, guardY: 52 }),
      head: { hairKey: 'greattiger', facialKey: 'greattiger',
              hair: C.black, hairL: C.grey3, hairD: C.black, browCol: C.black,
              skin: C.darkSkinL, skinD: C.darkSkin, skinL: C.tanSkin,
              hw: 10, jaw: 'round', brow: 'angry',
              eyes: 'angry', nose: 'bulb', mouth: 'flat',
              eyeGap: 2, browOffset: 8, mouthGap: 3, chinPad: 4, ears: false,
              acc: { a: C.white, b: C.grey, c: C.red } }
    },
    /* Turkey. Bald, heavy brow, thick handlebar moustache, huge frame. */
    baldbull: {
      ring: C.ringBlue, portraitBg: C.blueL,
      skin: C.tanSkin, skinD: C.tanSkinD, skinL: C.gold,
      trunk: C.red, trunkD: C.redD, belt: C.white,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.black, bootD: C.grey3,
      build: build({ shW: 50, waistW: 32, armW: 13, gloveR: 9, spread: 14,
                     legW: 15, bootW: 17, shY: 68, hipY: 26, elbowOut: 17, trunkH: 21, guardY: 50 }),
      head: { hairKey: 'baldbull', facialKey: 'baldbull',
              hair: C.brownD, hairL: C.brown, hairD: C.black, browCol: C.brownD,
              skin: C.tanSkin, skinD: C.tanSkinD, skinL: C.gold,
              hw: 12, jaw: 'square', brow: 'heavy',
              eyes: 'angry', nose: 'bulb', mouth: 'flat',
              eyeGap: 2, browOffset: 8, mouthGap: 6, chinPad: 5 }
    },
    /* U.S.S.R. Pink trunks, red boots, grinning. */
    sodapopinski: {
      ring: C.ringBlue, portraitBg: C.pinkL,
      skin: C.skin, skinD: C.skinD, skinL: C.skinL,
      trunk: C.pink, trunkD: C.pinkD, belt: C.white,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.red, bootD: C.redD,
      build: build({ shW: 49, waistW: 30, armW: 12, gloveR: 9, spread: 13, shY: 66,
                     hipY: 25, elbowOut: 16, guardY: 48 }),
      head: { hairKey: 'sodapopinski', facialKey: 'sodapopinski',
              hair: C.brownD, hairL: C.brown, hairD: C.black, browCol: C.brownD,
              skin: C.skin, skinD: C.skinD, skinL: C.skinL,
              hw: 12, jaw: 'square', brow: 'heavy',
              eyes: 'wide', nose: 'bulb', mouth: 'grin',
              eyeGap: 2, browOffset: 8, mouthGap: 3, chinPad: 5 }
    },
    /* Philadelphia. Tallest on the card, beard, bared teeth. */
    mrsandman: {
      ring: C.ringBlue, portraitBg: C.grey,
      skin: C.darkSkin, skinD: C.darkSkinD, skinL: C.darkSkinL,
      trunk: C.white, trunkD: C.grey, belt: C.red,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.black, bootD: C.grey3,
      build: build({ shW: 52, waistW: 31, armW: 13, gloveR: 9, shY: 66, hipY: 26,
                     spread: 14, legW: 14, bootW: 16, elbowOut: 17, trunkH: 20, guardY: 54 }),
      head: { hairKey: 'mrsandman', facialKey: 'mrsandman', facialCol: C.grey3,
              hair: C.black, hairL: C.grey3, hairD: C.black, browCol: C.black,
              skin: C.darkSkin, skinD: C.darkSkinD, skinL: C.darkSkinL,
              hw: 12, jaw: 'square', brow: 'angry',
              eyes: 'angry', nose: 'flat', mouth: 'snarl',
              eyeGap: 2, browOffset: 8, mouthGap: 2, chinPad: 4 }
    },
    /* Hollywood. Chest hair, grey trunks, white boots, permanent smirk. */
    machoman: {
      ring: C.ringBlue, portraitBg: C.pinkL,
      skin: C.tanSkin, skinD: C.tanSkinD, skinL: C.gold,
      trunk: C.grey, trunkD: C.grey2, belt: C.blueL,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.white, bootD: C.grey,
      chestHair: C.brownD,
      build: build({ shW: 51, waistW: 27, armW: 13, gloveR: 9, shY: 67, hipY: 25,
                     spread: 13, elbowOut: 16, guardY: 52 }),
      head: { hairKey: 'machoman', facialKey: 'machoman',
              hair: C.brownD, hairL: C.brown, hairD: C.black, browCol: C.brownD,
              skin: C.tanSkin, skinD: C.tanSkinD, skinL: C.gold,
              hw: 11, jaw: 'square', brow: 'angry',
              eyes: 'angry', nose: 'flat', mouth: 'grin',
              eyeGap: 2, browOffset: 8, mouthGap: 3, chinPad: 5 }
    },
    /* Catskills. Black trunks and gloves, gold tooth. */
    tyson: {
      ring: C.ringTeal, portraitBg: C.blueL,
      skin: C.darkSkin, skinD: C.darkSkinD, skinL: C.darkSkinL,
      trunk: C.black, trunkD: C.grey3, belt: C.white,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.black, bootD: C.grey3,
      build: build({ shW: 50, waistW: 31, armW: 13, gloveR: 9, shY: 64, elbowOut: 15, guardY: 50 }),
      head: { hairKey: 'tyson', hair: C.black, hairL: C.grey3, hairD: C.black,
              browCol: C.black, skin: C.darkSkin, skinD: C.darkSkinD, skinL: C.darkSkinL,
              hw: 12, jaw: 'square', brow: 'heavy',
              eyes: 'angry', nose: 'flat', mouth: 'snarl',
              eyeGap: 2, browOffset: 8, mouthGap: 2, chinPad: 4 }
    },
    /* The stand-in champion: same frame, lighter skin, fair hair. */
    mrdream: {
      ring: C.ringPurple, portraitBg: C.blueL,
      skin: C.tanSkin, skinD: C.tanSkinD, skinL: C.gold,
      trunk: C.black, trunkD: C.grey3, belt: C.white,
      glove: C.red, gloveD: C.redD, gloveL: C.redL, boot: C.black, bootD: C.grey3,
      build: build({ shW: 50, waistW: 31, armW: 13, gloveR: 9, shY: 64, elbowOut: 15, guardY: 50 }),
      head: { hairKey: 'mrdream', hair: C.brownD, hairL: C.brownL, hairD: C.black,
              browCol: C.brownD, skin: C.tanSkin, skinD: C.tanSkinD, skinL: C.gold,
              hw: 12, jaw: 'square', brow: 'heavy',
              eyes: 'angry', nose: 'flat', mouth: 'snarl',
              eyeGap: 2, browOffset: 8, mouthGap: 2, chinPad: 4 }
    }
  };

  /* rematches reuse the original's look, with the changes the fight calls for */
  LOOKS.pistonhonda2 = LOOKS.pistonhonda;
  LOOKS.baldbull2 = LOOKS.baldbull;
  LOOKS.donflamenco2 = (function () {
    var o = {};
    for (var k in LOOKS.donflamenco) o[k] = LOOKS.donflamenco[k];
    o.trunk = C.purple; o.trunkD = C.purpleD; o.ring = C.ringBlue;
    return o;
  })();

  Object.keys(R).forEach(function (id) {
    var L = LOOKS[id];
    if (!L) { console.warn('punch-out: no look for ' + id); return; }
    for (var k in L) R[id][k] = L[k];
  });
  PO.Looks = LOOKS;
})();
