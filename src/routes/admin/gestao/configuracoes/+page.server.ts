import { env } from '$env/dynamic/private';

export const load = async ({ locals }) => {
  const [settingsRes, poolsRes, shardsRes] = await Promise.all([
    locals.db.from('settings').select('*'),
    locals.db.from('storage_pools').select('*').order('display_name'),
    locals.db.from('storage_shards').select('*').order('weight', { ascending: false }).order('display_name')
  ]);

  return {
    settings: settingsRes.data || [],
    storagePools: poolsRes.data || [],
    storageShards: shardsRes.data || [],
    telegram: !!env.TELEGRAM_BOT_TOKEN || !!(env as any).TELEGRAM_BOT_MANGA_STORAGE_01,
    staff: !!env.STAFF_BRIDGE_URL
  };
};
