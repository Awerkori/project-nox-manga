<script lang="ts">
  import AdminLayout from '../../src/routes/admin/+layout.svelte';
  import Dashboard from '../../src/routes/admin/+page.svelte';
  import Catalog from '../../src/routes/admin/obras/+page.svelte';
  import Tags from '../../src/routes/admin/tags/+page.svelte';
  import Gestao from '../../src/routes/admin/gestao/+page.svelte';
  import Config from '../../src/routes/admin/gestao/configuracoes/+page.svelte';
  import ChapterEditor from '../../src/routes/admin/obras/[id]/capitulos/[chapter]/+page.svelte';

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
      equipped_badge_id: 'marca-inicial'
    },
    role: role,
    unread: 0,
    pendingReportsCount: 0,
    config: {},
    pathname: page === 'dashboard' ? '/admin' : `/admin/${page}`,
    ageStatus: 'ADULT' as const,
    blurNsfw: false
  });

  let dashboardData = $derived({
    ...baseData,
    works: 14,
    chapters: 86,
    draftsCount: 3,
    tagsCount: 32,
    importerActiveCount: 4,
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
    staff: true
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
    {:else if page === 'capitulo'}
      <ChapterEditor data={chapterData as any} />
    {/if}
  </AdminLayout>
</main>
