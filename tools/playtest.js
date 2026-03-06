const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function run() {
  const outDir = path.join(process.cwd(), 'artifacts', 'playtest');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const steps = [];
  const ops = {
    reroll: false,
    buyXp: false,
    sell: false,
    feedbackSubmit: false,
    startBattle: false,
    continueRound: false,
  };

  const snap = async (name) => {
    const file = path.join(outDir, `${String(steps.length + 1).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    steps.push({ name, file });
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const dismissBlockingModals = async () => {
    if (await page.locator('#guide-modal').isVisible().catch(() => false)) {
      await page.click('#btn-guide-close');
      await wait(150);
    }
    if (await page.locator('#achievement-modal').isVisible().catch(() => false)) {
      await page.click('#btn-achievement-close');
      await wait(150);
    }
    if (await page.locator('#feedback-modal').isVisible().catch(() => false)) {
      await page.click('#btn-feedback-close');
      await wait(150);
    }
  };
  const clickIfEnabled = async (selector) => {
    const btn = page.locator(selector);
    const disabled = await btn.isDisabled().catch(() => true);
    if (!disabled) {
      await btn.click();
      await wait(200);
      return true;
    }
    return false;
  };

  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#start-screen', { timeout: 15000 });
  await snap('start-screen');

  await page.click('#btn-start');
  await page.waitForFunction(() => {
    const el = document.querySelector('#start-screen');
    return !!el && el.classList.contains('hidden');
  }, { timeout: 10000 });
  await dismissBlockingModals();
  await page.waitForSelector('#shop-units .shop-card');
  await snap('entered-game');

  const buyThree = async () => {
    await dismissBlockingModals();
    for (let i = 0; i < 3; i++) {
      const cards = await page.$$('#shop-units .shop-card');
      if (!cards[i]) break;
      await cards[i].click();
      await wait(120);
    }
  };
  await buyThree();
  await snap('bought-units');

  const placeFromBench = async (benchIdx, row, col) => {
    const bench = page.locator(`#bench-grid .bench-cell[data-col="${benchIdx}"]`);
    const board = page.locator(`#player-board .board-cell[data-row="${row}"][data-col="${col}"]`);
    await bench.click();
    await board.click();
    await wait(120);
  };

  await placeFromBench(0, 3, 2);
  await placeFromBench(1, 3, 3);
  await placeFromBench(2, 3, 4);
  await snap('placed-units');

  ops.reroll = await clickIfEnabled('#btn-reroll');
  ops.buyXp = await clickIfEnabled('#btn-buy-xp');

  await page.locator('#player-board .board-cell[data-row="3"][data-col="4"]').click();
  const sold = await clickIfEnabled('#btn-sell');
  ops.sell = sold;
  await snap('reroll-xp-sell');

  await page.click('#btn-achievements');
  await page.waitForSelector('#achievement-modal:not(.hidden)');
  await snap('achievement-modal');
  await page.click('#btn-achievement-close');

  await page.click('#btn-guide');
  await page.waitForSelector('#guide-modal:not(.hidden)');
  await snap('guide-modal');
  await page.click('#btn-guide-close');

  await page.click('#btn-feedback');
  await page.waitForSelector('#feedback-modal:not(.hidden)');
  await page.fill('#feedback-name', 'auto-playtest');
  await page.fill('#feedback-contact', 'local');
  await page.fill('#feedback-content', '自动试玩建议提交测试：流程可达，建议继续优化中后期节奏。');
  await page.click('#btn-feedback-submit');
  await wait(600);
  ops.feedbackSubmit = true;
  await snap('feedback-submitted');
  await page.click('#btn-feedback-close');

  await page.click('#btn-ready');
  ops.startBattle = true;
  await page.waitForSelector('#battle-result:not(.hidden)', { timeout: 60000 });
  await snap('battle-result');
  await page.click('#btn-continue');
  ops.continueRound = true;
  await wait(350);

  const roundText = await page.locator('#round-num').innerText();
  await snap('post-continue');

  if (!ops.reroll || !ops.buyXp) {
    ops.reroll = ops.reroll || await clickIfEnabled('#btn-reroll');
    ops.buyXp = ops.buyXp || await clickIfEnabled('#btn-buy-xp');
    await snap('post-continue-economy-actions');
  }

  await browser.close();

  const report = {
    ok: true,
    roundText,
    ops,
    steps,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
