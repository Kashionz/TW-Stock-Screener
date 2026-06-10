import { readIndexHtml } from "./check-frontend-source.mjs";

const html = readIndexHtml();

const requiredMarkers = [
  {
    label: "desktop two-column workspace",
    ok: /\.workspace\{[^}]*grid-template-columns:minmax\(0,1fr\) clamp\(340px,28vw,420px\)/.test(
      html,
    ),
  },
  {
    label: "desktop drawer is sticky beside the table",
    ok: /\.dr\{[^}]*position:sticky;[^}]*top:24px;[^}]*height:calc\(100vh - 48px\);/.test(
      html,
    ),
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
    label: "drawer content reserves a dedicated row for tabs",
    ok: /grid-template-rows:auto auto auto auto minmax\(0,1fr\)/.test(html),
  },
  {
    label: "overlay gradient for mobile slide-in",
    ok: /background:linear-gradient\(90deg,\s*rgba\(245,247,250,0\)/.test(html),
  },
  {
    label: "overlay inert by default",
    ok: /\.ov\{[^}]*opacity:0;[^}]*pointer-events:none;[^}]*\}/.test(html),
  },
  {
    label: "desktop drawer shell visible by default",
    ok: /\.dr\{[\s\S]*?transform:translateX\(0\);[\s\S]*?opacity:1;[\s\S]*?pointer-events:auto;[\s\S]*?\}/.test(
      html,
    ),
  },
  {
    label: "mobile drawer remains hidden until open",
    ok: /@media \(max-width:1180px\)\{[\s\S]*?\.dr\{[\s\S]*?position:fixed;[\s\S]*?display:none;[\s\S]*?transform:translateX\(104%\);[\s\S]*?opacity:0;[\s\S]*?pointer-events:none;[\s\S]*?\}[\s\S]*?\.dr\.on\{[\s\S]*?display:grid;[\s\S]*?transform:translateX\(0\);[\s\S]*?opacity:1;[\s\S]*?pointer-events:auto;[\s\S]*?\}/.test(
      html,
    ),
  },
  {
    label: "mobile overlay still captures close taps",
    ok: /@media \(max-width:1180px\)\{[\s\S]*?\.ov\.on\{[\s\S]*?opacity:1;[\s\S]*?pointer-events:auto;[\s\S]*?\}/.test(
      html,
    ),
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
