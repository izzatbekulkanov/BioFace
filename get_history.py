import json
import sys

def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    log_path = r'C:\Users\user\.gemini\antigravity\brain\26460edb-353b-4332-877e-5879f863ce01\.system_generated\logs\transcript.jsonl'
    user_inputs = []
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if data.get('type') == 'USER_INPUT':
                    user_inputs.append(data.get('content', ''))
            except Exception as e:
                pass
    
    print("--- LAST 15 USER INPUTS ---")
    for idx, content in enumerate(user_inputs[-15:]):
        # replace problematic unicode chars for printing
        safe_content = content.strip().encode('utf-8', errors='replace').decode('utf-8')
        print(f"{idx+1}. {safe_content}")

if __name__ == '__main__':
    main()
