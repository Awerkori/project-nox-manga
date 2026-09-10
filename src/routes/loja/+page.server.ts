export const load = async ({ locals }) => {
  const { data: items } = await locals.db
    .from('shop_items')
    .select('*')
    .eq('is_active', true)
    .order('order_index', { ascending: true });

  let userInventory: string[] = [];
    let userProfile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_id: string | null;
    banner_id: string | null;
    equipped_banner_id: string | null;
    xp: number;
    frame_id: string | null;
    name_color: string | null;
    title_id: string | null;
  } | null = null;

  if (locals.user) {
    const [invRes, profileRes] = await Promise.all([
      locals.db
        .from('member_inventory')
        .select('item_id')
        .eq('user_id', locals.user.id),
      locals.db
        .from('members')
        .select('id, username, display_name, avatar_id, banner_id, equipped_banner_id, xp, avatar_frame_id, name_color, equipped_title_id')
        .eq('id', locals.user.id)
        .maybeSingle()
    ]);

    userInventory = (invRes.data || []).map((r: any) => r.item_id);
    const p = profileRes.data;
    if (p) {
      userProfile = {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_id: p.avatar_id,
        banner_id: p.banner_id,
        equipped_banner_id: p.equipped_banner_id,
        xp: p.xp,
        frame_id: p.avatar_frame_id,
        name_color: p.name_color,
        title_id: p.equipped_title_id
      };
    }
  }

  return {
    items: items || [],
    inventory: userInventory,
    profile: userProfile
  };
};
