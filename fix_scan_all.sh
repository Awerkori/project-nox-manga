node assemble_scan.cjs
python3 fix_selects.py
python3 fix_selects2.py
sed -i 's/stage: schema\.scanWorkflowStages,/stage: { id: schema.scanWorkflowStages.id, name: schema.scanWorkflowStages.name, displayOrder: schema.scanWorkflowStages.displayOrder, color: schema.scanWorkflowStages.color, role: schema.scanWorkflowStages.role },/g' src/routes/scan/\+page.server.ts
sed -i 's/assignee: schema\.members,/assignee: { id: schema.members.id, username: schema.members.username, displayName: schema.members.displayName, avatarId: schema.members.avatarId },/g' src/routes/scan/\+page.server.ts
sed -i 's/import { eq, and,/import { eq, and, getTableColumns, sql,/g' src/routes/scan/\+page.server.ts
sed -i 's/import { db, schema, safeQuery }/import { db, schema, safeQuery, safeQuerySingle }/g' src/routes/scan/\+page.server.ts
python3 fix_spreads.py
python3 fix_scan_nesting.py
python3 fix_scan_mappings.py
sed -i 's/const memberRow = await safeQuerySingle/const { data: memberRow } = await safeQuerySingle/g' src/routes/scan/\+page.server.ts
sed -i 's/schema\.users/schema\.members/g' src/routes/scan/\+page.server.ts
sed -i 's/schema\.user/schema\.members/g' src/routes/scan/\+page.server.ts
sed -i 's/schema\.openings/schema\.scanRecruitmentOpenings/g' src/routes/scan/\+page.server.ts
python3 fix_db_execute.py
sed -i '/^import { fail }/d' src/routes/scan/\+page.server.ts
sed -i '/^declare const processPendingEmailOutbox: any;/d' src/routes/scan/\+page.server.ts
sed -i '/^export const actions = {/d' src/routes/scan/\+page.server.ts
sed -i '728i export const actions = {' src/routes/scan/\+page.server.ts

# NEW FIXES:
# Fix scanProjectRequests missing status
sed -i 's/userId: locals.user!.id,/userId: locals.user!.id, status: "PENDING",/g' src/routes/scan/\+page.server.ts
# Fix scanTasks missing status
sed -i 's/createdBy: locals.user!.id,/createdBy: locals.user!.id, status: "TODO",/g' src/routes/scan/\+page.server.ts
