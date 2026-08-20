// The Telolexic Method: Reverse Audit Protocol
import * as vscode from 'vscode';

export interface TAPVerdict {
    protocol: string;
    verdict: 'Verified' | 'AnomalyFlagged' | 'PhysicsViolation';
    anchor_state: string;
    audit_direction: string;
    timestamp: string;
    details: string;
    unresolved_dependencies?: string[];
    dead_variables?: string[];
}

export interface LineData {
    text: string;
    originalIndex: number;
    definitions: string[];
    usages: string[];
    status: 'verified' | 'exigenesis' | 'unresolved' | 'normal';
}

export interface ConnectionData {
    fromLine: number; // originalIndex where defined (or -1 if unresolved)
    toLine: number;   // originalIndex where used
    identifier: string;
    status: 'verified' | 'exigenesis' | 'unresolved';
}

export interface AuditDetails {
    verdict: 'Verified' | 'AnomalyFlagged' | 'PhysicsViolation';
    details: string;
    lines: LineData[];
    connections: ConnectionData[];
}

export class TelolexicAuditor {
    
    // JS/TS language keywords to ignore during identifier extraction
    private static KEYWORDS = new Set([
        'function', 'const', 'let', 'var', 'return', 'class', 'import', 'export',
        'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'switch', 'case',
        'default', 'try', 'catch', 'finally', 'throw', 'new', 'typeof', 'instanceof',
        'in', 'of', 'this', 'super', 'true', 'false', 'null', 'undefined', 'async',
        'await', 'require', 'module', 'exports', 'from'
    ]);

    // Common global built-ins to assume are pre-defined (resolved precursors)
    private static BUILT_INS = new Set([
        'console', 'log', 'error', 'info', 'warn', 'Math', 'JSON', 'Object', 'Array',
        'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'Promise', 'process',
        'global', 'window', 'document', 'setTimeout', 'clearTimeout', 'setInterval',
        'clearInterval', 'fetch', 'Headers', 'Request', 'Response'
    ]);

    /**
     * Performs an inverse-recursive causal audit of code using the Vilomapatha protocol.
     * @param code The JS/TS code to audit
     * @returns A TAPVerdict JSON object
     */
    public static auditCode(code: string): TAPVerdict {
        const rawLines = code.split('\n');
        const lines: { text: string; originalIndex: number }[] = [];
        
        // Filter empty lines and comments
        for (let i = 0; i < rawLines.length; i++) {
            const trimmed = rawLines[i].trim();
            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
                lines.push({ text: trimmed, originalIndex: i });
            }
        }

        const timestamp = new Date().toISOString();

        if (lines.length === 0) {
            return {
                protocol: "TAP-2.0",
                verdict: "Verified",
                anchor_state: "Empty",
                audit_direction: "inverse",
                timestamp,
                details: "No executable code lines found to audit."
            };
        }

        // 1. Terminal Anchoring (Anchor on the final state change or return)
        const terminalLine = lines[lines.length - 1];
        const anchor_state = `Line ${terminalLine.originalIndex + 1}: "${terminalLine.text}"`;

        const required: Set<string> = new Set();
        const declared: Set<string> = new Set();
        const used: Set<string> = new Set();

        let deadVariables: string[] = [];

        // 2. Inverse Iteration (Vilomapatha Loop)
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            const text = line.text;

            // Extract defined identifiers on this line (const, let, var, function, class)
            const defines = this.extractDefinitions(text);
            
            // Extract all alphanumeric words as potential usages
            const words = this.extractIdentifiers(text);

            // Causal tracking logic:
            // 1. If a variable is declared/defined on this line, check if it was needed downstream.
            for (const d of defines) {
                declared.add(d);
                if (required.has(d)) {
                    // Causal loop satisfied: required dependency is resolved!
                    required.delete(d);
                } else {
                    // Exigenesis Check: If defined but never required by downstream states,
                    // and it's not the terminal anchor variable, it represents a causal anomaly (dead code or hallucinated branch)
                    if (i !== lines.length - 1) {
                        deadVariables.push(`${d} (declared at line ${line.originalIndex + 1})`);
                    }
                }
            }

