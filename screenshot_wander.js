import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));
  
  // click Wander tab
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.toLowerCase().includes('wander')) {
      await btn.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/Users/justin.../.gemini/antigravity/brain/3333c1fe-eb2a-42f2-9239-b5cc69ae91c3/screenshots/ios/Wander_Tab.png' });
  await browser.close();
  console.log("Done");
})();
