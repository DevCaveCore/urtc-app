import puppeteer from 'puppeteer';
import fs from 'fs';

const ARTIFACT_DIR = '/Users/justin.../.gemini/antigravity/brain/d3960c60-04d8-4155-a67c-bf2a00963ea9';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 }); // iPhone size
  
  console.log("Navigating to app...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  // Wait a bit for everything to render
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Taking screenshot of default tab...");
  await page.screenshot({ path: `${ARTIFACT_DIR}/screenshot_home.png` });

  // Click the Wander Tab (assuming it's the 3rd or 4th button in the bottom nav)
  // We can evaluate and click based on text
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const wanderBtn = buttons.find(b => b.textContent && b.textContent.includes('Wander'));
    if (wanderBtn) wanderBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Taking screenshot of Wander Tab...");
  await page.screenshot({ path: `${ARTIFACT_DIR}/screenshot_wander.png` });

  // Click the About Tab
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const aboutBtn = buttons.find(b => b.textContent && b.textContent.includes('About'));
    if (aboutBtn) aboutBtn.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  // Click Settings Tab in About View
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const settingsBtn = buttons.find(b => b.textContent && b.textContent.includes('Settings'));
    if (settingsBtn) settingsBtn.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  console.log("Taking screenshot of Profile Settings...");
  await page.screenshot({ path: `${ARTIFACT_DIR}/screenshot_profile.png` });

  await browser.close();
  console.log("Done taking screenshots.");
})();