            // 2. Add used identifiers on this line (excluding keywords, built-ins, and local defines) to the required set
            for (const w of words) {
                if (!defines.has(w) && !this.KEYWORDS.has(w) && !this.BUILT_INS.has(w) && !/^\d+$/.test(w)) {
                    required.add(w);
                    used.add(w);
                }
            }
        }

        // Check if there are any remaining unresolved required variables at the very top (Causal Breach)
        // These are variables used in the code but never defined anywhere in the sequence
        const unresolved = Array.from(required).filter(r => !declared.has(r));

        if (unresolved.length > 0) {
            return {
                protocol: "TAP-2.0",
                verdict: "PhysicsViolation",
                anchor_state,
                audit_direction: "inverse",
                timestamp,
                details: `Causal Break (Hallucination): The following dependencies were used but never declared or initialized in the code: ${unresolved.join(', ')}`,
                unresolved_dependencies: unresolved
            };
        }

        if (deadVariables.length > 0) {
            return {
                protocol: "TAP-2.0",
                verdict: "AnomalyFlagged",
                anchor_state,
                audit_direction: "inverse",
                timestamp,
                details: `Exigenesis Anomaly: The following variables are declared but never utilized in any downstream terminal calculations: ${deadVariables.join(', ')}`,
                dead_variables: deadVariables
            };
        }

        return {
            protocol: "TAP-2.0",
            verdict: "Verified",
            anchor_state,
            audit_direction: "inverse",
            timestamp,
            details: `Causal verification complete. All ${lines.length} lines are fully grounded with clean precursor-successor structures.`
        };
    }

    /**
     * Performs a detailed, line-by-line causal audit of the code and maps precursors and successors.
     * This is used by the visualizer Webview to render bezier-curve bindings and enable inline pruning.
     */
    public static getAuditData(code: string): AuditDetails {
        const rawLines = code.split('\n');
        const lines: LineData[] = [];
        
        // Parse all lines including empty and comments so line indices line up perfectly with editor
        for (let i = 0; i < rawLines.length; i++) {
            const text = rawLines[i];
            const trimmed = text.trim();
            const isIgnored = !trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
            
            const defs = isIgnored ? new Set<string>() : this.extractDefinitions(text);
            const idents = isIgnored ? new Set<string>() : this.extractIdentifiers(text);
            const usages: string[] = [];
            
            for (const id of idents) {
                if (!defs.has(id) && !this.KEYWORDS.has(id) && !this.BUILT_INS.has(id) && !/^\d+$/.test(id)) {
                    usages.push(id);
                }
            }

            lines.push({
                text,
                originalIndex: i,
                definitions: Array.from(defs),
                usages,
                status: 'normal'
            });
        }

        // Downstream tracking maps variable -> line indexes where it was requested
        const activeRequests: Map<string, number[]> = new Map();
        const connections: ConnectionData[] = [];
        const declared = new Set<string>();

        // Loop backward (Vilomapatha Loop) to build connections
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            
            // 1. Process definitions: resolve active requests
            for (const d of line.definitions) {
                declared.add(d);
                const consumers = activeRequests.get(d);
                if (consumers && consumers.length > 0) {
                    for (const consumerLine of consumers) {
                        connections.push({
                            fromLine: i,
                            toLine: consumerLine,
                            identifier: d,
                            status: 'verified'
                        });
                    }
                    activeRequests.delete(d);
                    line.status = 'verified';
                } else {
                    // Exigenesis check: Defined but never requested downstream
                    line.status = 'exigenesis';
                    connections.push({
                        fromLine: i,
                        toLine: -1,
                        identifier: d,
                        status: 'exigenesis'
                    });
                }
            }

            // 2. Process usages: add to active requests
            for (const u of line.usages) {
                let list = activeRequests.get(u);
                if (!list) {
                    list = [];
                    activeRequests.set(u, list);
                }
                list.push(i);
            }
        }

        // Remaining active requests after loop are unresolved (Causal Breaches)
        for (const [identifier, consumerLines] of activeRequests.entries()) {
            for (const consumerLine of consumerLines) {
                connections.push({
                    fromLine: -1,
                    toLine: consumerLine,
                    identifier,
                    status: 'unresolved'
                });
                lines[consumerLine].status = 'unresolved';
            }
        }

        // Assign line-level status based on connections and overall audit
        let exigenesisCount = 0;
        let unresolvedCount = 0;

        for (const conn of connections) {
            if (conn.status === 'exigenesis') {
                exigenesisCount++;
            } else if (conn.status === 'unresolved') {
                unresolvedCount++;
            }
        }

        let verdict: 'Verified' | 'AnomalyFlagged' | 'PhysicsViolation' = 'Verified';
        let details = "Causal verification complete. All lines are fully grounded with clean precursor-successor structures.";

        if (unresolvedCount > 0) {
            verdict = 'PhysicsViolation';
            details = `Causal Break (Hallucination): ${unresolvedCount} unresolved variables detected. The AI referenced variables before they were declared.`;
        } else if (exigenesisCount > 0) {
            verdict = 'AnomalyFlagged';
            details = `Exigenesis Anomaly: ${exigenesisCount} unused definitions detected. Click any yellow line/node in the diagram to automatically prune it.`;
        }

        return {
            verdict,
            details,
            lines,
            connections
        };
    }

    /**
     * Extracts variable, function, or class declaration identifiers from a line.
     */
    private static extractDefinitions(line: string): Set<string> {
        const defs: Set<string> = new Set();
        
        // Match: const x = ..., let [y, z] = ..., function foo(bar), class Baz
        const declPatterns = [
            /(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
            /function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
            /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
        ];

        for (const pattern of declPatterns) {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                if (match[1]) {
                    defs.add(match[1]);
                }
            }
        }

        return defs;
    }

    /**
     * Extracts all general alphanumeric identifier words from a line.
     */
    private static extractIdentifiers(line: string): Set<string> {
        const idents: Set<string> = new Set();
        const matches = line.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
        if (matches) {
            for (const m of matches) {
                idents.add(m);
            }
        }
        return idents;
    }
}
