# Scan database boundary audit

The Scan workspace and Scan public actions use `executeYugabyteSql` (or
YSQL-backed functions) for state, authorization, files metadata, chat,
recruitment, members, tasks, comments, mentions and notifications.

The following legacy-looking code is intentionally outside the Scan CRUD
boundary:

- `src/lib/server/notifications.ts` retains the public-site notification and
  email outbox path for non-Scan callers. Scan notifications use
  `scan-notifications.ts` and the YSQL outbox.
- `src/lib/server/mentions.ts` retains public work/chapter comment mentions.
  Scan chat/mural mentions use `scan-mentions.ts`.
- `storage-router.ts` and `media.ts` retain shared profile/editorial storage
  compatibility. Scan pipeline metadata and authorization are YSQL; artifact
  bytes remain in the existing private storage provider by design.
- Supabase Realtime is a browser event transport only. It never authorizes or
  persists a Scan operation; callbacks invalidate and re-read YSQL.

The inventory regression test covers the YSQL-only Scan route and service
modules so a PostgREST/RPC database client cannot silently return to them.
