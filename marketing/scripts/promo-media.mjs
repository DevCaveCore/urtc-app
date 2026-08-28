/**
 * Renders the ÜrTC social media kit:
 *   1. Promo cards  -> marketing/social/cards/*.png   (from cards.html)
 *   2. Collage video -> marketing/social/video/*.webm (animated collage)
 *   3. App clips     -> marketing/social/video/*.webm (real screen recordings)
 *
 * Video capture uses Puppeteer's page.screencast(), which shells out to
 * ffmpeg. Run `node promo-media.mjs` with the dev server up on :5173.
 */
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { fileURLToPath } from "url";
// Resolve paths relative to this script rather than the shell cwd. The old
// hardcoded C:/Users/justi/... path broke the moment anyone ran it on a Mac.
const HERE = path.dirname(fileURLToPath(import.meta.url)).split(path.sep).join("/");
const SOCIAL = path.posix.join(HERE, "..", "social");
const ROOT = SOCIAL;
const CARDS = path.posix.join(ROOT, 'cards');
const VIDEO = path.posix.join(ROOT, 'video');
fs.mkdirSync(CARDS, { recursive: true });
fs.mkdirSync(VIDEO, { recursive: true });

const APP = 'http://localhost:5173';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const launch = async (extra = {}) => {
  const opts = { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'], ...extra };
  try { return await puppeteer.launch({ ...opts, channel: 'chrome' }); }
  catch { return await puppeteer.launch(opts); }
};

/** Skip the splash/terms gates so recordings start on real content. */
const primeApp = async (page) => {
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('urtc_terms_accepted', 'true');
    localStorage.setItem('urtc_diamond_tutorial_seen', 'true');
    localStorage.setItem('urtc_theme', 'dark');
  });
};

const clickText = (page, text) => page.evaluate((t) => {
  const el = [...document.querySelectorAll('button')].find(b => b.offsetParent && (b.textContent || '').includes(t));
  if (el) { el.click(); return true; }
  return false;
}, text);

/**
 * Timed frame capture. page.screencast() only emits on repaint and compresses
 * its timeline when the UI idles, which produced 1-second "videos" from
 * 14 seconds of recording. Grabbing screenshots on a clock gives an exact
 * duration, and we measure the real rate achieved so playback speed is true.
 */
async function captureFrames(page, { durationMs, dir, act }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  let stop = false;
  const t0 = Date.now();
  const driver = act ? act().finally(() => { stop = true; }) : sleep(durationMs).then(() => { stop = true; });
  while (!stop && Date.now() - t0 < durationMs) {
    await page.screenshot({ path: path.posix.join(dir, String(n++).padStart(4, '0') + '.png'), optimizeForSpeed: true });
  }
  await driver;
  const elapsed = (Date.now() - t0) / 1000;
  const fps = Math.max(1, n / elapsed);
  console.log(`    ${n} frames / ${elapsed.toFixed(1)}s = ${fps.toFixed(1)} fps`);
  return { frames: n, fps };
}

/** Assemble a frame directory into a platform-ready MP4. */
function encode(dir, out, fps, vf) {
  const { execSync } = require('child_process');
  const cmd = `ffmpeg -y -loglevel error -framerate ${fps.toFixed(3)} -i "${dir}/%04d.png" -vf "${vf}" -c:v libx264 -pix_fmt yuv420p -preset slow -crf 21 -movflags +faststart -r 30 "${out}"`;
  execSync(cmd, { stdio: ['ignore', 'ignore', 'pipe'] });
  return out;
}

