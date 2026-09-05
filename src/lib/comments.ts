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
