
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5174';
const OUTPUT_DIR = 'CCD UrTC Interactive Demo';

const VIEWPORTS = {
    ios: { width: 393, height: 852, isMobile: true, name: 'iOS (iPhone 14 Pro)' },
    android: { width: 412, height: 915, isMobile: true, name: 'Android (Pixel 7)' },
    web: { width: 1920, height: 1080, isMobile: false, name: 'Web (Desktop)' }
};

const ROUTES = [
    { path: '/', name: '01_Home' },
    { path: '/', name: '02_Home_Scrolled', action: async (page) => page.evaluate(() => window.scrollBy(0, 500)) },
    {
        path: '/', name: '03_App_Menu', action: async (page) => {
            // Try to verify menu elements exist or simulate a state
        }
    },
    {
        path: '/', name: '04_Flights_Tab', setup: async (page) => {
            // Click Flights Tab (2nd button in nav)
            const buttons = await page.$$('button');
            if (buttons[1]) await buttons[1].click();
            await new Promise(r => setTimeout(r, 1000));
        }
    },
    {
        path: '/', name: '05_Flights_Ad', setup: async (page) => {
            const buttons = await page.$$('button');
            if (buttons[1]) await buttons[1].click();
            await new Promise(r => setTimeout(r, 1000));
        }, action: async (page) => page.evaluate(() => window.scrollBy(0, 600))
    },

    {
        path: '/', name: '06_City_Tab', setup: async (page) => {
            const buttons = await page.$$('button');
            if (buttons[2]) await buttons[2].click();
            await new Promise(r => setTimeout(r, 1000));
        }
    },
    {
        path: '/', name: '07_City_Scrolled', setup: async (page) => {
            const buttons = await page.$$('button');
            if (buttons[2]) await buttons[2].click();
            await new Promise(r => setTimeout(r, 1000));
        }, action: async (page) => page.evaluate(() => window.scrollBy(0, 500))
    },

    {
        path: '/', name: '08_Apollo_Tab', setup: async (page) => {
            const buttons = await page.$$('button');
            if (buttons[3]) await buttons[3].click(); // Approximate index for Apollo center button
            await new Promise(r => setTimeout(r, 1000));
        }
    },

    {
        path: '/', name: '09_Itinerary_Tab', setup: async (page) => {
            const buttons = await page.$$('button');
            if (buttons[4]) await buttons[4].click();
            await new Promise(r => setTimeout(r, 1000));
        }
    },

    {
        path: '/', name: '10_About_Tab', setup: async (page) => {
            const buttons = await page.$$('button');
            if (buttons[5]) await buttons[5].click();
            await new Promise(r => setTimeout(r, 1000));
        }
    }
];

async function capture() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    }

    const browser = await puppeteer.launch({ headless: "new" });

    for (const [platform, viewport] of Object.entries(VIEWPORTS)) {
        console.log(`Capturing for ${platform}...`);
        const platformDir = path.join(OUTPUT_DIR, platform);
        if (!fs.existsSync(platformDir)) fs.mkdirSync(platformDir);

        const page = await browser.newPage();
        await page.setViewport(viewport);
        const context = browser.defaultBrowserContext();
        await context.overridePermissions(BASE_URL, ['geolocation']);
        await page.setGeolocation({ latitude: 33.7490, longitude: -84.3880 });

        // Force mock the geolocation API to bypass permission dialogues and errors
        await page.evaluateOnNewDocument(() => {
            navigator.geolocation.getCurrentPosition = (success) => {
                success({ coords: { latitude: 33.7490, longitude: -84.3880 } });
            };
        });

        // Go to Home first to load app
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });

        // Set local storage to unlock dev tier, bypass terms, and skip diamond tutorial
        await page.evaluate(() => {
            localStorage.setItem('urtc_active_user', JSON.stringify({
                id: 'code-screenshot',
                username: 'Hello User',
                passwordHash: 'access-code',
                tier: 'Diamond',
                savedTrips: []
            }));
            localStorage.setItem('urtc_terms_accepted', 'true');
            localStorage.setItem('urtc_diamond_tutorial_seen', 'true');
        });
        
        // Reload to apply local storage
        await page.reload({ waitUntil: 'networkidle0' });

        // Wait for splash screen to clear (it has a 4.5s timer in App.tsx)
        console.log('Waiting for splash screen...');
        await new Promise(r => setTimeout(r, 5000));

        for (const route of ROUTES) {
            console.log(`  Taking ${route.name}...`);

            // Reset to home or navigate? 
            // Since it's a SPA, we might just click through tabs to be safe/realistic
            // But for specific routes we might reload if needed. 
            // Our "setup" functions assume we are in the app.

            if (route.setup) {
                await route.setup(page);
            }

            if (route.action) {
                await route.action(page);
                await new Promise(r => setTimeout(r, 500)); // wait for scroll/anim
            }

            await page.screenshot({ path: path.join(platformDir, `${route.name}.png`) });
        }

        await page.close();
    }

    await browser.close();
    console.log('Done!');
}

capture().catch(console.error);
