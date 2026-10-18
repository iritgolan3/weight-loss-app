// every cube motif must be beatable on its own at every speed-portal speed
const E = require('../web/engine.js'), levels = require('../web/levels.js');
let bad = 0;
for (const name of Object.keys(levels.motifs)) {
  for (const sp of ['slow', 'normal', 'fast', 'faster']) {
    const L = levels.build({ id: 0, name, seed: 1, script: [14, 'S:' + sp, 10, name, 16] });
    if (!E.solve(L, {}, 500000)) { bad++; console.log(`motif ${name} @ ${sp}: unsolvable`); }
  }
}
console.log(bad ? bad + ' failures' : 'all motifs ok');
process.exit(bad ? 1 : 0);
