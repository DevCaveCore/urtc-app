// Second pass: flight card close-up + Apollo sheet.
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const OUT = 'C:/Users/justi/iCloudDrive/Desktop/urtc-app/marketing/social';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const launch = async () => {
  const opts = { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  try { return await puppeteer.launch({ ...opts, channel: 'chrome' }); }
  catch { return await puppeteer.launch(opts); }
};

(async () => {
  const browser = await launch();
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:5173', ['geolocation']);
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.setGeolocation({ latitude: 34.0522, longitude: -118.2437 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('urtc_terms_accepted', 'true');
    localStorage.setItem('urtc_diamond_tutorial_seen', 'true');
    localStorage.setItem('urtc_theme', 'dark');
  });

  await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 45000 });
  await sleep(7000);

  const clickByText = async (text) => page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim().includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);

  await page.click('#tab-flights').catch(() => {});
  await sleep(1200);
  await clickByText('DAL1182');
  await sleep(10000);

  // Bring the selected flight card (map + emblem row) fully into frame
  await page.evaluate(() => {
    const results = [...document.querySelectorAll('h3')].find(h => h.textContent === 'Results');
    if (results) results.scrollIntoView({ block: 'start' });
    window.scrollBy(0, 40);
  });
  await sleep(2500);
  await page.screenshot({ path: path.join(OUT, 'shot-flight-card.png') });
  console.log('✓ flight card');

  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
