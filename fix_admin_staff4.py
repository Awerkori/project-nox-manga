with open('tests/admin-staff.test.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
in_first_test = False
for line in lines:
    if "loads staff members cleanly for ADMIN role without 500 errors" in line:
        in_first_test = True
    
    if "handles fallback query gracefully if join fails" in line:
        in_first_test = False

    if in_first_test and "id: 'editor-uuid', username: 'editor1', displayName: 'Editor Um'" in line:
        line = line.replace("id: 'editor-uuid', username: 'editor1', displayName: 'Editor Um'", "id: 'admin-uuid', username: 'awerkori', displayName: 'Awerkori'")
    
    new_lines.append(line)

with open('tests/admin-staff.test.ts', 'w') as f:
    f.writelines(new_lines)
