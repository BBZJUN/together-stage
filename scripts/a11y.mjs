/** 접근성 자동 점검 (axe-core, WCAG 2.1 AA) — 주요 화면을 열어 위반이 있으면 실패 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PAGES = ["/", "/route", "/seats", "/card", "/check", "/open-data", "/insight", "/chat", "/data"];

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  localStorage.setItem("together-needs", '["wheelchair"]');
  localStorage.setItem("together-tour", "done");
});
const page = await ctx.newPage();
let total = 0;
for (const p of PAGES) {
  await page.goto(BASE + p, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(() =>
     
    axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }).then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length }))),
  );
  total += v.length;
  console.log(`${p}: ${v.length ? v.map((x) => `${x.impact} ${x.id}×${x.n}`).join(", ") : "위반 없음"}`);
}
await browser.close();
if (total) {
  console.error(`접근성 위반 ${total}종`);
  process.exit(1);
}
