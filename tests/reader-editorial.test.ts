import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/lib/server/yugabyte', () => ({ executeYugabyteSql: vi.fn() }));
import { executeYugabyteSql } from '../src/lib/server/yugabyte';
import { load } from '../src/routes/ler/[id]/+page.server';
const sql = vi.mocked(executeYugabyteSql);
beforeEach(() => { sql.mockReset(); });
function event(id: string, rating = 'GENERAL') {
  const db = { from: vi.fn((table: string) => {
    if (['chapters','pages','works'].includes(table)) throw new Error('Legacy editorial read');
    const builder: any = { data: [], then: (resolve: any) => Promise.resolve({ data: [] }).then(resolve) };
    for (const method of ['select','eq','order','limit','maybeSingle']) builder[method] = () => builder;
    return builder;
  }) };
  const chapter = { id, work_id:'work', number:1, published_at:'2026-09-28', works:{published:true,content_rating:rating} };
  sql.mockResolvedValueOnce({rows:[chapter],rowCount:1});
  sql.mockResolvedValueOnce({rows:[{pages:[{position:1,media_id:'media'}],siblings:[{id,number:1}]}],rowCount:1});
  return {locals:{db},params:{id},url:new URL('https://example.test/ler/'+id),cookies:{get:()=>null},setHeaders:vi.fn(),platform:{env:{}}} as any;
}
it('reads chapter, pages and navigation from Yugabyte in two queries', async () => {
  const e=event('published');const result=await load(e);
  expect(result.pages).toHaveLength(1);expect(result.siblings).toHaveLength(1);
  expect(sql).toHaveBeenCalledTimes(2);
  expect(sql.mock.calls[0][1]).toEqual(['published',false]);
});
it('does not turn a Yugabyte failure into a false legacy 404', async () => {
  const e=event('failed');sql.mockReset();sql.mockRejectedValue(new Error('temporary DB failure'));
  let failure: any;
  try { await load(e); } catch (err) { failure = err; }
  expect(failure?.status).toBe(500);
});
it('does not let an adult cache entry bypass the minor restriction', async () => {
  const e=event('adult','ADULT_18');await load(e);
  const minor=event('adult','ADULT_18');minor.cookies.get=()=> 'MINOR';
  await expect(load(minor)).rejects.toMatchObject({status:403});
});
