import re

text = """
const user_id = formData.get('user_id');
let created_at = row.created_at;
const { display_name, avatar_id } = user;
fetch(`/api/test?user_id=${user_id}`)
console.log("user_id");
<div class="user_id">
obj.user_id = 123;
user_id: user_id
"""

mapping = {
    'user_id': 'userId',
    'created_at': 'createdAt',
    'display_name': 'displayName',
    'avatar_id': 'avatarId'
}

for k, v in mapping.items():
    # Negative lookbehind for quotes or slash
    # Negative lookahead for quotes or slash
    pattern = r"(?<!['\"`/\-])\b" + re.escape(k) + r"\b(?!['\"`/\-])"
    text = re.sub(pattern, v, text)

print(text)
