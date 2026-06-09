import assert from "node:assert/strict";
import test from "node:test";

// One TWSE stock + one TPEX stock, exercising both key conventions
// (Code vs SecuritiesCompanyCode, PEratio vs PriceEarningRatio, ClosingPrice vs Close).
function fixtureInputs() {
  return {
    twseRevenue: [
      {
        "公司代號": "2330",
        "公司名稱": "台積電",
        "產業別": "半導體業",
        "資料年月": "11504",
        "營業收入-當月營收": "1,000,000",
        "營業收入-去年同月增減(%)": "35",
        "累計營業收入-前期比較增減(%)": "25",
        "營業收入-上月比較增減(%)": "5",
        "備註": "-",
      },
    ],
    tpexRevenue: [
      {
        "公司代號": "6488",
        "公司名稱": "環球晶",
        "產業別": "半導體業",
        "資料年月": "11504",
        "營業收入-當月營收": "200,000",
        "營業收入-去年同月增減(%)": "10",
        "累計營業收入-前期比較增減(%)": "8",
        "備註": "",
      },
    ],
    twseValuation: [
      { Code: "2330", PEratio: "18.5", PBratio: "5.2", DividendYield: "2.1", Date: "1150605" },
    ],
    tpexValuation: [
      { SecuritiesCompanyCode: "6488", PriceEarningRatio: "22", PriceBookRatio: "3", YieldRatio: "1.5" },
    ],
    twsePrice: [{ Code: "2330", ClosingPrice: "900", Change: "5", Date: "1150605" }],
    tpexPrice: [{ SecuritiesCompanyCode: "6488", Close: "500", Change: "-2" }],
    twseIncomeResults: [
      [
        {
          "公司代號": "2330",
          Year: "115",
          Season: "1",
          "營業收入": "1,800,000",
          "營業毛利（毛損）淨額": "1,000,000",
          "營業利益（損失）": "800,000",
          "稅前淨利（淨損）": "850,000",
          "本期淨利（淨損）": "700,000",
          "基本每股盈餘（元）": "8.50",
        },
      ],
    ],
    tpexIncomeResults: [
      [{ SecuritiesCompanyCode: "6488", Year: "115", Season: "1", "每股盈餘": "3.20" }],
    ],
    monthlyHistory: { 2330: { 11504: 1000000 } },
    epsHistory: { 2330: { 1151: 8.5 } },
  };
}

test("assembleSnapshot maps raw datasets into sorted rows and meta", async () => {
  const { assembleSnapshot } = await import("../lib/build-snapshot.js");

  const { meta, rows } = assembleSnapshot(fixtureInputs());

  // Meta counts feed the refresh regression guard, so they must be exact.
  assert.equal(meta.count, 2);
  assert.equal(meta.tw, 1);
  assert.equal(meta.otc, 1);
  assert.equal(meta.revPeriodROC, "11504");
  assert.equal(meta.valDateROC, "1150605");
  assert.deepEqual(meta.incQuarter, ["115", "1"]);
  assert.equal(meta.r12n, 1);
  assert.equal(meta.epsN, 1);
  assert.equal(meta.r12ym.at(-1), 11504);

  // Sorted by yoy descending.
  assert.equal(rows[0].code, "2330");
  assert.equal(rows[1].code, "6488");
});

test("assembleSnapshot derives TWSE fields, margins, and EPS", async () => {
  const { assembleSnapshot } = await import("../lib/build-snapshot.js");

  const tsmc = assembleSnapshot(fixtureInputs()).rows.find((row) => row.code === "2330");

  assert.equal(tsmc.mkt, "上市");
  assert.equal(tsmc.yoy, 35);
  assert.equal(tsmc.ytdYoy, 25);
  assert.equal(tsmc.pe, 18.5);
  assert.equal(tsmc.price, 900);
  assert.equal(tsmc.eps, 8.5);
  assert.equal(tsmc.gm, 55.56); // 1,000,000 / 1,800,000
  assert.equal(tsmc.opm, 44.44); // 800,000 / 1,800,000
  assert.equal(tsmc.fin.rev, 18); // yi(1,800,000)
  assert.equal(tsmc.r12.at(-1), 10); // yi(1,000,000)
  assert.equal(tsmc.epsS.at(-1), 8.5);
});

