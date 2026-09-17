import re
with open('src/lib/components/Comments.svelte', 'r') as f:
    content = f.read()

# Fix the Comment type
content = content.replace("user_id: string;", "userId: string;")
content = content.replace("created_at: string;", "createdAt: string;")
content = content.replace("parent_id: string | null;", "parentId: string | null;")
content = content.replace("avatar_id?: string | null", "avatarId?: string | null")
content = content.replace("display_name: string;", "displayName: string;")
content = content.replace("comment_likes:", "commentLikes:")
content = content.replace("user_id:", "userId:")
content = content.replace("name_color?: string", "nameColor?: string")
content = content.replace("avatar_frame_id?: string", "avatarFrameId?: string")
content = content.replace("equipped_title_id?: string", "equippedTitleId?: string")
content = content.replace("equipped_comment_banner_id?: string", "equippedCommentBannerId?: string")

# Fix usages
content = content.replace("c.parent_id", "c.parentId")
content = content.replace("c.user_id", "c.userId")
content = content.replace("c.created_at", "c.createdAt")
content = content.replace("c.members?.display_name", "c.members?.displayName")
content = content.replace("c.members?.avatar_id", "c.members?.avatarId")
content = content.replace("c.members?.name_color", "c.members?.nameColor")
content = content.replace("c.members?.avatar_frame_id", "c.members?.avatarFrameId")
content = content.replace("c.members?.equipped_title_id", "c.members?.equippedTitleId")
content = content.replace("c.members?.equipped_comment_banner_id", "c.members?.equippedCommentBannerId")
content = content.replace("c.comment_likes", "c.commentLikes")
content = content.replace("like.user_id", "like.userId")

with open('src/lib/components/Comments.svelte', 'w') as f:
    f.write(content)
