'use strict';

// Local visual QA only. Point CODEX_PLAYWRIGHT_PATH to a Playwright installation.
const { chromium } = require(process.env.CODEX_PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const out = path.join(__dirname, '..', '_qa');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const checks = [];
  async function check(page, name, condition) {
    checks.push({ name, pass: Boolean(await condition()) });
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.RAINROUTE_QA_URL || 'http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    await page.locator('.branch-option').first().waitFor();
    await check(page, 'desktop default result', async () => (await page.locator('#branch-count').innerText()).includes('12 条可行'));
    await check(page, 'desktop no horizontal overflow', () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'ui-desktop-rain.png'), fullPage: true });
    await page.locator('[data-preset=late]').click();
    await page.waitForFunction(() => document.querySelector('#branch-count')?.textContent.includes('13 条可行'));
    await check(page, 'late and closure result', async () => (await page.locator('#branch-count').innerText()).includes('13 条可行'));
    await page.screenshot({ path: path.join(out, 'ui-desktop-late.png'), fullPage: true });
    await page.locator('[data-preset=budget]').click();
    await page.locator('.no-solution').waitFor();
    await check(page, 'no solution has no new route', async () => (await page.locator('.route-current').count()) === 0 && await page.locator('.adopt').first().isDisabled());
    await page.screenshot({ path: path.join(out, 'ui-desktop-no-solution.png'), fullPage: true });
    await page.locator('[data-preset=fault]').click();
    await page.locator('.fault-panel').waitFor();
    await check(page, 'fault has no new route', async () => (await page.locator('.route-current').count()) === 0 && await page.locator('.adopt').first().isDisabled());
    await page.screenshot({ path: path.join(out, 'ui-desktop-fault.png'), fullPage: true });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('[data-preset=rain]').click();
      await page.locator('.branch-option').first().waitFor();
      await check(page, `${width}px no horizontal overflow`, () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await check(page, `${width}px branch visible`, () => page.locator('.branch-option').first().isVisible());
      await page.screenshot({ path: path.join(out, `ui-mobile-${width}.png`), fullPage: true });
    }
    await page.close();
  } finally { await browser.close(); }
  const report = { checks, errors };
  fs.writeFileSync(path.join(out, 'ui-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (errors.length || checks.some(item => !item.pass)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
