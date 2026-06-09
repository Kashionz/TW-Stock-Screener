import { readIndexHtml } from "./check-frontend-source.mjs";

const html = readIndexHtml();

const requiredMarkers = [
  {
    label: "desktop floating width",
    ok: /width:clamp\(340px,\s*36vw,\s*420px\)/.test(html),
  },
  {
    label: "drawer tabs",
    ok: html.includes('class="drawer-tabs"') && html.includes('id="dTabs"'),
  },
  {
    label: "overview tab and panel",
    ok: html.includes('data-section="overview"') && html.includes('data-panel="overview"'),
  },
  {
    label: "charts tab and panel",
    ok: html.includes('data-section="charts"') && html.includes('data-panel="charts"'),
  },
  {
    label: "financials tab and panel",
    ok: html.includes('data-section="financials"') && html.includes('data-panel="financials"'),
  },
  {
    label: "notes tab and panel",
    ok: html.includes('data-section="notes"') && html.includes('data-panel="notes"'),
  },
  {
    label: "overview content slot",
    ok: html.includes('id="dOverview"'),
  },
  {
    label: "drawer scroll region",
    ok: html.includes('class="drawer-scroll"'),
  },
  {
    label: "desktop light overlay",
    ok: /background:linear-gradient\(90deg,\s*rgba\(245,247,250,0\)/.test(html),
  },
];

const missing = requiredMarkers.filter((marker) => !marker.ok);

if (missing.length > 0) {
  console.error("Floating panel layout markers missing:");
  for (const marker of missing) {
    console.error(`- ${marker.label}`);
  }
  process.exit(1);
}

console.log("Floating panel layout markers verified.");
