<script lang="ts">
  import AdminLayout from '../../src/routes/admin/+layout.svelte';
  import Dashboard from '../../src/routes/admin/+page.svelte';
  import Catalog from '../../src/routes/admin/obras/+page.svelte';
  import Tags from '../../src/routes/admin/tags/+page.svelte';
  import Gestao from '../../src/routes/admin/gestao/+page.svelte';
  import Config from '../../src/routes/admin/gestao/configuracoes/+page.svelte';
  import ChapterEditor from '../../src/routes/admin/obras/[id]/capitulos/[chapter]/+page.svelte';
  import Importer from '../../src/routes/admin/importer/+page.svelte';
  import Staff from '../../src/routes/admin/staff/+page.svelte';
  import storageData from './storage-preview-data.json';

  let { page = 'dashboard', role = 'ADMIN' } = $props<{ page?: string; role?: 'ADMIN' | 'EDITOR' }>();

  let baseData = $derived({
    profile: {
      id: 'usr-1',
      display_name: role === 'ADMIN' ? 'Awerkori' : 'Editor Convidado',
      username: role === 'ADMIN' ? 'awerkori' : 'editor_nox',
      avatar_id: null as string | null,
      bio: '',
      created_at: new Date().toISOString(),
      xp: 100,
      age_status: 'ADULT',
      blur_nsfw: false,
      is_test: false,
      equipped_title_id: 'iniciado-nox',
      equipped_badge_id: 'marca-inicial',
      avatar_frame_id: null as string | null,
      banner_id: null as string | null,
      banner_position: 'center',
      equipped_medal_id: null as string | null,
      equipped_banner_id: null as string | null,
      equipped_comment_banner_id: null as string | null,
      is_onboarded: true,
      manual_badge: false,
      manual_title: false,
      name_color: null as string | null,
      featured_achievement_id: null as string | null,
      privacy_show_achievements: true,
      privacy_show_cosmetics: true,
      privacy_show_favorites: true,
      privacy_show_reading_history: true,
      avatar_crop: null,
      banner_crop: null
    },
    role: role,
    unread: 0,
    pendingReportsCount: 0,
    config: {},
    pathname: page === 'dashboard' ? '/admin' : `/admin/${page}`,
    ageStatus: 'ADULT' as const,
    blurNsfw: false,
    siteUrl: 'http://127.0.0.1:5173'
  });

  let dashboardData = $derived({
    ...baseData,
    works: 14,
    chapters: 86,
    draftsCount: 3,
    tagsCount: 32,
    importerActiveCount: 4,
    staffCount: 5,
    failedJobs24h: 1,
    unrecoveredFailures: 0,
    recoveredFailures: 1,
    pendingReportsCount: 2,
    drafts: [
      {
        id: 'ch-draft-1',
        number: 45,
        title: 'O Despertar da Névoa',
        updated_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        works: { id: 'w-1', title: 'Solo Leveling: Ragnarok', cover_id: 'sample-cover-1' }
      },
      {
        id: 'ch-draft-2',
        number: 12,
        title: 'Confronto no Abismo',
        updated_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        works: { id: 'w-2', title: 'Omniscient Reader', cover_id: 'sample-cover-2' }
      },
      {
        id: 'ch-draft-3',
        number: 7,
        title: null,
        updated_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
        works: { id: 'w-3', title: 'The Beginning After The End', cover_id: 'sample-cover-3' }
      }
    ],
    recentPublished: [
      {
        id: 'ch-pub-1',
        number: 44,
        title: 'Aliança Quebrada',
        published_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        works: { id: 'w-1', title: 'Solo Leveling: Ragnarok' }
      },
      {
        id: 'ch-pub-2',
        number: 11,
        title: 'O Quarto Cenário',
        published_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
        works: { id: 'w-2', title: 'Omniscient Reader' }
      }
    ],
    recentWorks: [
      {
        id: 'w-1',
        title: 'Solo Leveling: Ragnarok',
        slug: 'solo-leveling-ragnarok',
        format: 'MANHWA',
        published: true,
        updated_at: new Date(Date.now() - 1000 * 60 * 45).toISOString()
      },
      {
        id: 'w-2',
        title: 'Omniscient Reader',
        slug: 'omniscient-reader',
        format: 'MANHWA',
        published: true,
        updated_at: new Date(Date.now() - 1000 * 60 * 180).toISOString()
      },
      {
        id: 'w-3',
        title: 'The Beginning After The End',
        slug: 'tbate',
        format: 'MANHWA',
        published: true,
        updated_at: new Date(Date.now() - 1000 * 60 * 360).toISOString()
      }
    ]
  });

  let catalogData = $derived({
    ...baseData,
    works: [
      {
        id: 'w-1',
        title: 'Solo Leveling: Ragnarok',
        slug: 'solo-leveling-ragnarok',
        format: 'MANHWA',
        published: true,
        cover_id: 'sample-cover-1',
        updated_at: '2026-09-07T22:00:00Z'
      },
      {
        id: 'w-2',
        title: 'Omniscient Reader',
        slug: 'omniscient-reader',
        format: 'MANHWA',
        published: true,
        cover_id: 'sample-cover-2',
        updated_at: '2026-09-07T18:30:00Z'
      },
      {
        id: 'w-3',
        title: 'The Beginning After The End',
        slug: 'tbate',
        format: 'MANHWA',
        published: true,
        cover_id: 'sample-cover-3',
        updated_at: '2026-09-06T15:00:00Z'
      },
      {
        id: 'w-4',
        title: 'Sombra da Lua de Sangue',
        slug: 'sombra-da-lua-de-sangue',
        format: 'MANGA',
        published: false,
        cover_id: null,
        updated_at: '2026-09-05T10:00:00Z'
      }
    ]
  });

  let tagsData = $derived({
    ...baseData,
    tags: [
      { id: 't-1', name: 'Ação', slug: 'acao', kind: 'GENRE' },
      { id: 't-2', name: 'Fantasia', slug: 'fantasia', kind: 'GENRE' },
      { id: 't-3', name: 'Sobrenatural', slug: 'sobrenatural', kind: 'GENRE' },
      { id: 't-4', name: 'Romance', slug: 'romance', kind: 'GENRE' },
      { id: 't-5', name: 'Isekai', slug: 'isekai', kind: 'TAG' },
      { id: 't-6', name: 'Dungeon', slug: 'dungeon', kind: 'TAG' },
      { id: 't-7', name: 'Caçadores', slug: 'cacadores', kind: 'TAG' },
      { id: 't-8', name: 'Retorno no Tempo', slug: 'retorno-no-tempo', kind: 'TAG' },
      { id: 't-9', name: 'Sistema', slug: 'sistema', kind: 'TAG' },
      { id: 't-10', name: 'Protagonista OP', slug: 'protagonista-op', kind: 'TAG' }
    ]
  });

  let gestaoData = $derived({
    ...baseData,
    members: [
      {
        id: 'm-1',
        username: 'awerkori',
        display_name: 'Awerkori',
        access_roles: { role: 'ADMIN', suspended: false }
      },
      {
        id: 'm-2',
        username: 'kuro_editor',
        display_name: 'Kuro Staff',
        access_roles: { role: 'EDITOR', suspended: false }
      },
      {
        id: 'm-3',
        username: 'lucas_leitor',
        display_name: 'Lucas Silva',
        access_roles: { role: 'USER', suspended: false }
      },
      {
        id: 'm-4',
        username: 'spammer99',
        display_name: 'Bot Suspeito',
        access_roles: { role: 'USER', suspended: true }
      }
    ],
    invites: [
      { email: 'novo.tradutor@project-nox.com', created_at: '2026-09-07T12:00:00Z' },
      { email: 'cleaner.typesetter@project-nox.com', created_at: '2026-09-06T18:00:00Z' }
    ],
    comments: [
      {
        id: 'c-1',
        body: 'Capítulo sensacional! A arte das cenas de combate dessa semana superou tudo.',
        removed: false,
        created_at: '2026-09-08T02:30:00Z',
        members: { display_name: 'Lucas Silva' },
        works: { title: 'Solo Leveling: Ragnarok' }
      },
      {
        id: 'c-2',
        body: 'Link para grupo externo promocional proibido.',
        removed: true,
        created_at: '2026-09-07T21:00:00Z',
        members: { display_name: 'Bot Suspeito' },
        works: { title: 'Omniscient Reader' }
      }
    ]
  });

  let configData = $derived({
    ...baseData,
    settings: [
      { key: 'site_name', value: 'Project Nox Manga' },
      { key: 'description', value: 'Plataforma oficial de leitura cósmica de mangás e manhwas do Project Nox.' },
      { key: 'contact_email', value: 'staff@project-nox.com' }
    ],
    telegram: true,
    staff: true,
    storagePools: storageData.pools,
    storageShards: storageData.shards.map((s) => ({
      ...s,
      recent_uploads: s.recent_successes || 12,
      recent_share_percent: '14.2%',
      bot_label: s.bot_reference
    }))
  });

  let chapterData = $derived({
    ...baseData,
    work: { id: 'w-1', title: 'Solo Leveling: Ragnarok' },
    chapter: { id: 'ch-1', number: 45, title: 'O Despertar da Névoa', published_at: null },
    pages: [
      { media_id: 'p-1', position: 1 },
      { media_id: 'p-2', position: 2 },
      { media_id: 'p-3', position: 3 }
    ]
  });

  let importerData = $derived({
    ...baseData,
    sources: [
      { id: 'kuro', name: 'Kuro Mangas', base_url: 'https://kuromangas.com', status: 'ACTIVE', enabled: true, rate_limit_per_second: 2, sync_interval_minutes: 30, last_sync_at: new Date().toISOString(), cooldown_until: null },
      { id: 'nexus', name: 'Nexus Mangas', base_url: 'https://www.nexusmangas.com', status: 'ACTIVE', enabled: true, rate_limit_per_second: 2, sync_interval_minutes: 30, last_sync_at: new Date().toISOString(), cooldown_until: null },
      { id: 'mangotoons', name: 'Mango Toons', base_url: 'https://api.mangotoons.com', status: 'ACTIVE', enabled: true, rate_limit_per_second: 2, sync_interval_minutes: 30, last_sync_at: new Date().toISOString(), cooldown_until: null }
    ],
    counts: {
      queued: 142,
      importing: 18,
      staged: 12,
      retry: 4,
      failed: 6,
      completed: 890,
      failed1h: 0,
      failed24h: 3
    },
    recentFailures: [],
    activeJobs: [],
    staffRequests: [],
    queuedJobs: [],
    stagedChapters: [],
    activeFocus: {
      id: 'req-priority-1',
      work_id: 'w-1',
      reason: 'Lançamento simultâneo com a Coreia',
      created_at: new Date().toISOString(),
      works: {
        id: 'w-1',
        title: 'Vingança do Cão de Caça',
        slug: 'vinganca-do-cao-de-caca',
        cover_id: 'sample-cover-1'
      },
      members: {
        username: 'awerkori',
        display_name: 'Awerkori'
      },
      stats: {
        totalDiscovered: 120,
        completed: 85,
        staged: 2,
        pending: 33,
        published: 85,
        percent: 71,
        currentChapter: 86
      }
    },
    catalogWorks: [
      { id: 'w-1', title: 'Vingança do Cão de Caça', slug: 'vinganca-do-cao-de-caca', kind: 'MANHWA', published: true, updated_at: new Date().toISOString() }
    ],
    telemetry: {
      worker_id: 'discloud-worker-01',
      rss_mb: 185,
      event_loop_lag_ms: 4,
      created_at: new Date().toISOString()
    }
  });

  let staffData = $derived({
    ...baseData,
    isAdmin: role === 'ADMIN',
    staff: [
      { userId: 'usr-1', displayName: 'Awerkori', username: 'awerkori', avatarId: null, role: 'ADMIN', createdAt: '2026-01-01T00:00:00Z', suspended: false, xp: 1200 },
      { userId: 'usr-2', displayName: 'Vitor Editor', username: 'vitor', avatarId: null, role: 'EDITOR', createdAt: '2026-02-01T00:00:00Z', suspended: false, xp: 450 }
    ],
    counts: { total: 2, admins: 1, editors: 1, suspended: 0 }
  });

  let activeData = $derived(
    page === 'dashboard'
      ? dashboardData
      : page === 'obras'
        ? catalogData
        : page === 'tags'
          ? tagsData
          : page === 'gestao'
            ? gestaoData
            : page === 'configuracoes'
              ? configData
              : page === 'importer'
                ? importerData
                : page === 'staff'
                  ? staffData
                  : chapterData
  );
</script>

<main>
  <AdminLayout data={activeData}>
    {#if page === 'dashboard'}
      <Dashboard data={dashboardData} />
    {:else if page === 'obras'}
      <Catalog data={catalogData as any} />
    {:else if page === 'tags'}
      <Tags data={tagsData} />
    {:else if page === 'gestao'}
      <Gestao data={gestaoData} />
    {:else if page === 'configuracoes'}
      <Config data={configData} />
    {:else if page === 'importer'}
      <Importer data={importerData as any} form={null} />
    {:else if page === 'staff'}
      <Staff data={staffData as any} form={null} />
    {:else if page === 'capitulo'}
      <ChapterEditor data={chapterData as any} />
    {/if}
  </AdminLayout>
</main>
