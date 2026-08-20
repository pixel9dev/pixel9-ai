const cp = require('child_process');
const path = require('path');
const fs = require('fs');

async function run() {
    console.log('🏁 Starting Clean DOM Diagnostics...');

    const screenshotsDir = path.join(__dirname, '../screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const userDataDir = path.join(__dirname, '../.build/test-user-data-workbench');
    const extensionsDir = path.join(__dirname, '../.build/test-extensions-workbench');

    console.log('📦 Launching custom AI-IDE in isolated workbench mode with debugging...');
    const child = cp.spawn('cmd.exe', [
        '/c', 
        'scripts\\code.bat', 
        '--disable-workspace-trust',
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
        console.log('🔌 Connecting Playwright via CDP...');
        const playwright = require('playwright-core');
        browser = await playwright.chromium.connectOverCDP('http://127.0.0.1:53111');
        
        const contexts = browser.contexts();
        const pages = contexts[0].pages();
        const page = pages.find(p => p.url().includes('workbench') || p.url().startsWith('vscode-file:'));
        
        if (!page) {
            console.error('❌ Main editor window not found.');
            return;
        }

        console.log('🎯 Successfully attached to Editor Window!');

        // Focus window
        await page.click('body');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Click the button "Continue without Signing In" if it is present
        const dismissed = await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent === 'Continue without Signing In');
            if (el) {
                el.click();
                return true;
            }
            return false;
        });
        console.log('Clicked "Continue without Signing In":', dismissed);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Now print the full active screen text
        const domText = await page.evaluate(() => {
            return document.body.innerText;
        });
        console.log('📝 ACTIVE WORKSPACE TEXT SNAPSHOT:\n', domText.substring(0, 1500));

        // Let's also print all elements that have an input or text role
        const elementsList = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input, button, select, textarea, .monaco-list')).map(e => ({
                tagName: e.tagName,
                className: e.className,
                placeholder: e.placeholder || '',
                text: e.textContent?.substring(0, 100) || '',
                rect: e.getBoundingClientRect()
            }));
        });
        console.log('🔍 Key DOM elements found on page:', JSON.stringify(elementsList, null, 2));

        // Take a screenshot
        await page.screenshot({ path: path.join(screenshotsDir, 'clean-diagnostics.png') });
        console.log('📸 Saved clean-diagnostics.png');

    } catch (err) {
        console.error('❌ Diagnostics Error:', err.message);
    } finally {
        if (browser) {
            await browser.close();
        }
        child.kill();
        try {
            cp.execSync('taskkill /f /im pixel9-ai.exe', { stdio: 'ignore' });
            cp.execSync('taskkill /f /im Code.exe', { stdio: 'ignore' });
        } catch (_) {}
    }
}

run();
