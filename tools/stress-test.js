const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RUNS = Number(process.env.STRESS_RUNS || 20);

function nowTs() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isVisible(page, selector) {
  return page.locator(selector).isVisible().catch(() => false);
}

async function closeOverlays(page) {
  const pairs = [
    ['#guide-modal', '#btn-guide-close'],
    ['#achievement-modal', '#btn-achievement-close'],
    ['#feedback-modal', '#btn-feedback-close'],
  ];
  for (const [modal, close] of pairs) {
    if (await isVisible(page, modal)) {
      await page.click(close).catch(() => {});
      await wait(120);
    }
  }
}

async function clickIfEnabled(page, selector) {
  const el = page.locator(selector);
  const enabled = await el.isEnabled().catch(() => false);
  if (!enabled) return false;
  await el.click();
  await wait(100);
  return true;
}

async function buyAndPlaceUnits(page) {
  await closeOverlays(page);
  for (let i = 0; i < 4; i++) {
    const card = page.locator('#shop-units .shop-card:not(.sold)').first();
    const exists = await card.count();
    if (!exists) break;
    const disabled = await page.locator('#btn-ready').isDisabled().catch(() => false);
    await card.click().catch(() => {});
    await wait(80);
    if (!disabled) break;
  }

  let placed = 0;
  for (let i = 0; i < 8; i++) {
    const benchCell = page.locator(`#bench-grid .bench-cell[data-col="${i}"]`);
    const hasUnit = await benchCell.locator('.unit').count();
    if (!hasUnit) continue;

    const targetCol = 1 + (placed % 6);
    const targetRow = 3 - Math.floor(placed / 3);
    const boardCell = page.locator(`#player-board .board-cell[data-row="${Math.max(0, targetRow)}"][data-col="${targetCol}"]`);
    await benchCell.click().catch(() => {});
    await boardCell.click().catch(() => {});
    await wait(80);
    placed++;
    if (placed >= 4) break;
  }
}

async function runOne(page, runIndex, failureDir) {
  const errors = [];
  const logs = [];
  const onPageError = (err) => errors.push(`pageerror: ${err.message || String(err)}`);
  const onConsole = (msg) => {
    if (msg.type() === 'error') logs.push(`console.error: ${msg.text()}`);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  let battleTitle = '';
  let playerWon = false;
  try {
    await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#start-screen', { timeout: 10000 });
    await page.click('#btn-start');
    await page.waitForFunction(() => document.querySelector('#start-screen')?.classList.contains('hidden'), { timeout: 10000 });
    await page.waitForSelector('#shop-units .shop-card', { timeout: 15000 });
    await wait(700);
    await closeOverlays(page);
    await clickIfEnabled(page, '#btn-speed');
    await clickIfEnabled(page, '#btn-speed');
    await buyAndPlaceUnits(page);
    const unitsBeforeBattle = await page.locator('#player-board .board-cell .unit').count().catch(() => 0);
    await clickIfEnabled(page, '#btn-ready');
    await closeOverlays(page);
    await page.waitForSelector('#battle-result:not(.hidden)', { timeout: 130000 });
    battleTitle = (await page.locator('#result-title').innerText().catch(() => '')).trim();
    playerWon = battleTitle.includes('胜利');
    const finalRound = Number((await page.locator('#round-num').innerText().catch(() => '0')).trim()) || 0;
    const hasBought = unitsBeforeBattle > 0;
    const hasStartedBattle = await isVisible(page, '#battle-result:not(.hidden)');
    const passed = hasBought && hasStartedBattle;
    if (!passed) {
      const shot = path.join(failureDir, `run-${runIndex}-invalid-flow.png`);
      await page.screenshot({ path: shot, fullPage: true });
      errors.push('did not complete buy/place/battle flow');
    }
    if (!playerWon) {
      const shot = path.join(failureDir, `run-${runIndex}-lost.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    }

    if (errors.length || logs.length) {
      const shot = path.join(failureDir, `run-${runIndex}-error.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    }

    return { run: runIndex, passed, finalRound, playerWon, battleTitle, errors, logs };
  } catch (err) {
    errors.push(`exception: ${err && err.message ? err.message : String(err)}`);
    const shot = path.join(failureDir, `run-${runIndex}-exception.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    return { run: runIndex, passed: false, finalRound: 0, playerWon: false, battleTitle, errors, logs };
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
}

async function main() {
  const stamp = nowTs();
  const outDir = path.join(process.cwd(), 'artifacts', 'stress', stamp);
  const failureDir = path.join(outDir, 'failures');
  fs.mkdirSync(failureDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const results = [];
  for (let i = 1; i <= RUNS; i++) {
    const r = await runOne(page, i, failureDir);
    results.push(r);
    console.log(`[stress] run ${i}/${RUNS} passed=${r.passed} won=${r.playerWon} title=${r.battleTitle} errors=${r.errors.length} console=${r.logs.length}`);
  }

  await browser.close();

  const summary = {
    stamp,
    runs: RUNS,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    totalWins: results.filter((r) => r.playerWon).length,
    pageErrors: results.reduce((n, r) => n + r.errors.length, 0),
    consoleErrors: results.reduce((n, r) => n + r.logs.length, 0),
    results,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify(summary));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
