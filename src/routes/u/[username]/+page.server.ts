import { error } from '@sveltejs/kit';

export const load = async ({ locals, params }) => {
  const { data: member } = await locals.db
    .from('members')
    .select(`
      id,
      username,
      display_name,
      bio,
      xp,
      avatar_id,
      banner_id,
      equipped_banner_id,
      avatar_frame_id,
      name_color,
      equipped_title_id,
      equipped_badge_id,
      created_at
    `)
    .eq('username', params.username)
    .maybeSingle();

  if (!member) {
    error(404, 'Perfil não encontrado');
  }

  const [statsRes, followersCountRes, followingCountRes, achievementsRes, isFollowingRes, bannerRes] =
    await Promise.all([
      locals.db.rpc('member_public_stats', { p_user: member.id }),
      locals.db.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', member.id),
      locals.db.from('user_follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', member.id),
      locals.db
        .from('member_achievements')
        .select(`
          unlocked_at,
          achievements!inner(
            id,
            title,
            description,
            icon,
            badge_color,
            category
          )
        `)
        .eq('user_id', member.id)
        .order('unlocked_at', { ascending: false })
        .limit(20),
      locals.user && locals.user.id !== member.id
        ? locals.db
            .from('user_follows')
            .select('follower_id')
            .eq('follower_id', locals.user.id)
            .eq('following_id', member.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      member.equipped_banner_id
        ? locals.db
            .from('shop_items')
            .select('id, style_data')
            .eq('id', member.equipped_banner_id)
            .maybeSingle()
        : Promise.resolve({ data: null })
    ]);

  const achievements = (achievementsRes.data || []).map((row: any) => ({
    unlocked_at: row.unlocked_at,
    ...row.achievements
  }));

  const isSelf = locals.user?.id === member.id;
  const isFollowing = !!isFollowingRes.data;

  return {
    member: {
      ...member,
      frame_id: member.avatar_frame_id
    },
    cosmetic_banner: (bannerRes.data?.style_data as any) || null,
    stats: statsRes.data?.[0] || { chapters_read: 0, completed_works: 0, favorites: 0 },
    followersCount: followersCountRes.count ?? 0,
    followingCount: followingCountRes.count ?? 0,
    achievements,
    isSelf,
    isFollowing,
    viewerAuthenticated: !!locals.user
  };
};
