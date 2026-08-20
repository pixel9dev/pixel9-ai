import subprocess
import sys
import json

def test_agent(code, expected_valid):
    result = subprocess.run(
        ["python", "telolexia_agent.py", code],
        capture_output=True,
        text=True
    )
    
    try:
        data = json.loads(result.stdout)
        print(f"Test Code:\n{code}")
        print(f"Output: {data.get('details', '')}")
        is_valid = data.get('verdict') == 'Verified'
        if is_valid == expected_valid:
            print("=> TEST PASSED\n")
        else:
            print(f"=> TEST FAILED (Expected {expected_valid}, got {is_valid})\n")
    except Exception as e:
        print(f"Error parsing JSON: {e}")
        print(f"Raw output: {result.stdout}")
        print(f"Stderr: {result.stderr}")

if __name__ == "__main__":
    clean_code = """def hello():
    print("Hello world")

hello()
"""
    
    hallucinated_code = """def fetch_data():
    data = hallucinated_db_lookup()
    return data
    """
    
    print("--- Running Clean Code Test ---")
    test_agent(clean_code, True)
    
    print("--- Running Hallucinated Code Test ---")
    test_agent(hallucinated_code, False)
