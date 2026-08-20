# AI-IDE Strategic Roadmap: Surpassing Cursor & Antigravity

Our platform possesses three unique architectural baselines that neither Cursor nor Antigravity can match:
1. **The Agents Window (`src/vs/sessions`)**: A dedicated, simplified, fixed-layout workbench built specifically for agentic sessions rather than standard editor tasks.
2. **The Telolexic Supervisor (`extensions/telolexic-supervisor`)**: A mathematically-grounded code validation engine running the **Vilomapatha Protocol (TAP-2.0)** to recursively trace variables backward and prove causal soundess.
3. **The Aquarium & Prompt Timeline (`src/vs/sessions/contrib/...`)**: Features designed for deep developer engagement, visual feedback, and temporal prompt scrubbing.

By integrating these disparate layers, we can build a uniquely advanced, visually stunning AI-IDE. Below are the three killer features designed to surpass the competition.

---

## 1. The Telolexic Causal Audit Visualizer
*Target: Outpacing Cursor's black-box code insertion with verifiable, transparent AI reasoning.*

### The Concept
When an LLM writes code, Cursor inserts it as a blind text diff. Our IDE will render a **Causal Audit Flow Diagram** directly inside the Sessions Window.

### Architecture & UI
* **Causal Extraction**: The `TelolexicAuditor` (in `telolexia.ts`) already parses identifiers and matches successors to precursors. We will serialize this binding map into a dataflow graph.
* **Flow Canvas**: A webview or lightweight SVG canvas rendered side-by-side with the diff editor.
* **Nodes & Edges**:
  * **Green Nodes/Paths**: Fully verified, grounded, and active variable lifecycles.
  * **Orange Badges (Exigenesis Warnings)**: Dead variables and unused branches. Clicking an orange node offers an automated "Prune Dead Branch" action to clean the code before injection.
  * **Red Flashing Connections (Causal Breaches)**: Unresolved dependencies or hallucinated imports. The exact line of code where the LLM referenced an uninitialized symbol flashes red, allowing developers to see the exact point of failure.

---

## 2. Gamified Verification: The "Telolexic Aquarium"
*Target: Turning boring refactoring, testing, and AI-auditing into an engaging, visual game.*

### The Concept
The existing Aquarium easter egg (`contrib/aquarium`) will be wired directly to the `TelolexicSupervisor` extension. Developer coding hygiene and AI code validation are gamified in real-time.

### Integration Path
1. **The Feed Event**: We will expose a built-in command `sessions.aquarium.feed` that registers with `IAquariumService`.
2. **Earning Pellets**: 
   * Running a successful code generation and passing the Telolexic Causal Audit awards **fish food pellets** directly into the active editor background.
   * Manually refactoring/pruning exigenesis anomalies (dead code) increases the **Fish Feeding Streak** (`sessions.aquarium.streak.count`).
3. **Water Quality & Fish States**:
   * **Murky Waters**: If the developer bypasses Telolexic warnings and inserts anomalous or unchecked code, the Aquarium water becomes murky (the background CSS overlay shifts to a dark, turbid green-brown hue), and the fish enter their "sluggish/slanted" or "panic" swim cycles.
   * **Crystal Clear**: Pruning anomalies and passing audits restores water quality, turning the background into a gorgeous, crystal-clear blue, making the fish dart and swim with active, vibrant animations.
   * **Exotic Species**: Reaching a high feeding streak unlocks rare, procedurally generated exotic fish species in the background water.

---

## 3. Agentic Time-Travel Playgrounds
*Target: Eliminating the linear constraints of typical chat boxes.*

### The Concept
The `PromptTimelineWidget` (which overlays tick marks on the chat transcript) will be expanded into a interactive temporal scrub bar allowing full-system time travel.

### Implementation Path
1. **State Snapshots**: Every time an agent takes a turn (runs a command, edits a file, runs a test), we save a virtual snapshot of the workspace and terminal logs.
2. **Scrubbable Workspace**: Dragging the timeline thumb scrubs the entire workbench. The file editors instantly display read-only virtual diffs of the files at that exact historical moment, alongside the exact command output of that step.
3. **Branching Agent Sessions (Prompt-Level Forking)**: While scrubbing a past step, a developer can click a "Fork Session from Here" button. This launches a new session branch in the layout grid, allowing them to try a different prompt or modify the system instruction, effectively managing agent execution like a Git branch.
