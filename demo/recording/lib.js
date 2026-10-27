const { chromium } = require('playwright');
const fs = require('fs');
const { Buffer } = require('buffer');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setup({ record, outDir }) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
  });
  await ctx.clock.install({ time: new Date('2026-10-27T18:40:00+05:30') });
  await ctx.clock.resume();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.goto('http://localhost:8081/stage.html');
  let frames = [];
  let cdp;
  if (record) {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    cdp = await ctx.newCDPSession(page);
    let n = 0;
    cdp.on('Page.screencastFrame', async (f) => {
      const file = `${outDir}/f${String(n++).padStart(6, '0')}.jpg`;
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      frames.push({ t: f.metadata.timestamp, file });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
  }
  const app = page.frameLocator('#app');
  const frame = () => page.frame({ url: /8081\/(?!stage)/ });
  let shot = 0;
  const d = {
    page,
    app,
    frames,
    sleep,
    async start() {
      if (cdp)
        await cdp.send('Page.startScreencast', {
          format: 'jpeg',
          quality: 90,
          maxWidth: 1920,
          maxHeight: 1080,
        });
    },
    async stop() {
      if (cdp) await cdp.send('Page.stopScreencast');
      await sleep(300);
      await browser.close();
      return frames;
    },
    async loadApp() {
      await page.evaluate(() => {
        document.getElementById('app').src = 'about:blank';
      });
      await sleep(200);
      await page.evaluate(() => {
        try {
          localStorage.clear();
        } catch {}
        document.getElementById('app').src = '/';
      });
      await sleep(2500);
    },
    caption: (t, s) => page.evaluate(([t, s]) => window.caption(t, s), [t, s]),
    role: (r) => page.evaluate((r) => window.setRole(r), r),
    card: (html) => page.evaluate((h) => window.card(h), html),
    text(t, exact = true) {
      return app.getByText(t, { exact }).filter({ visible: true }).first();
    },
    async tapOn(loc, wait = 1400) {
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const box = await loc.boundingBox();
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await page.evaluate(([x, y]) => window.tap(x, y), [x, y]);
      await sleep(250);
      await page.mouse.click(x, y);
      await sleep(wait);
    },
    async tap(t, wait, exact = true) {
      await d.tapOn(d.text(t, exact), wait);
    },
    async tab(name, wait = 1400) {
      await d.tapOn(app.getByRole('tab', { name: new RegExp(name) }).first(), wait);
    },
    async back(wait = 1200) {
      const b = app.getByRole('button', { name: /back/i }).filter({ visible: true }).first();
      if (await b.count()) await d.tapOn(b, wait);
      else {
        await frame().evaluate(() => history.back());
        await sleep(wait);
      }
    },
    async scroll(dy, steps = 25, pause = 1000) {
      await page.mouse.move(1350, 600);
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, dy / steps);
        await sleep(28);
      }
      await sleep(pause);
    },
    async snap(name) {
      await page.screenshot({
        path: `${outDir}-snap-${String(shot++).padStart(2, '0')}-${name}.png`,
      });
    },
  };
  return d;
}
module.exports = { setup, sleep };
