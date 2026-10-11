import {expect,it,vi} from 'vitest';
const {query,end}=vi.hoisted(()=>({query:vi.fn().mockResolvedValue({rows:[],rowCount:0}),end:vi.fn().mockResolvedValue(undefined)}));
vi.mock('pg',()=>({Client:class {connect=vi.fn().mockResolvedValue(undefined);query=query;end=end;}}));
import {fetchRecentReleasesFromYugabyte} from '../src/lib/server/yugabyte';
it('uses indexed work frontier with stable cursor and bounded per-work chapter reads',async()=>{
  await fetchRecentReleasesFromYugabyte(24,4,'2026-09-28T00:00:00Z','11111111-1111-4111-8111-111111111111',{HYPERDRIVE:{connectionString:'test'}},'manga');
  const [sql,params]=query.mock.calls[0];
  expect(sql).toContain('WITH latest_works AS MATERIALIZED');
  expect(sql).toContain('CROSS JOIN LATERAL');
  expect(sql).toContain('LIMIT $2');
  expect(sql).toContain('(w.latest_chapter_published_at, w.id) < ($3::timestamptz, $4::uuid)');
  expect(sql).not.toContain('GROUP BY');expect(sql).not.toContain('ROW_NUMBER');
  expect(params).toEqual([24,4,'2026-09-28T00:00:00Z','11111111-1111-4111-8111-111111111111','MANGA']);
  expect(end).toHaveBeenCalledOnce();
});
