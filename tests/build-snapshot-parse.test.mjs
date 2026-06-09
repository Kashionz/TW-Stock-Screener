import assert from "node:assert/strict";
import test from "node:test";

test("num parses Taiwan-formatted numbers and rejects blanks", async () => {
  const { num } = await import("../lib/build-snapshot.js");

  assert.equal(num("1,234,567"), 1234567);
  assert.equal(num("3.14"), 3.14);
  assert.equal(num("-12.5"), -12.5);
  assert.equal(num(null), null);
  assert.equal(num(""), null);
  assert.equal(num("-"), null);
  assert.equal(num("--"), null);
  assert.equal(num("abc"), null);
});

test("yi converts to 億 (hundred-millions) with one decimal", async () => {
  const { yi } = await import("../lib/build-snapshot.js");

  assert.equal(yi(100000), 1);
  assert.equal(yi(150000), 1.5);
  assert.equal(yi(null), null);
});

test("buildMonthOrder walks back N months oldest-first across year rollover", async () => {
  const { buildMonthOrder } = await import("../lib/build-snapshot.js");

  assert.deepEqual(buildMonthOrder("11504", 3), [
    [115, 2],
    [115, 3],
    [115, 4],
  ]);
  assert.deepEqual(buildMonthOrder("11502", 3), [
    [114, 12],
    [115, 1],
    [115, 2],
  ]);
});

test("buildQuarterOrder walks back N quarters oldest-first across year rollover", async () => {
  const { buildQuarterOrder } = await import("../lib/build-snapshot.js");

  assert.deepEqual(buildQuarterOrder(["115", "1"], 3), [
    [114, 3],
    [114, 4],
    [115, 1],
  ]);
});

test("singleQuarterFromCumulative derives single-quarter EPS from cumulative", async () => {
  const { singleQuarterFromCumulative } = await import("../lib/build-snapshot.js");

  // 114Q3 (no prior in window) -> null; 114Q4 = 5-3; 115Q1 -> taken as-is.
  assert.deepEqual(
    singleQuarterFromCumulative([3, 5, 1], [1143, 1144, 1151]),
    [null, 2, 1],
  );

  // Non-consecutive quarters cannot be differenced -> null.
  assert.deepEqual(
    singleQuarterFromCumulative([2, 5], [1142, 1144]),
    [null, null],
  );

  // Missing cumulative value stays null.
  assert.deepEqual(
    singleQuarterFromCumulative([null, 4], [1151, 1152]),
    [null, null],
  );
});

test("parseMonthlyRevenueHtml extracts revenue keyed by 4-digit code", async () => {
  const { parseMonthlyRevenueHtml } = await import("../lib/build-snapshot.js");

  const html = `
    <table>
      <tr><td>公司代號</td><td>名稱</td><td>營收</td></tr>
      <tr><td>2330</td><td>台積電</td><td>1,234,567</td></tr>
      <tr><td>9999A</td><td>非個股</td><td>10</td></tr>
      <tr><td>1101</td><td>台泥</td><td>-</td></tr>
    </table>`;

  assert.deepEqual(parseMonthlyRevenueHtml(html), { 2330: 1234567 });
});

test("parseQuarterlyEpsHtml reads the EPS column from 每股盈餘 tables", async () => {
  const { parseQuarterlyEpsHtml } = await import("../lib/build-snapshot.js");

  const html = `
    <table>
      <tr><th>公司代號</th><th>公司名稱</th><th>每股盈餘</th></tr>
      <tr><td>2330</td><td>台積電</td><td>8.50</td></tr>
      <tr><td>2317</td><td>鴻海</td><td>2.10</td></tr>
    </table>`;

  assert.deepEqual(parseQuarterlyEpsHtml(html), { 2330: 8.5, 2317: 2.1 });
});
