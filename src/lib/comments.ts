export function threadComments<T extends { id: string; parent_id: string | null; created_at: string }>(
  comments: T[]
): T[] {
  const roots = new Set(comments.filter((c) => !c.parent_id).map((c) => c.id));
  const children = new Map<string, T[]>();
  for (const comment of comments)
    if (comment.parent_id && roots.has(comment.parent_id)) {
      const siblings = children.get(comment.parent_id) || [];
      siblings.push(comment);
      children.set(comment.parent_id, siblings);
    }
  return comments
    .filter((c) => !c.parent_id || !roots.has(c.parent_id))
    .flatMap((c) => [
      c,
      ...(children.get(c.id) || []).sort((a, b) => a.created_at.localeCompare(b.created_at))
    ]);
}

export interface CommentTextChunk {
  type: 'text' | 'spoiler';
  content: string;
}

export function parseCommentBody(text: string): CommentTextChunk[] {
  if (!text) return [];
  const regex = /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi;
  const chunks: CommentTextChunk[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    chunks.push({ type: 'spoiler', content: match[1] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    chunks.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return chunks;
}
