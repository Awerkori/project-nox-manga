import { env } from '$env/dynamic/private';

export const load = async ({ locals }) => {
  const [settingsRes, poolsRes, shardsRes] = await Promise.all([
    locals.db.from('settings').select('*'),
    locals.db.from('storage_pools').select('*').order('display_name'),
    locals.db.from('storage_shards').select('*').order('weight', { ascending: false }).order('display_name')
  ]);

  const rawShards = shardsRes.data || [];
  const pools = poolsRes.data || [];

  // Calculate recent volume and share % per pool
  const poolTotals = new Map<string, number>();
  for (const shard of rawShards) {
    const vol = Number((shard as any).assigned_pages_count || 0) + Number(shard.recent_successes || 0);
    const curr = poolTotals.get(shard.pool_id) || 0;
    poolTotals.set(shard.pool_id, curr + vol);
  }

  const enhancedShards = rawShards.map((shard) => {
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
    settings: settingsRes.data || [],
    storagePools: pools,
    storageShards: enhancedShards,
    telegram: !!env.TELEGRAM_BOT_TOKEN || !!(env as any).TELEGRAM_BOT_MANGA_STORAGE_01,
    staff: !!env.STAFF_BRIDGE_URL
  };
};
