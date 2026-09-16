import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
export async function GET({ url, locals }) {
  const scanId = url.searchParams.get('scanId');
  if (!scanId || !locals.user) return json({ tasks: [] });
  const tasks = await db.select().from(schema.scanTasks).where(eq(schema.scanTasks.scanId, scanId)).all();
  return json({ tasks });
}
