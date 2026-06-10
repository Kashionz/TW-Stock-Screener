import { readFrontendSource, readIndexHtml } from "./check-frontend-source.mjs";

const html = readIndexHtml();
const source = readFrontendSource();

const requiredMarkers = [
  {
    label: "hero toggle markup",
    ok:
      html.includes('id="heroToggle"') &&
      html.includes('aria-controls="heroPlaybook heroSnapshot"'),
  },
  {
    label: "hero collapse wiring",
    ok:
      source.includes('classList.toggle("hero-expanded")') &&
      /\.hero\.hero-expanded #heroPlaybook/.test(html),
  },
  {
    label: "merged price column header",
    ok: html.includes('data-s="price">股價') && !html.includes('data-s="chg"'),
  },
  {
    label: "change sub-line in price cell",
    ok: source.includes('<span class="chg-sub">${formatChange(row)}</span>'),
  },
  {
    label: "price column visible on mobile",
    ok: !/<th data-s="price"[^>]*class=/.test(html),
  },
  {
    label: "narrow-desktop hide tier",
    ok: /@media \(min-width:1181px\) and \(max-width:1366px\)\{[\s\S]*?\.hideN\{[\s\S]*?display:none;/.test(
      html,
    ),
  },
  {
    label: "two-row filter grid",
    ok:
      /\.filter-grid\{[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/.test(html) &&
      /\.flag-group\{[^}]*display:contents;/.test(html),
  },
  {
    label: "sort direction indicator",
    ok:
      html.includes('class="arr"') &&
      source.includes('header.setAttribute("aria-sort"') &&
      source.includes('"descending" : "ascending"'),
  },
];

const missing = requiredMarkers.filter((marker) => !marker.ok);

if (missing.length > 0) {
  console.error("UX layout markers missing:");
  for (const marker of missing) {
    console.error(`- ${marker.label}`);
  }
  process.exit(1);
}

console.log("UX layout markers verified.");
