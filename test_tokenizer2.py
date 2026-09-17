import re

text = """
const msg = `The user_id is ${userId}`;
const data = { user_id: "test" };
body: JSON.stringify({ user_id: userId })
let scan_id = url.searchParams.get('scan_id');
if (row.created_at)
// check user_id
/* user_id */
<!-- user_id -->
<a href="/test?user_id={user_id}">
"""

mapping = {
    'user_id': 'userId',
    'created_at': 'createdAt',
    'scan_id': 'scanId'
}

def replace_safely(content, mapping):
    out = []
    for word in re.finditer(r'[a-zA-Z0-9_]+|\W+', content):
        token = word.group(0)
        if token in mapping:
            start = word.start()
            end = word.end()
            
            prev_char = ''
            for i in range(start-1, -1, -1):
                if not content[i].isspace():
                    prev_char = content[i]
                    break
            
            next_char = ''
            for i in range(end, len(content)):
                if not content[i].isspace():
                    next_char = content[i]
                    break
                    
            if prev_char in ("'", '"', '`') or next_char in ("'", '"', '`'):
                out.append(token)
                continue
                
            if prev_char in ('?', '&') and next_char == '=':
                out.append(token)
                continue
                
            out.append(mapping[token])
        else:
            out.append(token)
            
    return "".join(out)

print(replace_safely(text, mapping))
