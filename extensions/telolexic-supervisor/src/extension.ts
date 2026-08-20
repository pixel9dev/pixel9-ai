import * as vscode from 'vscode';
import { TelolexicAuditor, AuditDetails } from './telolexia';
import { TelolexicAuditorAST, generateVisualization, TAP3Verdict, CausalFlowVisualization } from './telolexia-ast';
import { CausalAuditVisualizer } from './causalAuditVisualizer';
import { OllamaProvider, GeminiProvider } from './llmClient';

export function activate(context: vscode.ExtensionContext) {
    console.log('Telolexic Supervisor is now active.');

    // Instantiate both offline and cloud LLM providers to showcase the dual-agent architecture
    const offlineLLM = new OllamaProvider('llama3');
    const cloudLLM = new GeminiProvider();

    // Initialize new AST-based causal visualizer
    const causalVisualizer = new CausalAuditVisualizer(context);

    // Visualizer Webview Panel Manager
    let visualizerPanel: vscode.WebviewPanel | undefined = undefined;

    // Helper to open the interactive Webview Panel
    function showVisualizerWebview(code: string, isGenerationFlow: boolean, onInject?: (finalCode: string) => void) {
        let activeCode = code;
        let auditData = TelolexicAuditor.getAuditData(activeCode);

        if (visualizerPanel) {
            visualizerPanel.reveal(vscode.ViewColumn.Two);
        } else {
            visualizerPanel = vscode.window.createWebviewPanel(
                'telolexicVisualizer',
                'Telolexic Causal Audit Flow',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            visualizerPanel.onDidDispose(() => {
                visualizerPanel = undefined;
            });
        }

        // Setup messaging channel
        visualizerPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'pruneLine': {
                    const lineIndex = message.lineIndex;
                    const lines = activeCode.split('\n');
                    
                    // Comment out the dead line (exigenesis prune)
                    if (lineIndex >= 0 && lineIndex < lines.length) {
                        lines[lineIndex] = `// [Telolexic Pruned Dead Code]: ${lines[lineIndex].trim()}`;
                        activeCode = lines.join('\n');
                        
                        // Re-audit and send back updated state
                        auditData = TelolexicAuditor.getAuditData(activeCode);
                        visualizerPanel?.webview.postMessage({
                            command: 'updateGraph',
                            auditDetails: auditData
                        });
                        
                        vscode.window.showInformationMessage(`Pruned dead variable definition at line ${lineIndex + 1}.`);
                    }
                    break;
                }
                case 'injectCode': {
                    if (onInject) {
                        onInject(activeCode);
                    }
                    visualizerPanel?.dispose();
                    break;
                }
                case 'close': {
                    visualizerPanel?.dispose();
                    break;
                }
            }
        });

        visualizerPanel.webview.html = getWebviewContent(auditData, isGenerationFlow);
    }

    // Command 1: Audit highlighted code in reverse (Vilomapatha) and show Causal Flow Chart
    let auditDisposable = vscode.commands.registerCommand('telolexic.auditSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor found.');
            return;
        }

        const selection = editor.selection;
        const code = editor.document.getText(selection);
        
        if (!code) {
            vscode.window.showWarningMessage('Please highlight a block of code to audit.');
            return;
        }

        vscode.window.showInformationMessage('Running Telolexic Causal Audit (Reverse)...');
        
        // Open the visualizer in read-only audit mode
        showVisualizerWebview(code, false);
    });

    // Command 2: Generate and Audit Code (with new AST-based auditor)
    let generateDisposable = vscode.commands.registerCommand('telolexic.generateAndAudit', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const prompt = editor.document.getText(selection);
        
        if (!prompt) {
            vscode.window.showWarningMessage('Please highlight a prompt in the editor to generate code.');
            return;
        }

        // Ask the user which model to use for this generation
        const choice = await vscode.window.showQuickPick(['Offline Open-Source (Ollama)', 'Google Cloud (Gemini)'], {
            placeHolder: 'Select which model to use for code generation'
        });

        if (!choice) return;

        const activeLLM = choice.includes('Offline') ? offlineLLM : cloudLLM;

        // 1. Generation Phase (Agent A writes to Latent Buffer)
        const generatedCode = await activeLLM.generateCode(prompt);
        if (!generatedCode) return;

        // 2. Run new AST-based audit with TAP-3.0 protocol
        vscode.window.showInformationMessage('🔍 Running TAP-3.0 Semantic Audit...');
        const astAuditor = new TelolexicAuditorAST(generatedCode, editor.document.fileName);
        const verdict = astAuditor.audit();
        const visualization = generateVisualization(verdict);

        // 3. Show interactive causal audit visualizer
        vscode.window.showInformationMessage(`Audit Result: ${verdict.verdict} (${verdict.score}% confidence)`);
        causalVisualizer.show(verdict, visualization, generatedCode);
        
        // 4. Apply code to editor after user confirms
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, generatedCode);
        });
        
        vscode.window.showInformationMessage('✅ Code injected successfully!');

        // 5. Feed the Aquarium Fish based on audit result
        if (verdict.verdict === 'Verified') {
            vscode.commands.executeCommand('sessions.aquarium.feed', 5);
            vscode.window.showInformationMessage('🐠 Excellent! Fish fed with 5 pellets!');
        } else if (verdict.verdict === 'AnomalyFlagged') {
            vscode.commands.executeCommand('sessions.aquarium.feed', 2);
            vscode.window.showInformationMessage('⚠️ Dead code detected. Fish fed with 2 pellets.');
        } else if (verdict.verdict === 'PhysicsViolation') {
            vscode.commands.executeCommand('sessions.aquarium.setWaterQuality', 'toxic');
            vscode.window.showWarningMessage('❌ Unresolved dependencies detected. Water turned toxic!');
        }
    });

    // Command 3: Audit with new AST-based analyzer
    let astAuditDisposable = vscode.commands.registerCommand('telolexic.auditWithAST', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active text editor found.');
            return;
        }

        const selection = editor.selection;
        const code = editor.document.getText(selection);
        
        if (!code) {
            vscode.window.showWarningMessage('Please highlight a block of code to audit.');
            return;
        }

        vscode.window.showInformationMessage('🔍 Running TAP-3.0 Semantic Audit...');
        
        // Run AST-based audit
        const auditor = new TelolexicAuditorAST(code, editor.document.fileName);
        const verdict = auditor.audit();
        const visualization = generateVisualization(verdict);
        
        // Show causal audit visualizer
        causalVisualizer.show(verdict, visualization, code);
    });

    context.subscriptions.push(auditDisposable);
    context.subscriptions.push(generateDisposable);
    context.subscriptions.push(astAuditDisposable);
}

