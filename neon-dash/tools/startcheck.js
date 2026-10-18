// every level must be solvable from every cheat start position (5% steps)
const E = require('../web/engine.js'), levels = require('../web/levels.js');
let bad = 0;
for (const L of levels) for (let pct = 5; pct <= 95; pct += 5) {
  const sx = E.safeStart(L, pct / 100 * (L.len - 20));
  const s = E.createState(L, {}, sx);
  const r = E.solve(L, {}, 3000000, s);
  if (!r) { bad++; console.log(`L${L.id} start ${pct}% x=${sx} unsolvable`); }
}
console.log(bad ? bad + ' failures' : 'all start positions solvable');
process.exit(bad ? 1 : 0);
