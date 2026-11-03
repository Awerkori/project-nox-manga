import { env } from '$env/dynamic/private';
import { executeYugabyteSql } from '$lib/server/yugabyte';

export const load = async ({ platform }: any) => {
  const platformEnv = platform?.env;

  const [settingsRes, poolsRes, shardsRes] = await Promise.all([
    executeYugabyteSql(`SELECT * FROM public.settings;`, [], platformEnv),
    executeYugabyteSql(`SELECT * FROM public.storage_pools ORDER BY display_name ASC;`, [], platformEnv),
    executeYugabyteSql(`SELECT * FROM public.storage_shards ORDER BY weight DESC, display_name ASC;`, [], platformEnv)
  ]);

  const rawShards = shardsRes.rows || [];
  const pools = poolsRes.rows || [];

  // Calculate recent volume and share % per pool
  const poolTotals = new Map<string, number>();
  for (const shard of rawShards) {
    const vol = Number((shard as any).assigned_pages_count || 0) + Number(shard.recent_successes || 0);
    const curr = poolTotals.get(shard.pool_id) || 0;
    poolTotals.set(shard.pool_id, curr + vol);
  }

  const enhancedShards = rawShards.map((shard: any) => {
    const vol = Number((shard as any).assigned_pages_count || 0) + Number(shard.recent_successes || 0);
    const poolTotal = poolTotals.get(shard.pool_id) || 0;
    const sharePercent = poolTotal > 0 ? ((vol / poolTotal) * 100).toFixed(1) : '0.0';

    let botLabel = shard.bot_reference;
    if (shard.bot_reference === 'MANGA_STORAGE_01') botLabel = 'Manga Bot 01';
    else if (shard.bot_reference === 'MANGA_STORAGE_2') botLabel = 'Manga Bot 02';
    else if (shard.bot_reference === 'STAFF_STORAGE') botLabel = 'Staff Bot';
    else if (shard.bot_reference === 'PROFILE_MEDIA') botLabel = 'Profile Bot';
    else if (shard.bot_reference === 'PARTNER_STORAGE') botLabel = 'Partner Bot';
    else if (shard.bot_reference === 'SCAN_MEDIA') botLabel = 'Scan Media Bot';
    else if (shard.bot_reference === 'OVERFLOW_STORAGE') botLabel = 'Overflow Bot';
    else if (shard.bot_reference === 'primary') botLabel = 'Primary Bot';

    return {
      ...shard,
      recent_uploads: vol,
      recent_share_percent: `${sharePercent}%`,
      bot_label: botLabel
    };
  });

  return {
    settings: settingsRes.rows || [],
    storagePools: pools,
    storageShards: enhancedShards,
    telegram: !!env.TELEGRAM_BOT_TOKEN || !!(env as any).TELEGRAM_BOT_MANGA_STORAGE_01,
    staff: !!env.STAFF_BRIDGE_URL
  };
};
