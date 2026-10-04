# Scan realtime boundary

Scan data is authoritative in Yugabyte/YSQL. The four browser subscriptions
(`scan/+page.svelte`, `ChatTab.svelte`, `TasksTab.svelte` and
`PipelineStageView.svelte`) are transport-only:

- a Postgres-change event triggers `invalidateAll()` and a fresh YSQL read;
- typing indicators are ephemeral broadcast state and are never persisted;
- a dropped subscription cannot authorize, create, update or delete anything;
- reconnects are safe because the next invalidation rehydrates canonical state;
- storage bytes remain in the existing private artifact/provider boundary, while
  Scan metadata, permissions, messages, notifications and file state are YSQL.

This is an intentional transitional transport choice (option B). Replacing it
with a YSQL-native event transport is independent of CRUD correctness and must
not be done by making browser Realtime payloads authoritative.
