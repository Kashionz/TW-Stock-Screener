import assert from "node:assert/strict";
import test from "node:test";

import { escapeHtml, formatChange } from "../assets/app/helpers.js";

test("escapeHtml neutralizes HTML-significant characters", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert(1)">`),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
  assert.equal(escapeHtml("a & b"), "a &amp; b");
  assert.equal(escapeHtml("O'Reilly"), "O&#39;Reilly");
});

test("escapeHtml passes plain text through and coerces nullish to empty", () => {
  assert.equal(escapeHtml("台積電 2330"), "台積電 2330");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("formatChange renders event text before numeric fallbacks", () => {
  assert.equal(formatChange({ chg: null, chgText: "除息" }), '<span class="muted">除息</span>');
  assert.equal(formatChange({ chg: 8, chgText: null }), '<span class="pos">+8.0</span>');
  assert.equal(formatChange({ chg: null, chgText: null }), '<span class="muted">—</span>');
});
