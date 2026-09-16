import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
export async function GET({ url, locals }) {
  const channelId = url.searchParams.get('channelId');
  if (!channelId || !locals.user) return json({ messages: [] });
  const messages = await db.select().from(schema.scanMessages).where(eq(schema.scanMessages.channelId, channelId)).all();
  return json({ messages });
}