export function deactivate() {}

function getWebviewContent(auditData: AuditDetails, isGenerationFlow: boolean): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telolexic Causal Audit Visualizer</title>
    <style>
        body {
            background-color: #1e1e1e;
            color: #d4d4d4;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 16px;
            overflow-x: hidden;
        }
        h2 {
            margin: 0 0 4px 0;
            color: #f1f1f1;
            font-weight: 500;
            font-size: 18px;
        }
        .container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 100%;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #181818 0%, #282828 100%);
            border: 1px solid #333;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status-badge {
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
        }
        .status-verified {
            background-color: #2e7d32;
            color: #e8f5e9;
            box-shadow: 0 0 10px rgba(46,125,50,0.3);
        }
        .status-flagged {
            background-color: #f57f17;
            color: #fffde7;
            box-shadow: 0 0 10px rgba(245,127,23,0.3);
        }
        .status-violation {
            background-color: #c62828;
            color: #ffebee;
            box-shadow: 0 0 10px rgba(198,40,40,0.3);
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.03); }
            100% { transform: scale(1); }
        }
        .actions-panel {
            display: flex;
            gap: 8px;
        }
        .btn {
            background-color: #0e639c;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: background-color 0.2s;
        }
        .btn:hover {
            background-color: #1177bb;
        }
        .btn-secondary {
            background-color: #3a3d3d;
            color: #cccccc;
        }
        .btn-secondary:hover {
            background-color: #454949;
        }
        .details-box {
            background-color: #252526;
            border: 1px solid #3c3c3c;
            border-radius: 6px;
            padding: 12px;
            font-size: 13px;
            line-height: 1.5;
            color: #cccccc;
        }
        .main-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            background-color: #252526;
            border: 1px solid #3c3c3c;
            border-radius: 8px;
            padding: 16px;
            position: relative;
            min-height: 500px;
        }
        .code-pane {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
            font-size: 12px;
            line-height: 24px;
            white-space: pre;
            overflow-x: auto;
            position: relative;
            z-index: 2;
        }
        .code-line {
            display: flex;
            position: relative;
            padding-left: 40px;
            border-radius: 3px;
            transition: background-color 0.1s;
        }
        .code-line:hover {
            background-color: #2d2d2d;
        }
        .line-num {
            position: absolute;
            left: 0;
            width: 30px;
            text-align: right;
            color: #6e7681;
            user-select: none;
            padding-right: 8px;
            border-right: 1px solid #3c3c3c;
        }
        .line-content {
            padding-left: 10px;
            display: inline-block;
            color: #e3e6e8;
        }
        .line-verified {
            background-color: rgba(46,125,50,0.06);
        }
        .line-exigenesis {
            background-color: rgba(245,127,23,0.06);
        }
        .line-unresolved {
            background-color: rgba(198,40,40,0.1);
            border-left: 2px solid #f44336;
        }
        .visual-pane {
            position: relative;
            border-left: 1px solid #3c3c3c;
            min-height: 100%;
        }
        svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
        }
        .node {
            position: absolute;
            height: 16px;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 700;
            font-family: "SFMono-Regular", Consolas, monospace;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            z-index: 3;
            transition: transform 0.1s, box-shadow 0.1s;
        }
        .node-def {
            background-color: #0e639c;
            color: white;
            right: calc(100% - 70px);
        }
        .node-use {
            background-color: #8a2be2;
            color: white;
            left: 70px;
        }
        .node-exigenesis {
            background-color: #f57f17;
            color: black;
            right: calc(100% - 70px);
        }
        .node-unresolved {
            background-color: #c62828;
            color: white;
            left: 70px;
            animation: flash 1.5s infinite;
        }
        @keyframes flash {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
        }
        .prune-btn {
            background-color: #e28743;
            color: black;
            border: none;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 800;
            padding: 1px 6px;
            cursor: pointer;
            margin-left: 12px;
            vertical-align: middle;
            transition: background-color 0.1s;
        }
        .prune-btn:hover {
            background-color: #ffaa5a;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h2>Telolexic Causal Audit Visualizer</h2>
                <div style="font-size: 11px; color: #858585; font-family: monospace;">Vilomapatha Loop TAP-2.0</div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px;">
                <span id="verdict-badge" class="status-badge"></span>
                <div class="actions-panel">
                    <button id="inject-btn" class="btn" style="display: none;">Inject Verified Code</button>
                    <button id="close-btn" class="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>

        <div id="details-text" class="details-box"></div>

        <div class="main-layout">
            <div id="code-container" class="code-pane"></div>
            <div class="visual-pane">
                <svg id="connections-svg"></svg>
                <div id="nodes-container"></div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let auditData = ${JSON.stringify(auditData)};
        const isGenerationFlow = ${isGenerationFlow};

        function render() {
            const codeContainer = document.getElementById('code-container');
            const nodesContainer = document.getElementById('nodes-container');
            const svg = document.getElementById('connections-svg');
            const verdictBadge = document.getElementById('verdict-badge');
            const detailsText = document.getElementById('details-text');
            const injectBtn = document.getElementById('inject-btn');

            // Clear previous
            codeContainer.innerHTML = '';
            nodesContainer.innerHTML = '';
            svg.innerHTML = '';

            // Update badge & details
            verdictBadge.textContent = auditData.verdict;
            verdictBadge.className = 'status-badge ' + (
                auditData.verdict === 'Verified' ? 'status-verified' :
                auditData.verdict === 'AnomalyFlagged' ? 'status-flagged' : 'status-violation'
            );
            detailsText.textContent = auditData.details;

            if (isGenerationFlow && auditData.verdict !== 'PhysicsViolation') {
                injectBtn.style.display = 'block';
            } else {
                injectBtn.style.display = 'none';
            }

            // Render code lines
            auditData.lines.forEach((line, idx) => {
                const lineEl = document.createElement('div');
                lineEl.className = 'code-line ' + (
                    line.status === 'verified' ? 'line-verified' :
                    line.status === 'exigenesis' ? 'line-exigenesis' :
                    line.status === 'unresolved' ? 'line-unresolved' : ''
                );
                lineEl.id = 'line-' + idx;

                const numEl = document.createElement('span');
                numEl.className = 'line-num';
                numEl.textContent = idx + 1;

                const contentEl = document.createElement('span');
                contentEl.className = 'line-content';
                contentEl.textContent = line.text;

                lineEl.appendChild(numEl);
                lineEl.appendChild(contentEl);

                if (line.status === 'exigenesis') {
                    const pruneBtn = document.createElement('button');
                    pruneBtn.className = 'prune-btn';
                    pruneBtn.textContent = 'PRUNE';
                    pruneBtn.onclick = (e) => {
                        e.stopPropagation();
                        vscode.postMessage({ command: 'pruneLine', lineIndex: idx });
                    };
                    lineEl.appendChild(pruneBtn);
                }

                codeContainer.appendChild(lineEl);
            });

            // Delay node positioning until DOM lines are painted and have heights
            setTimeout(() => {
                const codeRect = codeContainer.getBoundingClientRect();
                const svgRect = svg.getBoundingClientRect();

                auditData.connections.forEach((conn) => {
                    const fromLineEl = document.getElementById('line-' + conn.fromLine);
                    const toLineEl = document.getElementById('line-' + conn.toLine);

                    let yFrom = 0;
                    let yTo = 0;

                    if (fromLineEl) {
                        const r = fromLineEl.getBoundingClientRect();
                        yFrom = r.top - codeRect.top + (r.height / 2);
                    }
                    if (toLineEl) {
                        const r = toLineEl.getBoundingClientRect();
                        yTo = r.top - codeRect.top + (r.height / 2);
                    }

                    if (conn.status === 'verified' && fromLineEl && toLineEl) {
                        // Draw beautiful bezier curve
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        const xStart = 0;
                        const xEnd = svgRect.width - 70;
                        const ctrlX1 = svgRect.width / 2;
                        const ctrlY1 = yFrom;
                        const ctrlX2 = svgRect.width / 2;
                        const ctrlY2 = yTo;
                        
                        path.setAttribute('d', 'M ' + xStart + ' ' + yFrom + ' C ' + ctrlX1 + ' ' + ctrlY1 + ', ' + ctrlX2 + ' ' + ctrlY2 + ', ' + xEnd + ' ' + yTo);
                        path.setAttribute('stroke', '#4caf50');
                        path.setAttribute('stroke-width', '2');
                        path.setAttribute('fill', 'none');
                        path.setAttribute('opacity', '0.6');
                        svg.appendChild(path);

                        // Define Node
                        const nodeDef = document.createElement('div');
                        nodeDef.className = 'node node-def';
                        nodeDef.style.top = yFrom + 'px';
                        nodeDef.textContent = conn.identifier;
                        nodesContainer.appendChild(nodeDef);

                        // Use Node
                        const nodeUse = document.createElement('div');
                        nodeUse.className = 'node node-use';
                        nodeUse.style.top = yTo + 'px';
                        nodeUse.style.left = (svgRect.width - 70) + 'px';
                        nodeUse.textContent = conn.identifier;
                        nodesContainer.appendChild(nodeUse);
                    } else if (conn.status === 'exigenesis' && fromLineEl) {
                        const nodeEx = document.createElement('div');
                        nodeEx.className = 'node node-exigenesis';
                        nodeEx.style.top = yFrom + 'px';
                        nodeEx.textContent = conn.identifier + ' (unused)';
                        nodesContainer.appendChild(nodeEx);
                    } else if (conn.status === 'unresolved' && toLineEl) {
                        const nodeUn = document.createElement('div');
                        nodeUn.className = 'node node-unresolved';
                        nodeUn.style.top = yTo + 'px';
                        nodeUn.style.left = (svgRect.width - 150) + 'px';
                        nodeUn.textContent = 'unresolved: ' + conn.identifier;
                        nodesContainer.appendChild(nodeUn);
                    }
                });
            }, 100);
        }

        render();

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateGraph') {
                auditData = message.auditDetails;
                render();
            }
        });

        document.getElementById('inject-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'injectCode' });
        });

        document.getElementById('close-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'close' });
        });
    </script>
</body>
</html>`;
}
