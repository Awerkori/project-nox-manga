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
  type: 'text' | 'spoiler' | 'mention';
  content: string;
  username?: string;
}

export function parseCommentBody(text: string): CommentTextChunk[] {
  if (!text) return [];
  const spoilerRegex = /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi;
  const initialChunks: CommentTextChunk[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = spoilerRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      initialChunks.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    initialChunks.push({ type: 'spoiler', content: match[1] });
    lastIndex = spoilerRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    initialChunks.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // Split plain text chunks by @mention
  const finalChunks: CommentTextChunk[] = [];
  const mentionRegex = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_À-ÿ-]+)/g;

  for (const chunk of initialChunks) {
    if (chunk.type === 'spoiler') {
      finalChunks.push(chunk);
      continue;
    }

    let tLast = 0;
    let mMatch: RegExpExecArray | null;
    const str = chunk.content;
    while ((mMatch = mentionRegex.exec(str)) !== null) {
      const prefix = mMatch[1] || '';
      const username = mMatch[2];
      const matchStart = mMatch.index + prefix.length;
      const matchEnd = matchStart + 1 + username.length;

      if (matchStart > tLast) {
        finalChunks.push({ type: 'text', content: str.slice(tLast, matchStart) });
      }
      finalChunks.push({ type: 'mention', content: username, username });
      tLast = matchEnd;
      mentionRegex.lastIndex = matchEnd;
    }
    if (tLast < str.length) {
      finalChunks.push({ type: 'text', content: str.slice(tLast) });
    }
  }

  return finalChunks;
}

