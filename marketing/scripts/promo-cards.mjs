// Renders marketing/social/promo-cards.html into three 1600x900 PNGs.
import puppeteer from 'puppeteer';
import path from 'path';

import { fileURLToPath } from "url";
// Resolve paths relative to this script rather than the shell cwd. The old
// hardcoded C:/Users/justi/... path broke the moment anyone ran it on a Mac.
const HERE = path.dirname(fileURLToPath(import.meta.url)).split(path.sep).join("/");
const SOCIAL = path.posix.join(HERE, "..", "social");
const DIR = SOCIAL;

const launch = async () => {
  const opts = { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  try { return await puppeteer.launch({ ...opts, channel: 'chrome' }); }
  catch { return await puppeteer.launch(opts); }
};

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1.5 });
  await page.goto('file:///' + path.posix.join(DIR, 'promo-cards.html'), { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500)); // fonts + images

  for (const id of ['card1', 'card2', 'card3']) {
    const el = await page.$('#' + id);
    await el.screenshot({ path: path.posix.join(DIR, `promo-${id}.png`) });
    console.log('✓', id);
  }
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
