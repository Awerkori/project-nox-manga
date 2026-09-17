import re
import os

mapping = {
  "created_at": "createdAt",
  "updated_at": "updatedAt",
  "user_id": "userId",
  "scan_id": "scanId",
  "owner_id": "ownerId",
  "display_name": "displayName",
  "avatar_id": "avatarId",
  "cover_id": "coverId",
  "work_id": "workId",
  "chapter_id": "chapterId",
  "author_id": "authorId",
  "parent_id": "parentId",
  "content_rating": "contentRating",
  "age_rating": "ageRating",
  "published_at": "publishedAt",
  "latest_chapter_published_at": "latestChapterPublishedAt",
  "views_total": "viewsTotal",
  "source_id": "sourceId",
  "search_text": "searchText",
  "metadata_provenance": "metadataProvenance",
  "is_official": "isOfficial",
  "is_primary": "isPrimary",
  "read_at": "readAt",
  "entity_type": "entityType",
  "entity_id": "entityId",
  "actor_user_id": "actorUserId",
  "dedupe_key": "dedupeKey",
  "bot_reference": "botReference",
  "secret_chat_id": "secretChatId",
  "secret_token": "secretToken",
  "provider_key": "providerKey",
  "shard_id": "shardId",
  "group_id": "groupId",
  "webhook_url": "webhookUrl",
  "channel_id": "channelId",
  "message_id": "messageId",
  "reply_to_id": "replyToId",
  "parent_message_id": "parentMessageId",
  "post_id": "postId",
  "comment_id": "commentId",
  "parent_comment_id": "parentCommentId",
  "stage_id": "stageId",
  "assigned_to": "assignedTo",
  "target_type": "targetType",
  "target_user_id": "targetUserId",
  "opening_id": "openingId",
  "context_type": "contextType",
  "context_id": "contextId",
  "from_user_id": "fromUserId",
  "to_user_id": "toUserId",
  "uploaded_by": "uploadedBy",
  "created_by": "createdBy",
  "original_filename": "originalFilename",
  "issue_type": "issueType",
  "page_number": "pageNumber",
  "post_type": "postType",
  "is_pinned": "isPinned",
  "ref_type": "refType",
  "source_term": "sourceTerm",
  "preferred_translation": "preferredTranslation",
  "question_type": "questionType"
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

count = 0
for root, dirs, files in os.walk('src'):
    for f in files:
        if f.endswith('.svelte') or f.endswith('.ts') or f.endswith('.js'):
            path = os.path.join(root, f)
            with open(path, 'r') as file:
                content = file.read()
            
            new_content = replace_safely(content, mapping)
            if new_content != content:
                with open(path, 'w') as file:
                    file.write(new_content)
                count += 1

print(f"Migrated {count} files!")
