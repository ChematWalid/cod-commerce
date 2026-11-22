// Audit tool for D3122: matches each commune name of law 26-06 (scripts/geo/law-26-06-articles.json) to a unique ONS
// code of its former wilaya in a 58-wilaya seed, and prints the moves and every non-exact match for review.
// Usage: node scripts/geo/match-law-26-06.mjs scripts/geo/law-26-06-articles.json <58-wilaya geo-seed.json> <moves.json>
import { readFileSync, writeFileSync } from 'node:fs';
const [artsPath, seedPath, out] = process.argv.slice(2);
const arts = Object.fromEntries(
  JSON.parse(readFileSync(artsPath, 'utf8')).articles.map((a) => [a.article, { names: a.communes }]),
);
const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
// parent wilaya (58-numbering) -> [amended article of parent, [new wilaya code, article]...]
const PLAN = {
  '03': ['7', [['59', '52 bis 10']]],
  '05': ['9', [['60', '52 bis 11']]],
  '07': ['11', [['61', '52 bis 12']]],
  '12': ['16', [['62', '52 bis 13']]],
  '13': ['17', [['63', '52 bis 14']]],
  '14': ['18', [['64', '52 bis 15']]],
  '17': ['21', [['65', '52 bis 16'], ['66', '52 bis 17']]],
  '26': ['30', [['67', '52 bis 18']]],
  '28': ['32', [['68', '52 bis 19']]],
  '32': ['36', [['69', '52 bis 20']]],
};
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[’'`\-]/g, ' ')
  .replace(/\bAIN\b/g, 'AIN').replace(/\bOULED\b|\bOULAD\b/g, 'OULED').replace(/\bEL\b|\bAL\b|\bE\b/g, '')
  .replace(/OU/g, 'U').replace(/EE/g, 'E').replace(/[^A-Z]/g, '').replace(/(.)\1+/g, '$1');
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[a.length][b.length]; };
const result = { moves: {}, report: [] };
for (const [parent, [parentArt, news]] of Object.entries(PLAN)) {
  const pool = seed.towns.filter((t) => t.provinceCode === parent);
  const lists = [[parent, parentArt], ...news];
  const total = lists.reduce((s, [, a]) => s + arts[a].names.length, 0);
  result.report.push(`${parent}: seed ${pool.length}, JO lists ${total}`);
  const used = new Map();
  for (const [code, art] of lists) {
    for (const name of arts[art].names) {
      const n = norm(name);
      const scored = pool.map((t) => ({ t, d: Math.min(lev(n, norm(t.name)), ...t.names.filter((x) => /[A-Z]/i.test(x)).map((x) => lev(n, norm(x)))) })).sort((a, b) => a.d - b.d);
      const best = scored[0], second = scored[1];
      const ok = best.d <= 2 && (!second || second.d > best.d);
      const flag = ok ? (best.d === 0 ? '' : ` ~d${best.d}`) : ' ??AMBIGUOUS/FAR';
      if (!ok || best.d > 0) result.report.push(`  [${code}] "${name}" -> ${best.t.codeOns} ${best.t.name} (d${best.d}; next ${second ? second.t.name + ' d' + second.d : '-'})${flag}`);
      if (used.has(best.t.codeOns)) result.report.push(`  DUPLICATE ${best.t.codeOns} for "${name}" and "${used.get(best.t.codeOns)}"`);
      used.set(best.t.codeOns, name);
      if (code !== parent) result.moves[best.t.codeOns] = code;
    }
  }
  const missing = pool.filter((t) => !used.has(t.codeOns));
  if (missing.length) result.report.push(`  UNMATCHED in seed: ${missing.map((t) => t.codeOns + ' ' + t.name).join(', ')}`);
}
console.log(result.report.join('\n'));
console.log('moves', Object.keys(result.moves).length);
writeFileSync(out, JSON.stringify(result.moves));
