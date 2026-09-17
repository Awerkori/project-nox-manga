import re
import json

with open('src/lib/server/db/schema.ts', 'r') as f:
    content = f.read()

# Drizzle schema typically has: `camelCaseName: text("snake_case_name")`
# Or `camelCaseName: text('snake_case_name')`
# Or `camelCaseName: integer("snake_case_name")`
# Sometimes it just relies on the camelCase string if they match, but the prompt says they were snake_case in db and camelCase in TS.
# We want the mapping from snake_case to camelCase.
# But wait, in Drizzle if the DB column is snake_case and property is camelCase, it is defined as:
# camelCase: type("snake_case")

matches = re.findall(r"([a-zA-Z0-9_]+)\s*:\s*[a-zA-Z0-9_]+\(\s*['\"]([a-z0-9_]+)['\"]", content)
mapping = {}
for camel, snake in matches:
    if camel != snake:
        mapping[snake] = camel

# Also add the ones the user explicitly provided, just in case!
explicit_map = {
    'created_at': 'createdAt',
    'updated_at': 'updatedAt',
    'user_id': 'userId',
    'scan_id': 'scanId',
    'owner_id': 'ownerId',
    'display_name': 'displayName',
    'avatar_id': 'avatarId',
    'cover_id': 'coverId',
    'work_id': 'workId',
    'chapter_id': 'chapterId',
    'author_id': 'authorId',
    'parent_id': 'parentId',
    'content_rating': 'contentRating',
    'age_rating': 'ageRating',
    'published_at': 'publishedAt',
    'latest_chapter_published_at': 'latestChapterPublishedAt',
    'views_total': 'viewsTotal',
    'source_id': 'sourceId',
    'search_text': 'searchText',
    'metadata_provenance': 'metadataProvenance',
    'is_official': 'isOfficial',
    'is_primary': 'isPrimary',
    'read_at': 'readAt',
    'entity_type': 'entityType',
    'entity_id': 'entityId',
    'actor_user_id': 'actorUserId',
    'dedupe_key': 'dedupeKey',
    'bot_reference': 'botReference',
    'secret_chat_id': 'secretChatId',
    'secret_token': 'secretToken',
    'provider_key': 'providerKey',
    'shard_id': 'shardId',
    'group_id': 'groupId',
    'webhook_url': 'webhookUrl',
    'channel_id': 'channelId',
    'message_id': 'messageId',
    'reply_to_id': 'replyToId',
    'parent_message_id': 'parentMessageId',
    'post_id': 'postId',
    'comment_id': 'commentId',
    'parent_comment_id': 'parentCommentId',
    'stage_id': 'stageId',
    'assigned_to': 'assignedTo',
    'target_type': 'targetType',
    'target_user_id': 'targetUserId',
    'opening_id': 'openingId',
    'context_type': 'contextType',
    'context_id': 'contextId',
    'from_user_id': 'fromUserId',
    'to_user_id': 'toUserId',
    'uploaded_by': 'uploadedBy',
    'created_by': 'createdBy',
    'original_filename': 'originalFilename',
    'issue_type': 'issueType',
    'page_number': 'pageNumber',
    'post_type': 'postType',
    'is_pinned': 'isPinned',
    'ref_type': 'refType',
    'source_term': 'sourceTerm',
    'preferred_translation': 'preferredTranslation',
    'question_type': 'questionType'
}

mapping.update(explicit_map)

print(json.dumps(mapping, indent=2))
