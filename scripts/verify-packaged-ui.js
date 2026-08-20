const cp = require('child_process');
const path = require('path');
const fs = require('fs');

async function run() {
    console.log('🏁 Starting Packaged Executable Verification...');

    const screenshotsDir = path.join(__dirname, '../screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const userDataDir = path.join(__dirname, '../.build/test-user-data-packaged');
    const extensionsDir = path.join(__dirname, '../.build/test-extensions-packaged');

    // Launch the actual compiled Pixel AI.exe directly with remote debugging
    const exePath = 'C:\\Users\\pixel9\\VSCode-win32-x64\\Pixel AI.exe';
    console.log(`📦 Launching packaged executable directly: ${exePath}`);
    
    const child = cp.spawn(exePath, [
        '--disable-workspace-trust',
        '--remote-debugging-port=53112',
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${extensionsDir}`,
        '--disable-gpu',
        '--no-sandbox'
    ], {
        detached: false,
        stdio: 'ignore'
    });

    console.log('⏳ Waiting 15 seconds for Pixel AI.exe to fully initialize...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    let browser;
    try {
        console.log('🔌 Connecting Playwright via CDP to port 53112...');
        const playwright = require('playwright-core');
        browser = await playwright.chromium.connectOverCDP('http://127.0.0.1:53112');
        
        console.log('⏳ Waiting 3 seconds for page layouts to settle...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        const contexts = browser.contexts();
        const pages = contexts[0].pages();
        console.log(`🔍 Found ${pages.length} open pages. Listing URLs:`);
        pages.forEach((p, idx) => console.log(`  [${idx}] URL: ${p.url()}`));

        const page = pages.find(p => p.url().includes('workbench') || p.url().startsWith('vscode-file:'));
        if (!page) {
            console.error('❌ Main workbench page not found!');
            return;
        }

        console.log(`🎯 Successfully attached to Packaged Editor Window: "${await page.title()}"`);

        // Click the screen to ensure focus
        await page.click('body');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Dismiss Copilot welcome overlay if present
        await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent === 'Continue without Signing In');
            if (el) el.click();
        });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Dismiss Walkthrough Onboarding popup if present
        await page.evaluate(() => {
            const closeBtn = document.querySelector('.onboarding-a-close-btn');
            if (closeBtn) closeBtn.click();
        });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Let's check what titlebar style is actually rendering in DOM
        const titlebarDiagnostics = await page.evaluate(() => {
            const hasCustomTitlebarInDOM = !!document.querySelector('.part.titlebar');
            const hasNativeMenuInDOM = !document.querySelector('.menubar');
            const bodyClasses = document.body.className;
            return {
                hasCustomTitlebarInDOM,
                hasNativeMenuInDOM,
                bodyClasses
            };
        });

        console.log('📊 Packaged UI Diagnostics:');
        console.log(`  - Has Custom HTML Titlebar in DOM: ${titlebarDiagnostics.hasCustomTitlebarInDOM ? 'Yes ❌ (This means custom HTML titlebar is still active)' : 'No ✅ (This means native titlebar is active)'}`);
        console.log(`  - Has Native Menu active: ${titlebarDiagnostics.hasNativeMenuInDOM ? 'Yes ✅ (Native titlebar/menus active)' : 'No ❌ (Custom HTML menubar active)'}`);
        console.log(`  - Body CSS classes: "${titlebarDiagnostics.bodyClasses}"`);

        // Capture a clean visual screenshot of the compiled Pixel AI.exe window
        const screenshotPath = path.join(screenshotsDir, 'packaged-clean.png');
        console.log(`📸 Taking screenshot of the packaged application and saving to ${screenshotPath}...`);
        await page.screenshot({ path: screenshotPath });

    } catch (err) {
        console.error('❌ Packaged Verification Error:', err.message);
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('💀 Closing Pixel AI.exe...');
        child.kill();
        try {
            cp.execSync('taskkill /f /im "Pixel AI.exe"', { stdio: 'ignore' });
        } catch (_) {}
        console.log('🏁 Packaged Executable Verification complete.');
    }
}

run();
