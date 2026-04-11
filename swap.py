import re

with open('main.py', 'r', encoding='utf-8') as f:
    orig = f.read()

# Find log_requests
log_req_match = re.search(r'@app\.middleware\("http"\)\s*async def log_requests[\s\S]*?return response\s*\n\n', orig)
if log_req_match:
    log_req_str = log_req_match.group(0)
    
    clean_orig = orig.replace(log_req_str, '')
    
    auth_req_match = re.search(r'@app\.middleware\("http"\)\s*async def require_auth[\s\S]*?return response\s*\n\n', clean_orig)
    if auth_req_match:
        auth_req_str = auth_req_match.group(0)
        final_orig = clean_orig.replace(auth_req_str, auth_req_str + '\n' + log_req_str)
        
        with open('main.py', 'w', encoding='utf-8') as f:
            f.write(final_orig)
            print('Swapped successfully')
    else:
        print("auth_req not found")
else:
    print("log_req not found")
