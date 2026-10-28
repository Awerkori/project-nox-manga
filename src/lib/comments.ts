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
  type: 'text' | 'spoiler' | 'mention' | 'media';
  content: string;
  username?: string;
  mediaUrl?: string;
  mediaAlt?: string;
  isSpoiler?: boolean;
  isGif?: boolean;
}

/**
 * Strips hidden spoiler content and media tags for safe previews, email excerpts, and notifications.
 */
export function stripSpoilers(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:\|\|[\s\S]*?\|\||\[spoiler\][\s\S]*?\[\/spoiler\])/gi, '[spoiler oculto]')
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s\)]+|\/media\/[a-f0-9-]+)\)/gi, '[mídia]');
}

/**
 * Parses comment body supporting:
 * - Discord syntax spoilers: ||texto||
 * - BBCode backwards compatibility: [spoiler]texto[/spoiler]
 * - Markdown media tags: ![alt](url) (supports spoiler wrapping ||![alt](url)||)
 * - Standalone image/GIF links (HTTPS ending in .gif, .png, .jpg, .jpeg, .webp, .avif or Tenor/Giphy CDN)
 * - Clickable @mentions: @username
 * - Plain text
 */
export function parseCommentBody(text: string): CommentTextChunk[] {
  if (!text) return [];

  // Match spoilers: Discord ||...|| and BBCode [spoiler]...[/spoiler]
  const spoilerRegex = /(?:\|\|([\s\S]+?)\|\||\[spoiler\]([\s\S]+?)\[\/spoiler\])/gi;
  const rawChunks: Array<{ isSpoiler: boolean; raw: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = spoilerRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      rawChunks.push({ isSpoiler: false, raw: text.slice(lastIndex, match.index) });
    }
    const spoilerContent = match[1] !== undefined ? match[1] : match[2];
    rawChunks.push({ isSpoiler: true, raw: spoilerContent });
    lastIndex = spoilerRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    rawChunks.push({ isSpoiler: false, raw: text.slice(lastIndex) });
  }

  // Next, for each raw chunk, extract media: ![alt](url) or standalone image URLs
  const mediaRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s\)]+|\/media\/[a-f0-9-]+)\)/gi;
  const standaloneUrlRegex = /(^|[\s])(https?:\/\/[^\s]+\.(?:gif|png|jpe?g|webp|avif)(?:\?[^\s]*)?|https?:\/\/(?:media\d*\.giphy\.com\/media\/[^\s]+|c\.tenor\.com\/[^\s]+|media\.tenor\.com\/[^\s]+|i\.imgur\.com\/[^\s]+|giphy\.com\/gifs\/[a-zA-Z0-9_-]+))(?=[\s]|$)/gi;

  const intermediateChunks: Array<{
    isMedia: boolean;
    isSpoiler: boolean;
    text?: string;
    mediaUrl?: string;
    mediaAlt?: string;
    isGif?: boolean;
  }> = [];

  for (const item of rawChunks) {
    const str = item.raw;
    let mIdx = 0;
    let mMatch: RegExpExecArray | null;

    // First check markdown images ![]()
    const temp: Array<{
      isMedia: boolean;
      isSpoiler: boolean;
      text?: string;
      mediaUrl?: string;
      mediaAlt?: string;
      isGif?: boolean;
    }> = [];

    while ((mMatch = mediaRegex.exec(str)) !== null) {
      if (mMatch.index > mIdx) {
        temp.push({ isMedia: false, isSpoiler: item.isSpoiler, text: str.slice(mIdx, mMatch.index) });
      }
      const alt = mMatch[1] || 'Mídia';
      let url = mMatch[2];
      let isGif = url.toLowerCase().includes('.gif') || url.toLowerCase().includes('giphy') || url.toLowerCase().includes('tenor');

      const giphyPage = url.match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/i);
      if (giphyPage) {
        url = `https://media.giphy.com/media/${giphyPage[1]}/giphy.gif`;
        isGif = true;
      }

      temp.push({ isMedia: true, isSpoiler: item.isSpoiler, mediaUrl: url, mediaAlt: alt, isGif });
      mIdx = mediaRegex.lastIndex;
    }
    if (mIdx < str.length) {
      temp.push({ isMedia: false, isSpoiler: item.isSpoiler, text: str.slice(mIdx) });
    }

    for (const t of temp) {
      if (t.isMedia) {
        intermediateChunks.push(t);
      } else {
        // Also check standalone image/gif URLs if not inside markdown
        let sIdx = 0;
        let sMatch: RegExpExecArray | null;
        const subStr = t.text || '';
        while ((sMatch = standaloneUrlRegex.exec(subStr)) !== null) {
          const prefix = sMatch[1] || '';
          let url = sMatch[2];
          const start = sMatch.index + prefix.length;
          const end = start + url.length;
          if (start > sIdx) {
            intermediateChunks.push({ isMedia: false, isSpoiler: t.isSpoiler, text: subStr.slice(sIdx, start) });
          }
          let isGif = url.toLowerCase().includes('.gif') || url.toLowerCase().includes('giphy') || url.toLowerCase().includes('tenor');

          const giphyPage = url.match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/i);
          if (giphyPage) {
            url = `https://media.giphy.com/media/${giphyPage[1]}/giphy.gif`;
            isGif = true;
          }

          intermediateChunks.push({ isMedia: true, isSpoiler: t.isSpoiler, mediaUrl: url, mediaAlt: 'Imagem', isGif });
          sIdx = end;
          standaloneUrlRegex.lastIndex = end;
        }
        if (sIdx < subStr.length) {
          intermediateChunks.push({ isMedia: false, isSpoiler: t.isSpoiler, text: subStr.slice(sIdx) });
        }
      }
    }
  }

  // Now, for non-media chunks, extract mentions: @username
  const mentionRegex = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_À-ÿ-]+)/g;
  const finalChunks: CommentTextChunk[] = [];

  for (const chunk of intermediateChunks) {
    if (chunk.isMedia && chunk.mediaUrl) {
      finalChunks.push({
        type: 'media',
        content: chunk.mediaUrl,
        mediaUrl: chunk.mediaUrl,
        mediaAlt: chunk.mediaAlt,
        isSpoiler: chunk.isSpoiler,
        isGif: chunk.isGif
      });
      continue;
    }

    if (chunk.isSpoiler && chunk.text !== undefined) {
      finalChunks.push({
        type: 'spoiler',
        content: chunk.text
      });
      continue;
    }

    // Split plain text by @mention
    let tLast = 0;
    let mMatch: RegExpExecArray | null;
    const str = chunk.text || '';
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
