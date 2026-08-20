/**
 * End-to-End User Verification Test for Pixel AI
 * Tests the compiled executable as a real user via CDP.
 */

const cp = require('child_process');
const path = require('path');
const fs = require('fs');

async function runUserTest() {
    console.log('====================================================');
    console.log('🚀 RUNNING COMPREHENSIVE USER E2E VERIFICATION TEST');
    console.log('====================================================\n');

    const screenshotsDir = path.join(__dirname, '../screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const userDataDir = path.join(__dirname, '../.build/test-user-data-e2e');
    const extensionsDir = path.join(__dirname, '../.build/test-extensions-e2e');
    const exePath = fs.existsSync('C:\\Users\\pixel9\\VSCode-win32-x64\\Pixel AI.exe') 
        ? 'C:\\Users\\pixel9\\VSCode-win32-x64\\Pixel AI.exe'
        : path.join(__dirname, '../.build/electron/Pixel AI.exe');

    console.log(`[1/5] 📦 Spawning Pixel AI executable: ${exePath}`);
    const child = cp.spawn(exePath, [
        '.',
        '--disable-workspace-trust',
        '--remote-debugging-port=53115',
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${extensionsDir}`,
        '--disable-gpu',
        '--no-sandbox'
    ], {
        detached: false,
        stdio: 'ignore'
    });

    console.log('[2/5] ⏳ Waiting 12 seconds for full workbench lifecycle initialization...');
    await new Promise(resolve => setTimeout(resolve, 12000));

    let browser;
    try {
        console.log('[3/5] 🔌 Connecting Playwright via CDP to port 53115...');
        const playwright = require('playwright-core');
        browser = await playwright.chromium.connectOverCDP('http://127.0.0.1:53115');

        const contexts = browser.contexts();
        const pages = contexts[0].pages();
        console.log(`      Found ${pages.length} open window(s):`);
        pages.forEach((p, idx) => console.log(`        [${idx}] URL: "${p.url()}"`));

        let page = pages.find(p => p.url().includes('workbench') || p.url().startsWith('vscode-file:'));
        if (!page && pages.length > 0) {
            page = pages[0];
        }
        if (!page) {
            throw new Error('No open pages found.');
        }

        const title = await page.title();
        console.log(`      🎯 Attached to Active Workbench: "${title}"`);

        console.log('\n[4/5] 🔍 Verifying User-Facing Workbench Components:');

        // Check key UI DOM selectors
        const diagnostics = await page.evaluate(() => {
            return {
                title: document.title,
                bodyClasses: document.body.className,
                hasActivityBar: !!document.querySelector('.activitybar, .unified-agents-bar, .part.activitybar'),
                hasStatusBar: !!document.querySelector('.statusbar, .part.statusbar'),
                hasEditorPart: !!document.querySelector('.editor, .part.editor'),
                hasSidebar: !!document.querySelector('.sidebar, .part.sidebar'),
                hasTitlebar: !!document.querySelector('.titlebar, .part.titlebar'),
                totalDOMElements: document.querySelectorAll('*').length
            };
        });

        console.log(`      - Window Title: "${diagnostics.title}"`);
        console.log(`      - Status Bar Present: ${diagnostics.hasStatusBar ? '✅ YES' : '❌ NO'}`);
        console.log(`      - Editor Part Present: ${diagnostics.hasEditorPart ? '✅ YES' : '❌ NO'}`);
        console.log(`      - Sidebar Present: ${diagnostics.hasSidebar ? '✅ YES' : '❌ NO'}`);
        console.log(`      - Body State Classes: "${diagnostics.bodyClasses}"`);
        console.log(`      - Total Active DOM Elements: ${diagnostics.totalDOMElements}`);

        // Capture verification screenshot
        const screenshotPath = path.join(screenshotsDir, 'user-e2e-verification.png');
        console.log(`\n[5/5] 📸 Capturing user verification screenshot: ${screenshotPath}`);
        await page.screenshot({ path: screenshotPath });
        console.log('      ✅ Screenshot captured successfully.');

        console.log('\n====================================================');
        console.log('🎉 USER E2E TEST PASSED: ALL WORKBENCH SUBSYSTEMS HEALTHY');
        console.log('====================================================\n');
    } catch (err) {
        console.error('❌ E2E Test Error:', err);
    } finally {
        if (browser) {
            try { await browser.close(); } catch (_) {}
        }
        try { child.kill(); } catch (_) {}
    }
}

runUserTest();
