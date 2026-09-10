import { error } from '@sveltejs/kit';
import { privileged } from '$lib/server/db';

export const load = async ({ locals }) => {
  const isEditor = ['ADMIN', 'EDITOR'].includes(locals.role || '');
  if (!isEditor) error(403, 'Acesso restrito à equipe editorial');

  const db = locals.db || privileged();

  const { data: rawScans, error: scansErr } = await db
    .from('scans')
    .select('*')
    .order('is_official', { ascending: false })
    .order('name', { ascending: true });

  if (scansErr) throw error(500, scansErr.message);

  const scanIds = (rawScans || []).map((s: any) => s.id);

  // Fetch metrics in parallel
  const [workCountsRes, chapterCountsRes, memberCountsRes] = await Promise.all([
    db.from('work_scans').select('scan_id'),
    db.from('chapter_scans').select('scan_id'),
    db.from('scan_members').select('scan_id')
  ]);

  const workCountMap: Record<string, number> = {};
  for (const row of (workCountsRes.data || []) as any[]) {
    workCountMap[row.scan_id] = (workCountMap[row.scan_id] || 0) + 1;
  }

  const chapterCountMap: Record<string, number> = {};
  for (const row of (chapterCountsRes.data || []) as any[]) {
    chapterCountMap[row.scan_id] = (chapterCountMap[row.scan_id] || 0) + 1;
  }

  const memberCountMap: Record<string, number> = {};
  for (const row of (memberCountsRes.data || []) as any[]) {
    memberCountMap[row.scan_id] = (memberCountMap[row.scan_id] || 0) + 1;
  }

  const scans = (rawScans || []).map((s: any) => ({
    ...s,
    works_count: workCountMap[s.id] || 0,
    chapters_count: chapterCountMap[s.id] || 0,
    members_count: memberCountMap[s.id] || 0
  }));

  return {
    scans
  };
};
