// Captures clean phone-frame screenshots of ÜrTC for social promo cards.
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
  await page.setGeolocation({ latitude: 34.0522, longitude: -118.2437 }); // LA

  // Skip splash gates: accept terms, mark tutorials seen, keep dark theme
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('urtc_terms_accepted', 'true');
    localStorage.setItem('urtc_diamond_tutorial_seen', 'true');
    localStorage.setItem('urtc_theme', 'dark');
  });

  console.log('Loading app…');
  await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 45000 });
  await sleep(7000); // splash + data

  // Dismiss the location chip if it still rendered before geolocation kicked in
  const clickByText = async (text) => page.evaluate((t) => {
    const els = [...document.querySelectorAll('button')];
    const el = els.find(b => (b.textContent || '').trim().includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);

  // 1. Today
  await page.screenshot({ path: path.join(OUT, 'shot-today.png') });
  console.log('✓ today');

  // 2. Flights → live tracking of DAL1182
  await page.click('#tab-flights').catch(() => {});
  await sleep(1200);
  await clickByText('DAL1182');
  await sleep(9000); // search + 3D globe fly-in
  await page.screenshot({ path: path.join(OUT, 'shot-flight.png') });
  console.log('✓ flight');

  // 3. Book Travel mode with a prefilled search
  await page.evaluate(() => {
    localStorage.setItem('urtc_booking_prefill', JSON.stringify({
      origin: 'ATL', destination: 'LAX', departureDate: '2026-08-28',
      returnDate: '2026-08-31', passengers: 1, cabin: 'economy', budget: 1000,
    }));
  });
  await clickByText('Book Travel');
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 'shot-book.png') });
  console.log('✓ book');

  // 4. Apollo sheet
  await page.click('#tab-apollo').catch(() => {});
  await sleep(2500);
  await page.screenshot({ path: path.join(OUT, 'shot-apollo.png') });
  console.log('✓ apollo');

  await browser.close();
  console.log('All shots saved to', OUT);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
