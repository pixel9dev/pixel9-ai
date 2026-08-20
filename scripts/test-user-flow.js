const cp = require('child_process');
const path = require('path');
const fs = require('fs');

async function run() {
    console.log('🏁 Starting Complete Next-Gen User Flow Test (Isolated Workbench Mode)...');

    const screenshotsDir = path.join(__dirname, '../screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const userDataDir = path.join(__dirname, '../.build/test-user-data-workbench');
    const extensionsDir = path.join(__dirname, '../.build/test-extensions-workbench');

    // Launch Code OSS in standard isolated mode to bypass sign-in blocks
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

    console.log('⏳ Waiting 15 seconds for the Editor Window to fully initialize...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    let browser;
    try {
        console.log('🔌 Connecting Playwright via CDP...');
        const playwright = require('playwright-core');
        browser = await playwright.chromium.connectOverCDP('http://127.0.0.1:53111');
        
        console.log('⏳ Waiting 3 seconds for page layouts to settle...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        const contexts = browser.contexts();
        const pages = contexts[0].pages();
        console.log(`🔍 Found ${pages.length} open pages. Finding the active workbench...`);
        
        let page;
        for (const p of pages) {
            const url = p.url();
            const title = await p.title();
            console.log(`  - Page URL: "${url}", Title: "${title}"`);
            if (url.includes('workbench') && title && title !== '') {
                page = p;
                break;
            }
        }
        
        if (!page) {
            console.log('⚠️ Could not find page with title. Defaulting to the first workbench page...');
            page = pages.find(p => p.url().includes('workbench'));
        }

        if (!page) {
            console.error('❌ Main editor window not found.');
            return;
        }

        console.log(`🎯 Successfully attached to Editor Window: "${await page.title()}"`);

        // Focus the window
        console.log('🎯 Clicking body to focus window...');
        await page.click('body');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Click "Continue without Signing In" to dismiss Copilot welcome overlay if present
        console.log('🎯 Searching for Copilot "Continue without Signing In" button...');
        const copilotDismissed = await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent === 'Continue without Signing In');
            if (el) {
                el.click();
                return true;
            }
            return false;
        });
        if (copilotDismissed) {
            console.log('✅ Dismissed Copilot welcome overlay!');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Click onboarding close button to dismiss the onboarding walkthrough modal
        console.log('🎯 Searching for onboarding Walkthrough close button...');
        const onboardingDismissed = await page.evaluate(() => {
            const closeBtn = document.querySelector('.onboarding-a-close-btn');
            if (closeBtn) {
                closeBtn.click();
                return true;
            }
            return false;
        });

        if (onboardingDismissed) {
            console.log('✅ Closed Walkthrough Onboarding popup!');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Close the active Welcome Page tab programmatically using direct click
        console.log('🎯 Searching for active Welcome/walkthrough tab close button...');
        const tabClosed = await page.evaluate(() => {
            const closeBtn = document.querySelector('.tab .tab-close-button');
            if (closeBtn) {
                closeBtn.click();
                return true;
            }
            return false;
        });

        if (tabClosed) {
            console.log('✅ Closed active Welcome tab successfully!');
            await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
            console.log('⌨️ Pressing Control+F4 as a fallback to close tab...');
            await page.keyboard.press('Control+F4');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Take a screenshot of the clean workspace layout
        console.log('📸 Capturing clean workspace layout...');
        await page.screenshot({ path: path.join(screenshotsDir, 'workspace-clean.png') });

        // Milestone 2: Run "Feed Aquarium Fish" command via Menu Bar click
        console.log('🐠 Navigating to Command Palette via View menu bar click...');
        
        // Find and click the "View" menu button in the HTML titlebar
        const viewClicked = await page.evaluate(() => {
            const menuButtons = Array.from(document.querySelectorAll('.menubar-menu-button'));
            const viewMenu = menuButtons.find(b => b.textContent?.trim() === 'View');
            if (viewMenu) {
                viewMenu.click();
                return true;
            }
            return false;
        });

        if (viewClicked) {
            console.log('✅ Clicked "View" menu item. Waiting for context menu...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Click the Command Palette... item
            const cpClicked = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.action-menu-item, .context-view .action-item'));
                const commandPaletteItem = items.find(i => i.textContent?.includes('Command Palette'));
                if (commandPaletteItem) {
                    commandPaletteItem.click();
                    return true;
                }
                return false;
            });

            if (cpClicked) {
                console.log('✅ Clicked "Command Palette..." from dropdown menu!');
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.log('⚠️ Could not find Command Palette menu item. Retrying with keyboard shortcut F1...');
                await page.keyboard.press('F1');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } else {
            console.log('⚠️ Could not find View menu button. Retrying with keyboard shortcut F1...');
            await page.keyboard.press('F1');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log('🎯 Querying inputs in active DOM...');
        const activeInputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input')).map(i => ({
                className: i.className,
                placeholder: i.placeholder,
                rect: i.getBoundingClientRect()
            }));
        });
        console.log('🔍 Active inputs:', activeInputs);

        console.log('⏳ Waiting for Command Palette filter input...');
        // Let's wait for ANY input element inside quick input container
        await page.waitForSelector('.quick-input-widget input, input.quick-input-filter, input', { timeout: 10000 });
        
        // Type the action title
        console.log('⌨️ Typing "Feed Aquarium Fish"...');
        await page.keyboard.type('Feed Aquarium Fish');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('⌨️ Pressing Enter...');
        await page.keyboard.press('Enter');
        
        console.log('⏳ Allowing 3 seconds for fish food pellets to spawn...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Take a screenshot of the Aquarium in action
        console.log('📸 Capturing Aquarium feeding visualization...');
        await page.screenshot({ path: path.join(screenshotsDir, 'aquarium-feeding.png') });

        // Open Command Palette again and run "Telolexia: Audit Code Selection"
        console.log('🔍 Opening Command Palette (F1) for Causal Audit...');
        await page.keyboard.press('F1');
        await page.waitForSelector('.quick-input-widget input, input.quick-input-filter, input', { timeout: 10000 });
        
        console.log('⌨️ Typing "Telolexia: Audit Code Selection"...');
        await page.keyboard.type('Telolexia: Audit Code Selection');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('⌨️ Pressing Enter...');
        await page.keyboard.press('Enter');

        console.log('⏳ Allowing 5 seconds for Telolexic Audit compilation and webview panel loading...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Take a screenshot of the active Causal Flow Diagram side-by-side with code!
        console.log('📸 Capturing Telolexic Causal Audit Visualizer webview panel...');
        await page.screenshot({ path: path.join(screenshotsDir, 'causal-audit-diagram.png') });

        console.log('🎉 Full user-experience flow successfully automated!');
        console.log('📁 Screenshots captured in /screenshots:');
        console.log('  - workspace-clean.png (Clean workbench layout after dismissing all welcome prompts)');
        console.log('  - aquarium-feeding.png (Interactive Aquarium simulation with spawned pellets)');
        console.log('  - causal-audit-diagram.png (The Telolexic Causal Flow Visualizer panel)');

    } catch (err) {
        console.error('❌ Automation Flow Error:', err.message);
        if (browser) {
            try {
                const contexts = browser.contexts();
                const pages = contexts[0].pages();
                const page = pages.find(p => p.url().includes('workbench') || p.url().startsWith('vscode-file:'));
                if (page) {
                    await page.screenshot({ path: path.join(screenshotsDir, 'error-diagnostics.png') });
                    console.log('📸 Saved error state diagnostics screenshot to error-diagnostics.png.');
                }
            } catch (_) {}
        }
    } finally {
        if (browser) {
            console.log('🔌 Disconnecting Playwright...');
            await browser.close();
        }
        console.log('💀 Cleaning up and closing AI-IDE process...');
        child.kill();
        try {
            cp.execSync('taskkill /f /im pixel9-ai.exe', { stdio: 'ignore' });
            cp.execSync('taskkill /f /im Code.exe', { stdio: 'ignore' });
        } catch (_) {}
        console.log('🏁 Next-Gen User Flow Test complete.');
    }
}

run();
