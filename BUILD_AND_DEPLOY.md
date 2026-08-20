# Pixel AI - Build & Deployment Guide

## Prerequisites

Before building Pixel AI with the new improvements, ensure you have:

1. **Node.js** - v18 or higher
2. **npm** - v8 or higher
3. **Python** - v3.8+ (for some build scripts)
4. **Git** - Latest version
5. **Visual Studio Code** - Latest version (for testing)

---

## Step 1: Install Dependencies

### Main Project Dependencies
```bash
cd /mnt/desktop/AI-IDE-MANUS/AI-IDE

# Install root dependencies
npm install

# Install extension dependencies
cd extensions/telolexic-supervisor
npm install
cd ../..
```

### New Dependencies Added
The following packages are now included:
- `d3@^7.8.0` - Interactive graph visualization
- `@types/d3@^7.4.0` - TypeScript types for D3.js

These are automatically installed with `npm install`.

---

## Step 2: Verify TypeScript Configuration

Ensure all new files are properly recognized by TypeScript:

```bash
# Check TypeScript compilation
npm run typecheck-client

# Expected output: No errors
```

### Common Issues

**Issue:** `Cannot find module 'telolexia-ast'`
- **Solution:** Ensure `extensions/telolexic-supervisor/src/telolexia-ast.ts` exists
- **Check:** `ls -la extensions/telolexic-supervisor/src/telolexia-ast.ts`

**Issue:** `D3 types not found`
- **Solution:** Run `npm install @types/d3@^7.4.0` in extension directory
- **Check:** `grep "@types/d3" extensions/telolexic-supervisor/package.json`

---

## Step 3: Compile Extensions

### Compile Telolexic Supervisor Extension
```bash
cd extensions/telolexic-supervisor

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

cd ../..
```

### Compile Main Sources
```bash
# Compile all client code
npm run gulp compile-client

# Compile extensions
npm run gulp compile-extensions

# Full compilation
npm run gulp compile
```

---

## Step 4: Build Desktop Application

### Windows Build
```bash
npm run gulp vscode-win32-x64

# Output: out/vscode-win32-x64/
# Executable: out/vscode-win32-x64/Code.exe
```

### macOS Build
```bash
npm run gulp vscode-darwin-x64

# Output: out/vscode-darwin-x64/
# Executable: out/vscode-darwin-x64/Electron
```

### Linux Build
```bash
npm run gulp vscode-linux-x64

# Output: out/vscode-linux-x64/
# Executable: out/vscode-linux-x64/code
```

### Build Time
- **First build:** 15-30 minutes (depends on system)
- **Incremental build:** 2-5 minutes

---

## Step 5: Validate Build

### Layer Validation
```bash
npm run valid-layers-check

# Expected output: ✓ All layer checks passed
```

### Extension Validation
```bash
# Check extension manifest
npm run gulp validate-extensions

# Expected output: ✓ All extensions valid
```

### TypeScript Validation
```bash
npm run typecheck-client

# Expected output: ✓ No type errors
```

---

## Step 6: Run Tests

### Unit Tests
```bash
# Run all unit tests
scripts/test.sh

# Run specific test file
npm test -- src/vs/sessions/services/agents/multiAgentOrchestrator.test.ts
```

### Integration Tests
```bash
# Run integration tests
scripts/test-integration.sh

# Run specific integration test
npm test -- test/integration/agentOrchestrator.test.ts
```

### Test Coverage
```bash
# Generate coverage report
npm run test:coverage

# Output: coverage/index.html
```

---

## Step 7: Local Testing

### Run Development Build
```bash
# Start development build with watch mode
npm run watch

# In another terminal, run the application
./out/vscode-win32-x64/Code.exe  # Windows
./out/vscode-darwin-x64/Electron  # macOS
./out/vscode-linux-x64/code       # Linux
```

### Test New Features

1. **AST Auditor**
   - Open a TypeScript/JavaScript file
   - Select some code
   - Run command: `Telolexia: Audit with TAP-3.0 (AST-based)`
   - Verify causal visualizer opens

2. **Multi-Agent Orchestrator**
   - Open Agent Manager: `Agent Manager: Show Agent Manager`
   - Click "Create New Agent"
   - Verify agent appears in list

3. **Aquarium Gamification**
   - Generate code that passes audit
   - Verify fish feed and water turns crystal
   - Generate code with dead code
   - Verify water turns murky

4. **Time-Travel**
   - Run multiple prompts in chat
   - Open prompt timeline
   - Run command: `Chat: Time Travel to Prompt`
   - Verify workspace restores

---