// ─────────────────────────── 1. CARDS ───────────────────────────
async function renderCards() {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1400, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.posix.join(ROOT, 'cards.html'), { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(2500); // webfonts

  const ids = await page.evaluate(() => [...document.querySelectorAll('.card')].map(c => c.id));
  for (const id of ids) {
    const el = await page.$('#' + id);
    await el.screenshot({ path: path.posix.join(CARDS, `card-${id}.png`) });
    console.log('  card', id);
  }
  await browser.close();
  return ids.length;
}

// ────────────────── 2. COLLAGE VIDEO (animated) ──────────────────
async function renderCollageVideo() {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.posix.join(ROOT, 'collage.html'), { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(1800);

  const out = path.posix.join(VIDEO, 'collage-square.webm');
  const rec = await page.screencast({ path: out, fps: 30 });
  await page.evaluate(() => window.__start && window.__start());
  await sleep(14000);
  await rec.stop();
  await browser.close();
  console.log('  collage-square.webm');
  return out;
}

// ─────────────── 3. REAL APP CLIPS (screen recordings) ───────────────
async function renderAppClips() {
  const browser = await launch();
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(APP, ['geolocation']);
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.setGeolocation({ latitude: 33.7490, longitude: -84.3880 }); // Atlanta
  await primeApp(page);

  await page.goto(APP, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);

  // screencast() only emits a frame when pixels change, so every clip below
  // keeps the UI moving for its whole duration. A page sitting still yields a
  // one-second video no matter how long you sleep.
  const scroll = async (px, steps = 18, gap = 55) => {
    for (let i = 0; i < steps; i++) {
      await page.evaluate((d) => window.scrollBy(0, d), px / steps);
      await sleep(gap);
    }
  };

  const clips = [];
  // Stage frames in the system temp dir: iCloud Drive locks folders mid-write
  // and rmSync fails with EPERM on the second pass.
  const TMP = path.posix.join(os.tmpdir().split(path.sep).join('/'), 'urtc-frames');
  // 1080x1920 story format: fit the phone by height, pad the sides in brand ink
  const STORY = 'scale=-2:1920,pad=1080:1920:(1080-iw)/2:0:color=0x08090C';

  // CLIP A — search, 3D globe fly-in, then tour the flight card
  await page.click('#tab-flights').catch(() => {});
  await sleep(1200);
  console.log('  clip-flight-3d');
  let r = await captureFrames(page, {
    durationMs: 15000, dir: TMP,
    act: async () => {
      await clickText(page, 'DAL1182');
      await sleep(9000);               // search + cinematic fly-in
      await scroll(700);               // down through the flight card
      await sleep(600);
      await clickText(page, '2D Map'); // flip to satellite
      await sleep(2400);
      await scroll(-500, 12);
    },
  });
  clips.push(encode(TMP, path.posix.join(VIDEO, 'clip-flight-3d.mp4'), r.fps, STORY));

  // CLIP B — open a place, scroll its photos, reviews and Apollo's take
  await page.click('#tab-explore').catch(() => {});
  await sleep(9000);
  console.log('  clip-place-sheet');
  r = await captureFrames(page, {
    durationMs: 13000, dir: TMP,
    act: async () => {
      await page.evaluate(() => {
        const c = [...document.querySelectorAll('div')].filter(d => typeof d.className === 'string' && d.className.includes('press-card') && d.offsetParent);
        if (c[0]) c[0].click();
      });
      await sleep(4200);               // sheet springs up, Apollo's take resolves
      for (let i = 0; i < 40; i++) {   // scroll INSIDE the sheet, not the page
        await page.evaluate(() => {
          const sc = [...document.querySelectorAll('div')].find(d => d.scrollHeight > d.clientHeight + 40 && String(d.className).includes('overflow-y-auto'));
          if (sc) sc.scrollTop += 26;
        });
        await sleep(120);
      }
      await sleep(1200);
    },
  });
  clips.push(encode(TMP, path.posix.join(VIDEO, 'clip-place-sheet.mp4'), r.fps, STORY));

  // CLIP C — the Wander teaser: collage lands, the post types itself
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('urtc-navigate', { detail: { tab: 'today' } })));
  await sleep(1500);
  console.log('  clip-wander');
  r = await captureFrames(page, {
    durationMs: 15000, dir: TMP,
    act: async () => {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && /Wander/.test(x.textContent || ''));
        if (b) b.click();
      });
      await sleep(9500);               // caption types, photos attach, counts tick
      await scroll(900, 22, 90);       // down to the "Are you in?" close
      await sleep(1500);
    },
  });
  clips.push(encode(TMP, path.posix.join(VIDEO, 'clip-wander.mp4'), r.fps, STORY));

  fs.rmSync(TMP, { recursive: true, force: true });
  await browser.close();
  return clips;
}

(async () => {
  const only = process.argv[2];
  if (!only || only === 'cards') { console.log('Cards:'); await renderCards(); }
  if (!only || only === 'collage') { console.log('Collage video:'); await renderCollageVideo(); }
  if (!only || only === 'clips') { console.log('App clips:'); await renderAppClips(); }
  console.log('\nDone ->', ROOT);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
