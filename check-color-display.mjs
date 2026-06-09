import { readFrontendSource } from "./check-frontend-source.mjs";

const source = readFrontendSource();

function expect(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

expect(/export function signedFmt\(/, "missing signedFmt helper");
expect(/export function epsBarColor\(/, "missing epsBarColor helper");
expect(/signedFmt\(row\.gm,\s*1\)/, "main table gross margin is not sign-colored");
expect(/signedFmt\(row\.eps,\s*2\)/, "main table EPS is not sign-colored");
expect(/signedFmt\(displayQuarterEps\(row\),\s*2\)/, "drawer stats are not sign-colored");
expect(
  /epsBarColor\(value,\s*index >= values\.length - 4\)/,
  "EPS chart colors are not based on value sign",
);

console.log("Color display checks passed.");
