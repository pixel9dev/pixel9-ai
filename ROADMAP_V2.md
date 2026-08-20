# Pixel AI 2.0: The Self-Healing IDE

## Goal: Surpassing Cursor 2.0 and Antigravity 2.7

While Cursor and Antigravity focus on faster models and chat interfaces, Pixel AI 2.0 focuses on **Autonomous Verification** and **Visual Grounding**. We are moving from an "AI-assisted editor" to a "Self-Healing Software Factory."

---

## 1. Telolexic Auto-Repair (Self-Healing Loops)
*Target: Surpassing Cursor's manual iteration by automating the Fix-Test-Audit loop.*

### The Concept
When an agent generates code, it doesn't just stop at the editor. It enters a **Self-Correction Loop**.
1. **Generation**: Agent A writes the code.
2. **Audit**: Telolexic Supervisor runs a TAP-3.0 AST audit.
3. **Execution**: The IDE automatically runs `npm test` or the relevant test suite.
4. **Correction**: If the audit fails or tests fail, Agent B (The Auditor) feeds the error back to Agent A with the exact AST node that failed.
5. **Finalization**: Code is only injected when it passes both the audit and the tests.

---

## 2. The Aquarium Browser (Visual Grounding)
*Target: Providing agents with "Eyes" that Cursor and Antigravity lack.*

### The Concept
An embedded, agent-controlled Chromium browser that is deeply integrated into the Sessions Window.
* **DOM Inspection**: The agent can inspect the DOM of the application it just built.
* **Visual Verification**: The agent takes screenshots of the UI and compares them against the design requirements.
* **Interactive Debugging**: If a button doesn't work, the agent can "click" it in the browser, see the console error, and fix the code in real-time.
* **Aquarium Integration**: The browser background becomes the "water" for the Aquarium fish, making the UI development process fully immersive.

---

## 3. Telolexic Tab (Causal Predictions)
*Target: Beating Cursor Tab with "Causal Awareness" instead of just "Text Prediction".*

### The Concept
While Cursor Tab predicts the next characters, **Telolexic Tab** predicts the next **Causal Binding**.
* **Context Awareness**: It knows that if you changed a variable in `auth.ts`, you likely need to update the dependency in `login.tsx`.
* **Ghost Edits**: It suggests multi-file changes simultaneously based on the Vilomapatha Protocol's causal chains.
* **Zero-Hallucination**: It only suggests edits that pass the internal AST check.

---

## 4. Pixel Router (Mixture of Agents)
*Target: Leveraging the best models for the best tasks.*

### The Concept
A dynamic routing layer that orchestrates different models:
* **Gemini 3 Pro**: For 2M+ token context codebase analysis.
* **Claude 5 Opus**: For complex logic and architectural changes.
* **Local Llama 3 (Ollama)**: For fast, private Telolexic audits and simple refactoring.
* **Grok 3**: For real-time web search and documentation fetching.

---

## 5. Pixel Governance (.pixelrules)
*Target: Automated, project-specific agent behavior.*

### The Concept
An AI that monitors the developer's manual edits and automatically generates a `.pixelrules` file.
* **Style Enforcement**: "Developer always uses functional components; I will do the same."
* **Security Rules**: "Project forbids direct SQL queries; I will always use the Drizzle ORM."
* **Auto-Documentation**: The agent automatically documents the "why" behind every rule it creates.

---

## Implementation Priority
1. **Phase 1**: **Telolexic Auto-Repair** (Integrating tests into the agent loop).
2. **Phase 2**: **Aquarium Browser** (Embedded agentic browser).
3. **Phase 3**: **Telolexic Tab** (Causal ghost edits).
