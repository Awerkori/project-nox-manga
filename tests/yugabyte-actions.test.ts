import { describe, expect, it, vi } from 'vitest';
import { POST as shopPurchasePost } from '../src/routes/api/shop/purchase/+server';
import { POST as shopEquipPost } from '../src/routes/api/shop/equip/+server';
import * as yugabyteModule from '../src/lib/server/yugabyte';

describe('YugabyteDB Native Actions Suite', () => {
  it('purchases shop item directly through YSQL, deducting XP and updating member_inventory', async () => {
    const mockSql = vi.spyOn(yugabyteModule, 'executeYugabyteSql');

    // 1. SELECT shop_items
    mockSql.mockResolvedValueOnce({
      rows: [{ id: 'banner_aurora', name: 'Aurora', price_xp: 500, min_level: 1, is_active: true }],
      rowCount: 1
    } as any);

    // 2. SELECT member_inventory (not owned yet)
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    // 3. SELECT members (xp balance)
    mockSql.mockResolvedValueOnce({ rows: [{ id: 'user-1', xp: 1000 }], rowCount: 1 } as any);

    // 4. UPDATE members (deduct xp)
    mockSql.mockResolvedValueOnce({ rows: [{ xp: 500 }], rowCount: 1 } as any);

    // 5. INSERT member_inventory
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = new Request('https://projectnox.org/api/shop/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'banner_aurora' })
    });

    const locals = {
      user: { id: 'user-1' },
      role: 'USER',
      db: {}
    };

    const res = await shopPurchasePost({ request: req, locals, platform: {} } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.item_id).toBe('banner_aurora');
    expect(body.remaining_xp).toBe(500);

    mockSql.mockRestore();
  });

  it('equips cosmetic item directly through YSQL into members table', async () => {
    const mockSql = vi.spyOn(yugabyteModule, 'executeYugabyteSql');

    // 1. SELECT member_inventory (owned)
    mockSql.mockResolvedValueOnce({ rows: [{ item_id: 'frame_cosmic' }], rowCount: 1 } as any);

    // 2. UPDATE members (avatar_frame_id)
    mockSql.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const req = new Request('https://projectnox.org/api/shop/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'AVATAR_FRAME', itemId: 'frame_cosmic' })
    });

    const locals = {
      user: { id: 'user-1' },
      role: 'USER',
      db: {}
    };

    const res = await shopEquipPost({ request: req, locals, platform: {} } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.equipped).toBe(true);
    expect(body.item_id).toBe('frame_cosmic');

    mockSql.mockRestore();
  });
});
