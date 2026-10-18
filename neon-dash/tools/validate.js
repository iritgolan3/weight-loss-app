// Verifies that every level can be completed by the search-based bot.
// usage: node tools/validate.js [levelId ...]
const path = require('path');
const Engine = require(path.join(__dirname, '../web/engine.js'));
const levels = require(path.join(__dirname, '../web/levels.js'));
const only = process.argv.slice(2).map(Number);
let bad = 0;
for (const L of levels) {
  if (only.length && !only.includes(L.id)) continue;
  const t0 = Date.now();
  const inputs = Engine.solve(L, {});
  const ms = Date.now() - t0;
  if (!inputs) { bad++; console.log(`L${L.id} ${L.name}: FAILED (${ms} ms) stuck near x=${(Engine.solve.deepest*Engine.SUB*Engine.DT*L.speed).toFixed(1)}`); continue; }
  // replay to confirm
  const s = Engine.createState(L, { noEvents: true }, 0);
  for (let i = 0; i < inputs.length && !s.won && !s.dead; i++) for (let j = 0; j < Engine.SUB; j++) Engine.step(s, inputs[i]);
  console.log(`L${L.id} ${L.name}: ${s.won ? 'OK' : 'REPLAY MISMATCH'} len=${L.len.toFixed(0)} objs=${L.objects.length} frames=${inputs.length} ${ms} ms`);
  if (!s.won) bad++;
}
process.exit(bad ? 1 : 0);
