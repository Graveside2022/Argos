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
        
        await page.goto('http://127.0.0.1:5173/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const baseDir = '/home/kali/.gemini/antigravity/brain/9a8f5c9f-3e7b-4aa5-968e-68990f69d9a1';
        
        // 1. Full Dashboard
        await page.screenshot({ path: `${baseDir}/audit_live_full.png` });
        
        // 2. Icon Rail (x:0, y:0, w:48, h:900)
        await page.screenshot({ 
            path: `${baseDir}/audit_live_icon_rail.png`,
            clip: { x: 0, y: 0, width: 48, height: 900 }
        });
        
        // 3. Command Bar (x:48, y:0, w:1392, h:40)
        await page.screenshot({ 
            path: `${baseDir}/audit_live_command_bar.png`,
            clip: { x: 48, y: 0, width: 1392, height: 40 }
        });
        
        // 4. Overview Panel (x:48, y:40, w:280, h:860)
        await page.screenshot({ 
            path: `${baseDir}/audit_live_overview.png`,
            clip: { x: 48, y: 40, width: 280, height: 860 }
        });
        
        // 5. Map Area Container (x:328, y:40, w:1112, h:620)
        await page.screenshot({ 
            path: `${baseDir}/audit_live_map.png`,
            clip: { x: 328, y: 40, width: 1112, height: 620 }
        });
        
        // 6. Bottom Panel Area (x:48, y:600, w:1392, h:300)
        await page.screenshot({ 
            path: `${baseDir}/audit_live_bottom.png`,
            clip: { x: 48, y: 600, width: 1392, height: 300 }
        });

        console.log('Detailed snapshots captured.');
        await browser.close();
    } catch (e) {
        console.error('Error capturing screenshots:', e);
        process.exit(1);
    }
})();
