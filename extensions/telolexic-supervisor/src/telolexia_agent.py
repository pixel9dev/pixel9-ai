import sys
import json
import re
from datetime import datetime

# Python language keywords to ignore during identifier extraction
KEYWORDS = {
    'def', 'class', 'import', 'from', 'as', 'return', 'if', 'elif', 'else',
    'for', 'while', 'break', 'continue', 'try', 'except', 'finally', 'raise',
    'assert', 'with', 'lambda', 'pass', 'global', 'nonlocal', 'True', 'False',
    'None', 'and', 'or', 'not', 'is', 'in', 'yield'
}

# Python built-ins to assume are pre-resolved precursor states
BUILT_INS = {
    'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set',
    'tuple', 'bool', 'open', 'sum', 'min', 'max', 'any', 'all', 'map', 'filter',
    'zip', 'enumerate', 'abs', 'round', 'type', 'isinstance', 'dir', 'vars',
    'globals', 'locals', 'super', 'self'
}

def backward_audit(code: str) -> dict:
    """
    Implements the Vilomapatha Reverse-Audit Protocol in Python.
    Parses code backward from the terminal anchor to ensure strict causal integrity.
    """
    raw_lines = code.split('\n')
    lines = []
    
    # Filter empty lines and comments
    for i, raw_line in enumerate(raw_lines):
        trimmed = raw_line.strip()
        if trimmed and not trimmed.startswith('#') and not trimmed.startswith('"""') and not trimmed.startswith("'''"):
            lines.append({'text': trimmed, 'original_index': i})
            
    timestamp = datetime.utcnow().isoformat() + 'Z'
    
    if not lines:
        return {
            "protocol": "TAP-2.0",
            "verdict": "Verified",
            "anchor_state": "Empty",
            "audit_direction": "inverse",
            "timestamp": timestamp,
            "details": "No executable code lines found to audit."
        }
        
    # 1. Terminal Anchoring (Start from final line)
    terminal_line = lines[-1]
    anchor_state = f"Line {terminal_line['original_index'] + 1}: \"{terminal_line['text']}\""
    
    required = set()
    declared = set()
    dead_variables = []
    
    # 2. Inverse Iteration (Vilomapatha Loop)
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i]
        text = line['text']
        
        # Remove string literals to avoid parsing words inside strings as variables
        clean_text = re.sub(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'', '', text)
        
        # Extract defined variables in Python (assignments or func/class headers)
        defines = set()
        
        # Pattern 1: Variable assignments (e.g., x = 10 or x, y = ...)
        if '=' in clean_text and not clean_text.startswith('if ') and not clean_text.startswith('while '):
            left_side = clean_text.split('=')[0]
            for word in re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', left_side):
                if word not in KEYWORDS and word not in BUILT_INS:
                    defines.add(word)
                    
        # Pattern 2: Functions and classes definitions
        for word in re.findall(r'\bdef\s+([a-zA-Z_][a-zA-Z0-9_]*)\b', clean_text):
            defines.add(word)
        for word in re.findall(r'\bclass\s+([a-zA-Z_][a-zA-Z0-9_]*)\b', clean_text):
            defines.add(word)
            
        # Extract general alphanumeric words on this line
        words = set(re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', clean_text))
        
        # Causal checking logic:
        # Resolve required dependencies if defined on this line
        for d in defines:
            declared.add(d)
            if d in required:
                required.remove(d)
            else:
                # Exigenesis check
                if i != len(lines) - 1:
                    dead_variables.append(f"{d} (declared at line {line['original_index'] + 1})")
                    
        # Accumulate used dependencies that need an earlier declaration/precursor
        for w in words:
            if w not in defines and w not in KEYWORDS and w not in BUILT_INS:
                required.add(w)
                
    # Check for missing precursor inputs at the top of the file
    unresolved = [r for r in required if r not in declared]
    
    if unresolved:
        return {
            "protocol": "TAP-2.0",
            "verdict": "PhysicsViolation",
            "anchor_state": anchor_state,
            "audit_direction": "inverse",
            "timestamp": timestamp,
            "details": f"Causal Break (Hallucination): The following dependencies were used but never declared or initialized in the code: {', '.join(unresolved)}",
            "unresolved_dependencies": unresolved
        }
        
    if dead_variables:
        return {
            "protocol": "TAP-2.0",
            "verdict": "AnomalyFlagged",
            "anchor_state": anchor_state,
            "audit_direction": "inverse",
            "timestamp": timestamp,
            "details": f"Exigenesis Anomaly: The following variables are declared but never utilized in any downstream terminal calculations: {', '.join(dead_variables)}",
            "dead_variables": dead_variables
        }
        
    return {
        "protocol": "TAP-2.0",
        "verdict": "Verified",
        "anchor_state": anchor_state,
        "audit_direction": "inverse",
        "timestamp": timestamp,
        "details": f"Causal verification complete. All {len(lines)} lines are fully grounded with clean precursor-successor structures."
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "protocol": "TAP-2.0",
            "verdict": "PhysicsViolation",
            "details": "No code provided",
            "timestamp": datetime.utcnow().isoformat() + 'Z'
        }))
        sys.exit(1)
        
    code_to_audit = sys.argv[1]
    result = backward_audit(code_to_audit)
    print(json.dumps(result, indent=2))
