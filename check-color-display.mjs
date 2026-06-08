import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = '/Users/kashionz/Claude/Artifacts/twse-earnings-screener';
const versionsDir = join(rootDir, 'versions');
const latestVersion = readdirSync(versionsDir)
  .filter((name) => name.endsWith('.html'))
  .sort()
  .at(-1);

if (!latestVersion) throw new Error('No versioned HTML snapshot found.');

const targets = [
  join(rootDir, 'index.html'),
  join(versionsDir, latestVersion),
];

function expect(html, pattern, message) {
  if (!pattern.test(html)) throw new Error(message);
}

for (const target of targets) {
  const html = readFileSync(target, 'utf8');
  expect(html, /function signedFmt\(v,d=2,suffix=''\)/, `missing signedFmt helper in ${target}`);
  expect(html, /function epsBarColor\(v,isRecent\)/, `missing epsBarColor helper in ${target}`);
  expect(html, /<td>'\+pct\(o\.yoy\)\+'<\/td><td class="hideM">'\+pct\(o\.ytdYoy\)\+'<\/td><td class="hideM">'\+signedFmt\(o\.gm,1\)\+'<\/td>/, `main table gross margin is not sign-colored in ${target}`);
  expect(html, /<td>'\+signedFmt\(o\.eps,2\)\+'<\/td><td>'\+pct\(o\.epsYoY\)\+'<\/td>/, `main table EPS is not sign-colored in ${target}`);
  expect(html, /\['毛利率',signedFmt\(o\.gm,1,'%'\)\],\['EPS\(季\)',signedFmt\(displayQuarterEps\(o\),2\)\]/, `drawer stats are not sign-colored in ${target}`);
  expect(html, /const cols=arr\.map\(\(v,i\)=>epsBarColor\(v,i>=arr\.length-4\)\);/, `EPS chart colors are not based on value sign in ${target}`);
}

console.log(`color display checks passed for index.html and ${latestVersion}.`);
