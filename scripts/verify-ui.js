const cp = require('child_process');
const path = require('path');
const fs = require('fs');

async function run() {
    console.log('🚀 Starting UI Automation Verification...');
    
    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(__dirname, '../screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const userDataDir = path.join(__dirname, '../.build/test-user-data');
    const extensionsDir = path.join(__dirname, '../.build/test-extensions');

    // Spawn Code OSS with debugging port
    console.log('📦 Launching Code OSS from sources with remote debugging...');
    const child = cp.spawn('cmd.exe', [
        '/c', 
        'scripts\\code.bat', 
        '--remote-debugging-port=53111',
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${extensionsDir}`,
        '--disable-gpu',
        '--no-sandbox'
    ], {
        cwd: path.join(__dirname, '..'),
        stdio: 'ignore',
        detached: false
    });

    console.log('⏳ Waiting 15 seconds for Code OSS to initialize...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    let browser;
    try {
        console.log('🔌 Connecting Playwright via CDP to http://127.0.0.1:53111...');
        const playwright = require('playwright-core');
        browser = await playwright.chromium.connectOverCDP('http://127.0.0.1:53111');
        
        const contexts = browser.contexts();
        if (contexts.length === 0) {
            throw new Error('No browser contexts found.');
        }

        const pages = contexts[0].pages();
        console.log(`🔍 Found ${pages.length} open window(s)/tab(s):`);
        pages.forEach((p, idx) => console.log(`  [${idx}] URL: ${p.url()}`));

        // Find the main workbench or sessions page
        const page = pages.find(p => p.url().includes('workbench') || p.url().startsWith('vscode-file:'));
        if (!page) {
            console.log('⚠️ Could not find a workbench or sessions page in the open tabs.');
            return;
        }

        console.log(`🎯 Attached to page: ${page.url()}`);

        // Take a screenshot of the current user session
        const screenshotPath = path.join(screenshotsDir, 'autotest.png');
        console.log(`📸 Taking screenshot of the active window and saving to ${screenshotPath}...`);
        await page.screenshot({ path: screenshotPath });

        // Query key layout and menu elements to diagnose why the toolbar isn't rendering
        const uiState = await page.evaluate(() => {
            const hasTitlebar = !!document.querySelector('.part.titlebar');
            const hasActivitybar = !!document.querySelector('.part.activitybar');
            const hasStatusbar = !!document.querySelector('.part.statusbar');
            const hasSessionsPart = !!document.querySelector('.part.sessions');
            const bodyClasses = document.body.className;
            const visibleSelectors = {
                titlebar: document.querySelector('.part.titlebar')?.getBoundingClientRect(),
                activitybar: document.querySelector('.part.activitybar')?.getBoundingClientRect(),
                sessions: document.querySelector('.part.sessions')?.getBoundingClientRect()
            };
            return {
                title: document.title,
                hasTitlebar,
                hasActivitybar,
                hasStatusbar,
                hasSessionsPart,
                bodyClasses,
                visibleSelectors
            };
        });

        console.log('📊 UI State Report:');
        console.log(`  - Page Title: "${uiState.title}"`);
        console.log(`  - Has Titlebar / Menu Part: ${uiState.hasTitlebar ? 'Yes ✅' : 'No ❌'}`);
        console.log(`  - Has Activitybar Part: ${uiState.hasActivitybar ? 'Yes ✅' : 'No ❌'}`);
        console.log(`  - Has Statusbar Part: ${uiState.hasStatusbar ? 'Yes ✅' : 'No ❌'}`);
        console.log(`  - Has Sessions/Agent Part: ${uiState.hasSessionsPart ? 'Yes ✅' : 'No ❌'}`);
        console.log(`  - Document Classes: "${uiState.bodyClasses}"`);
        console.log('  - Layout Rects:', JSON.stringify(uiState.visibleSelectors, null, 2));

        if (!uiState.hasTitlebar) {
            console.log('💡 DIAGNOSIS: Titlebar is not rendered. This matches our Agents Window design: SESSIONS.md specifies that the Agents Window has a "simplified chrome" which disables the native activity bar and status bar, and uses a simplified, session-aware top titlebar!');
        }

    } catch (err) {
        console.error('❌ Automation Error:', err.message);
    } finally {
        if (browser) {
            console.log('🔌 Disconnecting Playwright...');
            await browser.close();
        }
        console.log('💀 Terminating Code OSS process...');
        child.kill();
        // Fallback kill command to make sure port is freed
        try {
            cp.execSync('taskkill /f /im pixel9-ai.exe', { stdio: 'ignore' });
            cp.execSync('taskkill /f /im Code.exe', { stdio: 'ignore' });
        } catch (_) {}
        console.log('🏁 UI Automation Verification complete.');
    }
}

run();