test("assembleSnapshot reads TPEX-specific keys", async () => {
  const { assembleSnapshot } = await import("../lib/build-snapshot.js");

  const gws = assembleSnapshot(fixtureInputs()).rows.find((row) => row.code === "6488");

  assert.equal(gws.mkt, "上櫃");
  assert.equal(gws.pe, 22); // PriceEarningRatio
  assert.equal(gws.pb, 3); // PriceBookRatio
  assert.equal(gws.yield, 1.5); // YieldRatio
  assert.equal(gws.price, 500); // Close
  assert.equal(gws.chg, -2);
  assert.equal(gws.eps, 3.2); // 每股盈餘
});

test("assembleSnapshot preserves TPEX event-only change text when a close price exists", async () => {
  const { assembleSnapshot } = await import("../lib/build-snapshot.js");

  const inputs = fixtureInputs();
  inputs.tpexPrice = [{ SecuritiesCompanyCode: "6488", Close: "500", Change: "除息 " }];

  const gws = assembleSnapshot(inputs).rows.find((row) => row.code === "6488");

  assert.equal(gws.price, 500);
  assert.equal(gws.chg, null);
  assert.equal(gws.chgText, "除息");
});

test("assembleSnapshot uses the latest available valuation or price date across markets", async () => {
  const { assembleSnapshot } = await import("../lib/build-snapshot.js");

  const inputs = fixtureInputs();
  inputs.tpexValuation[0].Date = "1150609";
  inputs.tpexPrice[0].Date = "1150609";

  const { meta } = assembleSnapshot(inputs);

  assert.equal(meta.valDateROC, "1150609");
});

test("parseTwseMiIndexPriceRows normalizes listed close prices from the daily market report", async () => {
  const { parseTwseMiIndexPriceRows } = await import("../lib/build-snapshot.js");

  const payload = {
    stat: "OK",
    date: "20260609",
    tables: [
      {
        fields: [
          "證券代號",
          "證券名稱",
          "成交股數",
          "成交筆數",
          "成交金額",
          "開盤價",
          "最高價",
          "最低價",
          "收盤價",
          "漲跌(+/-)",
          "漲跌價差",
        ],
        data: [
          ["6209", "今國光", "22,080,043", "12,983", "1,905,614,984", "80.50", "88.00", "80.50", "88.00", "+", "8.00"],
          ["2330", "台積電", "10,000", "100", "9,500,000", "950.00", "955.00", "948.00", "950.00", "-", "5.00"],
        ],
      },
    ],
  };

  const rows = parseTwseMiIndexPriceRows(payload);

  assert.deepEqual(rows, [
    { Date: "1150609", Code: "6209", Name: "今國光", ClosingPrice: "88.00", Change: "8.00" },
    { Date: "1150609", Code: "2330", Name: "台積電", ClosingPrice: "950.00", Change: "-5.00" },
  ]);
});

test("buildTwseMiIndexUrl pins the listed market report to a specific calendar day", async () => {
  const { buildTwseMiIndexUrl } = await import("../lib/build-snapshot.js");

  assert.equal(
    buildTwseMiIndexUrl("20260609"),
    "https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?response=json&type=ALLBUT0999&date=20260609",
  );
});

test("assembleSnapshot tolerates missing optional datasets", async () => {
  const { assembleSnapshot } = await import("../lib/build-snapshot.js");

  const { meta, rows } = assembleSnapshot({
    twseRevenue: [
      {
        "公司代號": "2330",
        "公司名稱": "台積電",
        "產業別": "半導體業",
        "資料年月": "11504",
        "營業收入-當月營收": "1,000,000",
        "營業收入-去年同月增減(%)": "35",
      },
    ],
  });

  assert.equal(meta.count, 1);
  assert.equal(rows[0].pe, null);
  assert.equal(rows[0].r12, null);
  assert.equal(meta.r12n, 0);
  assert.equal(meta.epsN, 0);
});
