import { env } from '$env/dynamic/private';
export const load = async ({ locals }) => ({
  settings: (await locals.db.from('settings').select('*')).data || [],
  telegram: !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_CHAT_ID,
  staff: !!env.STAFF_BRIDGE_URL
});
