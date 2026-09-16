import { env } from '$env/dynamic/private';
import { db, schema, safeQuery } from '$lib/server/db';
import { asc, desc } from 'drizzle-orm';

export const load = async () => {
  const [settings, pools, rawShards] = await Promise.all([
    safeQuery(db.select().from(schema.settings)),
    safeQuery(db.select().from(schema.storagePools).orderBy(asc(schema.storagePools.displayName))),
    safeQuery(
      db.select().from(schema.storageShards)
        .orderBy(desc(schema.storageShards.weight), asc(schema.storageShards.displayName))
    )
  ]);

  // Calculate recent volume and share % per pool
  const poolTotals = new Map<string, number>();
  for (const shard of rawShards || []) {
    const vol = Number((shard as any).assignedPagesCount || 0) + Number(shard.recentSuccesses || 0);
    const curr = poolTotals.get(shard.poolId) || 0;
    poolTotals.set(shard.poolId, curr + vol);
  }

  const enhancedShards = (rawShards || []).map((shard) => {
    const vol = Number((shard as any).assignedPagesCount || 0) + Number(shard.recentSuccesses || 0);
    const poolTotal = poolTotals.get(shard.poolId) || 0;
    const sharePercent = poolTotal > 0 ? ((vol / poolTotal) * 100).toFixed(1) : '0.0';

    let botLabel = shard.botReference;
    if (shard.botReference === 'MANGA_STORAGE_01') botLabel = 'Manga Bot 01';
    else if (shard.botReference === 'MANGA_STORAGE_2') botLabel = 'Manga Bot 02';
    else if (shard.botReference === 'STAFF_STORAGE') botLabel = 'Staff Bot';
    else if (shard.botReference === 'PROFILE_MEDIA') botLabel = 'Profile Bot';
    else if (shard.botReference === 'PARTNER_STORAGE') botLabel = 'Partner Bot';
    else if (shard.botReference === 'SCAN_MEDIA') botLabel = 'Scan Media Bot';
    else if (shard.botReference === 'OVERFLOW_STORAGE') botLabel = 'Overflow Bot';
    else if (shard.botReference === 'primary') botLabel = 'Primary Bot';

    return {
      ...shard,
      recent_uploads: vol,
      recent_share_percent: `${sharePercent}%`,
      bot_label: botLabel
    };
  });

  return {
    settings: settings || [],
    storagePools: pools || [],
    storageShards: enhancedShards,
    telegram: !!env.TELEGRAM_BOT_TOKEN || !!(env as any).TELEGRAM_BOT_MANGA_STORAGE_01,
    staff: !!env.STAFF_BRIDGE_URL
  };
};
