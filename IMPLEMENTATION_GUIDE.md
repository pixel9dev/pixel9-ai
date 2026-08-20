# Pixel AI Improvements - Implementation Guide

This guide provides step-by-step instructions for integrating the new features into the Pixel AI codebase.

---

## Table of Contents

1. [AST-Based Telolexic Auditor](#1-ast-based-telolexic-auditor)
2. [Causal Audit Visualizer](#2-causal-audit-visualizer)
3. [Multi-Agent Orchestrator](#3-multi-agent-orchestrator)
4. [Agent Manager UI](#4-agent-manager-ui)
5. [Enhanced Prompt Timeline](#5-enhanced-prompt-timeline)
6. [Aquarium Integration](#6-aquarium-integration)
7. [Testing & Validation](#7-testing--validation)

---

## 1. AST-Based Telolexic Auditor

### Files to Create/Modify

**New File:** `extensions/telolexic-supervisor/src/telolexia-ast.ts`
- Already created with full AST parsing implementation
- Uses TypeScript compiler API
- Provides TAP-3.0 verdict system

**Modify:** `extensions/telolexic-supervisor/src/extension.ts`

```typescript
// Add import
import { TelolexicAuditorAST, generateVisualization } from './telolexia-ast';

// In the activate function, replace old auditor with new one
export async function activate(context: vscode.ExtensionContext) {
    // ... existing code ...

    // Register new audit command with AST-based auditor
    const auditCommand = vscode.commands.registerCommand(
        'telolexic.generateAndAudit',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const code = editor.document.getText();
            
            // Use new AST-based auditor
            const auditor = new TelolexicAuditorAST(code, editor.document.fileName);
            const verdict = auditor.audit();
            
            // Generate visualization data
            const visualization = generateVisualization(verdict);
            
            // Show in visualizer
            visualizer.show(verdict, visualization, code);
            
            // Send to aquarium for gamification
            if (verdict.verdict === 'Verified') {
                vscode.commands.executeCommand('sessions.aquarium.feed');
            }
        }
    );

    context.subscriptions.push(auditCommand);
}
```

### Dependencies to Add

**File:** `extensions/telolexic-supervisor/package.json`

```json
{
  "dependencies": {
    "typescript": "^5.0.0",
    "d3": "^7.0.0"
  }
}
```

### Type Definitions

Create `extensions/telolexic-supervisor/src/types.ts`:

```typescript
export interface AuditResult {
    verdict: 'Verified' | 'AnomalyFlagged' | 'PhysicsViolation' | 'TypeMismatch';
    score: number;
    details: string;
    suggestions: string[];
}
```

---

## 2. Causal Audit Visualizer

### Files to Create/Modify

**New File:** `extensions/telolexic-supervisor/src/causalAuditVisualizer.ts`
- Already created with D3.js visualization
- Handles webview creation and message passing
- Implements code pruning functionality

**Modify:** `extensions/telolexic-supervisor/src/extension.ts`

```typescript
import { CausalAuditVisualizer } from './causalAuditVisualizer';

export async function activate(context: vscode.ExtensionContext) {
    const visualizer = new CausalAuditVisualizer(context);

    // Show visualizer on audit command
    const auditCommand = vscode.commands.registerCommand(
        'telolexic.generateAndAudit',
        async () => {
            // ... audit code ...
            visualizer.show(verdict, visualization, code);
        }
    );

    context.subscriptions.push(auditCommand);
}
```

### Webview Security

Ensure webview security in `package.json`:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "telolexic.generateAndAudit",
        "title": "Telolexic: Generate and Audit"
      }
    ]
  }
}
```

### Media Assets

Create `extensions/telolexic-supervisor/media/` directory for D3.js library (if not using CDN).

---

## 3. Multi-Agent Orchestrator

### Files to Create/Modify

**New File:** `src/vs/sessions/services/agents/multiAgentOrchestrator.ts`
- Already created with full orchestrator implementation
- Implements IMultiAgentOrchestrator interface
- Handles agent lifecycle and task management

**Create:** `src/vs/sessions/services/agents/index.ts`

```typescript
export * from './multiAgentOrchestrator';
```

**Modify:** `src/vs/sessions/services/sessions/browser/sessionsService.ts`

```typescript
import { IMultiAgentOrchestrator, MultiAgentOrchestrator } from '../agents/multiAgentOrchestrator.js';

// In the service registration
registerSingleton(IMultiAgentOrchestrator, MultiAgentOrchestrator);
```

### Service Registration

**File:** `src/vs/sessions/services/agents/multiAgentOrchestrator.contribution.ts`

```typescript
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IMultiAgentOrchestrator, MultiAgentOrchestrator } from './multiAgentOrchestrator.js';

registerSingleton(IMultiAgentOrchestrator, MultiAgentOrchestrator);
```

### Integration with LLM Providers

**Modify:** `extensions/telolexic-supervisor/src/llmClient.ts`

```typescript
export interface ILLMProvider {
    generateCode(prompt: string, context: string): Promise<string>;
    generatePlan(prompt: string): Promise<string>;
    analyzeCode(code: string): Promise<string>;
}

export class OllamaProvider implements ILLMProvider {
    // ... existing implementation ...
    
    async generatePlan(prompt: string): Promise<string> {
        // Generate structured plan for agent
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                model: 'neural-chat',
                prompt: `Create a detailed plan for: ${prompt}`,
                stream: false
            })
        });
        const data = await response.json();
        return data.response;
    }
}
```

---

## 4. Agent Manager UI

### Files to Create/Modify

**New File:** `src/vs/sessions/contrib/agentManager/browser/agentManagerView.ts`
- Already created with full UI implementation
- Handles agent list and details panels
- Manages task history display

**Create:** `src/vs/sessions/contrib/agentManager/browser/agentManager.contribution.ts`

```typescript
import { registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { Action2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IMultiAgentOrchestrator } from '../../../services/agents/multiAgentOrchestrator.js';

class ShowAgentManagerAction extends Action2 {
    constructor() {
        super({
            id: 'sessions.agentManager.show',
            title: 'Show Agent Manager',
            category: 'Agent Manager'
        });
    }

    override async run(accessor: ServicesAccessor): Promise<void> {
        const orchestrator = accessor.get(IMultiAgentOrchestrator);
        const panel = vscode.window.createWebviewPanel(
            'agentManager',
            'Agent Manager',
            vscode.ViewColumn.Sidebar
        );
        // ... render agent manager ...
    }
}

registerAction2(ShowAgentManagerAction);
```

### Sidebar Integration

**Modify:** `src/vs/sessions/browser/sessionsSidebar.ts`

```typescript
// Add Agent Manager view to sessions sidebar
private registerAgentManagerView(): void {
    this.viewsRegistry.registerViewContainer(
        {
            id: 'agentManager',
            title: 'Agent Manager',
            icon: '$(robot)',
            ctorDescriptor: new SyncDescriptor(AgentManagerViewContainer)
        },
        ViewContainerLocation.Sidebar
    );
}
```

---

## 5. Enhanced Prompt Timeline

### Files to Modify

**File:** `src/vs/sessions/contrib/promptTimeline/browser/promptTimelineModel.ts`

Add snapshot support:

```typescript
export interface IPromptTimelineSnapshot {
    id: string;
    timestamp: Date;
    promptId: string;
    files: Map<string, string>;
    terminalOutput: string;
}

export class PromptTimelineModel {
    private snapshots: Map<string, IPromptTimelineSnapshot> = new Map();

    addSnapshot(snapshot: IPromptTimelineSnapshot): void {
        this.snapshots.set(snapshot.id, snapshot);
        this._onSnapshotAdded.fire(snapshot);
    }

    getSnapshot(snapshotId: string): IPromptTimelineSnapshot | undefined {
        return this.snapshots.get(snapshotId);
    }

    restoreSnapshot(snapshotId: string): void {
        const snapshot = this.snapshots.get(snapshotId);
        if (snapshot) {
            // Restore files and terminal state
            this._onSnapshotRestored.fire(snapshot);
        }
    }
}
```

**File:** `src/vs/sessions/contrib/promptTimeline/browser/promptTimelineActions.ts`

Add time-travel actions:

```typescript
class TimelineTimeTravel extends Action2 {
    constructor() {
        super({
            id: 'sessions.promptTimeline.timeTravel',
            title: 'Time Travel to Prompt',
            category: 'Chat'
        });
    }

    override async run(accessor: ServicesAccessor): Promise<void> {
        // Show timeline scrubber
        // Allow restoring to any past state
    }
}

class TimelineForkSession extends Action2 {
    constructor() {
        super({
            id: 'sessions.promptTimeline.fork',
            title: 'Fork Session from Here',
            category: 'Chat'
        });
    }

    override async run(accessor: ServicesAccessor): Promise<void> {
        // Create new session branch
        // Copy current state to new session
    }
}
```

---

## 6. Aquarium Integration

### Files to Modify

**File:** `src/vs/sessions/contrib/aquarium/browser/aquariumOverlay.ts`

Connect to Telolexic auditor:

```typescript
export class AquariumService implements IAquariumService {
    private feedCount = 0;
    private streakCount = 0;

    feedFish(pelletCount: number = 1): void {
        this.feedCount += pelletCount;
        this.streakCount++;

        // Update water quality based on streak
        if (this.streakCount > 50) {
            this.waterQuality = 'pristine';
            this.spawnExoticFish();
        } else if (this.streakCount > 10) {
            this.waterQuality = 'crystal';
        }

        // Spawn pellets animation
        this.spawnPellets(pelletCount);
    }

    resetStreak(): void {
        this.streakCount = 0;
        this.waterQuality = 'murky';
    }

    private spawnExoticFish(): void {
        // Generate procedural exotic fish
        const fishSpecies = this.generateExoticSpecies();
        this.addFishToAquarium(fishSpecies);
    }
}
```

**File:** `extensions/telolexic-supervisor/src/extension.ts`

Hook audit results to aquarium:

```typescript
async function auditAndFeed(code: string) {
    const auditor = new TelolexicAuditorAST(code);
    const verdict = auditor.audit();

    if (verdict.verdict === 'Verified') {
        // Feed fish on successful audit
        await vscode.commands.executeCommand('sessions.aquarium.feed', 1);
    } else if (verdict.verdict === 'AnomalyFlagged') {
        // Murky water on dead code
        await vscode.commands.executeCommand('sessions.aquarium.setWaterQuality', 'murky');
    } else if (verdict.verdict === 'PhysicsViolation') {
        // Toxic water on violations
        await vscode.commands.executeCommand('sessions.aquarium.setWaterQuality', 'toxic');
    }
}
```

---

## 7. Testing & Validation

### Unit Tests

**File:** `extensions/telolexic-supervisor/test/telolexia-ast.test.ts`

```typescript
import * as assert from 'assert';
import { TelolexicAuditorAST } from '../src/telolexia-ast';

suite('TelolexicAuditorAST', () => {
    test('should detect verified code', () => {
        const code = `
            const x = 5;
            const y = x + 10;
            console.log(y);
        `;
        const auditor = new TelolexicAuditorAST(code);
        const verdict = auditor.audit();
        assert.strictEqual(verdict.verdict, 'Verified');
    });

    test('should detect dead code', () => {
        const code = `
            const unused = 42;
            const used = 10;
            console.log(used);
        `;
        const auditor = new TelolexicAuditorAST(code);
        const verdict = auditor.audit();
        assert.strictEqual(verdict.verdict, 'AnomalyFlagged');
        assert.ok(verdict.deadCode.some(d => d.name === 'unused'));
    });

    test('should detect unresolved dependencies', () => {
        const code = `
            const x = undefinedVar + 5;
            console.log(x);
        `;
        const auditor = new TelolexicAuditorAST(code);
        const verdict = auditor.audit();
        assert.strictEqual(verdict.verdict, 'PhysicsViolation');
        assert.ok(verdict.unresolvedDependencies.includes('undefinedVar'));
    });
});
```

### Integration Tests

**File:** `test/integration/agentOrchestrator.test.ts`

```typescript
suite('MultiAgentOrchestrator', () => {
    test('should create multiple agents', async () => {
        const orchestrator = new MultiAgentOrchestrator();
        
        const agent1 = await orchestrator.createAgent('Agent 1', 'gpt-4', 'prompt', URI.file('/'));
        const agent2 = await orchestrator.createAgent('Agent 2', 'claude-3', 'prompt', URI.file('/'));
        
        assert.strictEqual(orchestrator.getAllAgents().length, 2);
    });

    test('should execute tasks in parallel', async () => {
        const orchestrator = new MultiAgentOrchestrator();
        const agent = await orchestrator.createAgent('Agent', 'gpt-4', 'prompt', URI.file('/'));
        
        const task1 = orchestrator.executeTask(agent.id, 'Task 1');
        const task2 = orchestrator.executeTask(agent.id, 'Task 2');
        
        const results = await Promise.all([task1, task2]);
        assert.strictEqual(results.length, 2);
    });
});
```

### Manual Testing Checklist

- [ ] AST Auditor correctly parses TypeScript/JavaScript
- [ ] Confidence score updates based on issues
- [ ] Causal visualizer renders interactive graph
- [ ] Dead code pruning removes correct lines
- [ ] Multi-agent creation works
- [ ] Agent status updates in real-time
- [ ] Task artifacts are captured
- [ ] Workspace snapshots are created
- [ ] Time-travel scrubbing works
- [ ] Aquarium pellets spawn on successful audit
- [ ] Water quality changes with code quality

---

## Compilation & Build

### TypeScript Compilation

```bash
# Compile main sources
npm run typecheck-client

# Compile extensions
npm run gulp compile-extensions

# Full build
npm run gulp vscode-win32-x64  # or your target OS
```

### Validation

```bash
# Check for layer violations
npm run valid-layers-check

# Run unit tests
scripts/test.sh

# Run integration tests
scripts/test-integration.sh
```

---

## Deployment

### VS Code Extension Publishing

```bash
# Install vsce
npm install -g @vscode/vsce

# Package extension
vsce package

# Publish to marketplace
vsce publish
```

### Desktop Application

```bash
# Build executable
npm run gulp vscode-win32-x64  # Windows
npm run gulp vscode-darwin-x64  # macOS
npm run gulp vscode-linux-x64   # Linux
```

---

## Troubleshooting

### AST Parsing Issues

If AST parsing fails:
1. Check TypeScript version compatibility
2. Verify file encoding is UTF-8
3. Check for syntax errors in source code

### Visualizer Not Showing

If D3.js visualization doesn't render:
1. Check webview security settings
2. Verify D3.js CDN is accessible
3. Check browser console for errors

### Agent Orchestration Issues

If agents don't execute:
1. Verify LLM provider is running (Ollama, etc.)
2. Check agent workspace permissions
3. Review task queue status

---

## Performance Optimization

### AST Parsing Performance

```typescript
// Use incremental parsing for large files
if (code.length > 50000) {
    // Parse in chunks
    const chunks = code.split('\n').reduce((acc, line, i) => {
        if (i % 100 === 0) acc.push([]);
        acc[acc.length - 1].push(line);
        return acc;
    }, []);
    
    for (const chunk of chunks) {
        await this.parseChunk(chunk.join('\n'));
    }
}
```

### Visualization Optimization

```typescript
// Use canvas rendering for large graphs
if (visualization.nodes.length > 100) {
    useCanvasRenderer();
} else {
    useSVGRenderer();
}
```

---

## Next Steps

1. **Integrate AST Auditor** into existing extension
2. **Test Causal Visualizer** with real code samples
3. **Deploy Multi-Agent Orchestrator** service
4. **Build Agent Manager UI** into sessions window
5. **Connect Prompt Timeline** to snapshots
6. **Finalize Aquarium** gamification loop
7. **Publish to VS Code Marketplace**

---

## Support & Documentation

For questions or issues:
1. Check the IMPROVEMENTS.md file
2. Review test cases for usage examples
3. Consult VS Code extension documentation
4. Open GitHub issues for bugs

