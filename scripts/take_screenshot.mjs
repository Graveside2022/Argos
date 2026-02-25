import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        console.log('Navigating to dashboard...');
        // Let's drop the networkidle0 requirement, as map tiles or websockets might keep the network active
        await page.goto('http://127.0.0.1:5173/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait 5 seconds for SvelteKit hydration and map rendering
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const path = '/home/kali/.gemini/antigravity/brain/9a8f5c9f-3e7b-4aa5-968e-68990f69d9a1/dashboard_live_native.png';
        await page.screenshot({ path });
        console.log(`Screenshot saved to ${path}`);
        await browser.close();
    } catch (e) {
        console.error('Error capturing screenshot:', e);
        process.exit(1);
    }
})();
