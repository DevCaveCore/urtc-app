import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 }); // iPhone size
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: '/Users/justin.../.gemini/antigravity/brain/d3960c60-04d8-4155-a67c-bf2a00963ea9/screenshot.png' });
  await browser.close();
  console.log("Screenshot saved!");
})();
