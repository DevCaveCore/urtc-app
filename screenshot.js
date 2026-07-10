import puppeteer from 'puppeteer';

(async () => {
  console.log("Launching browser...");
  try {
    const browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    console.log("Browser launched.");
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    console.log("Navigating to localhost:5173...");
    await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });
    console.log("Navigation complete. Waiting 5s for splash screen...");
    await new Promise(r => setTimeout(r, 5000));
    console.log("Taking screenshot...");
    await page.screenshot({ path: '/Users/justin.../.gemini/antigravity/brain/3333c1fe-eb2a-42f2-9239-b5cc69ae91c3/localhost_screenshot.png' });
    console.log("Screenshot saved!");
    await browser.close();
  } catch(e) {
    console.error("Error:", e);
    process.exit(1);
  }
})();
