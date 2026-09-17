import re

text = """
const user_id = formData.get('user_id');
let created_at = row.created_at;
const { display_name, avatar_id } = user;
fetch(`/api/test?user_id=${user_id}`)
console.log("user_id");
<div class="user_id" id='user_id'>
obj.user_id = 123;
user_id: user_id
"""

mapping = {
    'user_id': 'userId',
    'created_at': 'createdAt',
    'display_name': 'displayName',
    'avatar_id': 'avatarId'
}

def replace_safely(content, mapping):
    # We will tokenzie the content into:
    # 1. Strings (single, double, backticks)
    # 2. HTML attributes (name="value")
    # 3. Everything else
    
    # This regex matches strings (taking escaping into account)
    # and HTML tags or anything that looks like one.
    # Actually, a simpler way is to just match strings and skip them.
    # What about template literals? `?user_id=${user_id}`
    # The backtick string is `...`. We should skip the text parts, but process inside `${...}`.
    
    # A robust way without a full parser:
    # Use a regex that replaces `\b(snake_case)\b` ONLY IF it is not immediately surrounded by quotes, 
    # AND is not part of a URL or query param (not preceded by `?` or `&` or `/`).
    
    out = []
    
    for word in re.finditer(r'[a-zA-Z0-9_]+|\W+', content):
        token = word.group(0)
        if token in mapping:
            # Let's check context
            start = word.start()
            end = word.end()
            
            # Simple context check:
            # Look at previous non-whitespace character
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
                    
            # Ignore if inside quotes (roughly, if prev_char is quote or next_char is quote)
            if prev_char in ("'", '"', '`') or next_char in ("'", '"', '`'):
                out.append(token)
                continue
                
            # Ignore if part of query param
            if prev_char in ('?', '&') and next_char == '=':
                out.append(token)
                continue
                
            out.append(mapping[token])
        else:
            out.append(token)
            
    return "".join(out)

print(replace_safely(text, mapping))
