// Draws the home-screen PNGs from public/icon.svg: `pnpm --filter @too-too-soon/web icons`.
// Run it after changing the logo. Square and full-bleed, with the engine shrunk to 84% so it
// stays inside the circle Android crops a "maskable" icon to; iOS rounds the corners itself.
// Needs Playwright and its Chromium: not a dependency, because sessions and CI runners have it
// installed globally, and it's only needed when the logo changes.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pub = new URL("../public/", import.meta.url).pathname;
const pw = await import("playwright").catch(() => import(join(execSync("npm root -g").toString().trim(), "playwright/index.mjs")));
const svg = readFileSync(join(pub, "icon.svg"), "utf8").replace(/<rect width="512" height="512" rx="\d+"/, '<rect width="512" height="512"');
const browser = await pw.chromium.launch();
for (const size of [180, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const bg = svg.match(/fill="(#[0-9a-f]{6})"/i)[1];
  await page.setContent(`<body style="margin:0;background:${bg}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">${svg.replace("<svg ", `<svg width="${Math.round(size * 0.84)}" height="${Math.round(size * 0.84)}" `)}</div></body>`);
  await page.screenshot({ path: join(pub, `icon-${size}.png`), omitBackground: false });
  await page.close();
}
await browser.close();
console.log("icon-180.png and icon-512.png drawn");
