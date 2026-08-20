const cp = require('child_process');
const path = require('path');
const fs = require('fs');

async function run() {
    console.log('🏁 Starting Direct Window Inspector...');

    const userDataDir = path.join(__dirname, '../.build/test-user-data-workbench');
    const extensionsDir = path.join(__dirname, '../.build/test-extensions-workbench');

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
        console.log(`🔍 Found ${pages.length} open page(s). Listing URLs:`);
        pages.forEach((p, i) => console.log(`  [${i}] ${p.url()}`));

        const page = pages.find(p => p.url().includes('workbench') || p.url().startsWith('vscode-file:'));
        if (!page) {
            console.error('❌ Main workbench page not found!');
            return;
        }

        console.log('🎯 Found workbench page! Fetching body inner HTML...');
        const html = await page.evaluate(() => {
            return {
                bodyHTML: document.body.innerHTML.substring(0, 2000),
                bodyClasses: document.body.className,
                title: document.title,
                scripts: Array.from(document.querySelectorAll('script')).map(s => s.src)
            };
        });

        console.log('📝 PAGE TITLE:', html.title);
        console.log('📝 BODY CLASSES:', html.bodyClasses);
        console.log('📝 SCRIPTS LOADED:', html.scripts);
        console.log('📝 BODY HTML SNAPSHOT (First 2000 chars):\n', html.bodyHTML);

    } catch (err) {
        console.error('❌ Inspector Error:', err.message);
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