## Step 8: Package Extension

### Package Telolexic Supervisor Extension
```bash
cd extensions/telolexic-supervisor

# Install vsce globally (if not already installed)
npm install -g @vscode/vsce

# Package extension
vsce package

# Output: telolexic-supervisor-1.0.0.vsix

cd ../..
```

### Package Size
- **Typical size:** 5-15 MB
- **Includes:** Compiled code, dependencies, media assets

---

## Step 9: Publish to VS Code Marketplace

### Prerequisites
1. Create VS Code Marketplace account at https://marketplace.visualstudio.com
2. Create Personal Access Token (PAT)
3. Store PAT securely

### Publish Extension
```bash
cd extensions/telolexic-supervisor

# Login to marketplace
vsce login pixel9

# Enter your PAT when prompted

# Publish extension
vsce publish

# Output: Published successfully!

cd ../..
```

### Update Extension
```bash
# Update version in package.json
# Then publish with new version
vsce publish patch  # or minor, major
```

---

## Step 10: Create Release Build

### Create Release Tag
```bash
# Tag the release
git tag -a v1.1.0 -m "Release v1.1.0 with TAP-3.0 improvements"

# Push tag to repository
git push origin v1.1.0
```

### Generate Release Notes
```bash
# Generate changelog
npm run changelog

# Output: CHANGELOG.md
```

### Create GitHub Release
1. Go to https://github.com/pixel9/AI-IDE-MANUS/releases
2. Click "New release"
3. Select tag: v1.1.0
4. Add release notes from CHANGELOG.md
5. Upload binaries:
   - `out/vscode-win32-x64/Code.exe`
   - `out/vscode-darwin-x64/Electron`
   - `out/vscode-linux-x64/code`

---

## Troubleshooting

### Build Fails with "Cannot find module"

**Solution:**
```bash
# Clean build
npm run clean

# Reinstall dependencies
npm install

# Rebuild
npm run gulp compile
```

### Extension Not Loading

**Check:**
```bash
# Verify extension is compiled
ls -la extensions/telolexic-supervisor/out/

# Verify manifest
cat extensions/telolexic-supervisor/package.json | grep -A5 '"main"'

# Check for errors in VS Code output
Help > Toggle Developer Tools > Console tab
```

### Type Errors During Compilation

**Solution:**
```bash
# Check TypeScript version
npm list typescript

# Ensure version matches
npm install typescript@5.1.3

# Recompile
npm run typecheck-client
```

### Performance Issues

**Optimize:**
```bash
# Build with optimizations
npm run gulp vscode-win32-x64 --release

# This creates a release build with optimizations
```

---

## Continuous Integration

### GitHub Actions Workflow

Create `.github/workflows/build.yml`:

```yaml
name: Build and Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Compile
      run: npm run gulp compile
    
    - name: Type check
      run: npm run typecheck-client
    
    - name: Run tests
      run: npm test
    
    - name: Validate layers
      run: npm run valid-layers-check
```

---

## Performance Benchmarks

### Build Times (First Build)
- **Windows:** 20-30 minutes
- **macOS:** 15-25 minutes
- **Linux:** 10-20 minutes

### Build Times (Incremental)
- **Typical change:** 2-5 minutes
- **Extension only:** 30 seconds - 2 minutes

### Runtime Performance
- **AST parsing:** < 100ms for typical files
- **Visualization rendering:** < 500ms for 100 nodes
- **Agent creation:** < 1 second
- **Snapshot creation:** < 500ms

---

## Deployment Checklist

- [ ] All dependencies installed
- [ ] TypeScript compilation successful
- [ ] All tests passing
- [ ] Layer validation passing
- [ ] Extension validation passing
- [ ] Local testing completed
- [ ] Extension packaged
- [ ] Extension published to marketplace
- [ ] Release tag created
- [ ] GitHub release created
- [ ] Release notes updated
- [ ] Binaries uploaded

---

## Support

For build issues:
1. Check the troubleshooting section above
2. Review VS Code build documentation: https://github.com/microsoft/vscode/wiki/How-to-Contribute
3. Check extension development guide: https://code.visualstudio.com/api
4. Open GitHub issue with build logs

---

## Next Steps

After successful build and deployment:

1. **Monitor Usage**
   - Track installation numbers
   - Monitor error reports
   - Collect user feedback

2. **Iterate**
   - Fix reported bugs
   - Implement requested features
   - Optimize performance

3. **Future Releases**
   - Plan v1.2.0 with browser automation
   - Plan v1.3.0 with team collaboration
   - Plan v1.4.0 with custom extensions

