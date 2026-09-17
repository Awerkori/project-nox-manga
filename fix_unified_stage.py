with open('src/routes/scan/components/TasksTab.svelte', 'r') as f:
    content = f.read()

# Replace all snake_case with camelCase in UnifiedStageItem and uses
replaces = [
    ('production_chapter_id', 'productionChapterId'),
    ('stage_id', 'stageId'),
    ('assigned_to', 'assignedTo'),
    ('claimed_at', 'claimedAt'),
    ('last_activity_at', 'lastActivityAt'),
    ('previous_assigned_to', 'previousAssignedTo'),
    ('rejection_reason', 'rejectionReason'),
    ('return_to_stage_id', 'returnToStageId'),
    ('is_override', 'isOverride'),
    ('override_action', 'overrideAction'),
    ('override_reason', 'overrideReason'),
]

for old, new in replaces:
    content = content.replace(old, new)

with open('src/routes/scan/components/TasksTab.svelte', 'w') as f:
    f.write(content)

