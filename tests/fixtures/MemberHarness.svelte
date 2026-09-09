<script lang="ts">
  import Member from '../../src/routes/[area=member]/+page.svelte';
  import Layout from '../../src/routes/+layout.svelte';
  const area = new URLSearchParams(location.search).get('area') || 'biblioteca';
  const works = Array.from({ length: 20 }, (_, i) => ({
    id: `local-${i}`,
    slug: `local-${i}`,
    title: `História local ${i + 101}`,
    kind: 'MANHWA',
    status: 'ONGOING',
    year: 2026,
    cover_id: null
  }));
  const data: any = {
    area,
    pathname: `/${area}`,
    config: {},
    role: 'USER',
    ageStatus: 'ADULT',
    unread: 125,
    profile: {
      id: 'local-reader',
      display_name: 'Leitor de teste local',
      username: 'leitor_local',
      avatar_id: null,
      xp: 275,
      created_at: '2026-09-07',
      bio: ''
    },
    library: works.map((work) => ({ work_id: work.id, works: work, status: 'READING', favorite: true })),
    history: works.map((work, i) => ({
      chapter_id: `local-chapter-${i}`,
      chapters: { number: i + 1, works: work },
      page: 8,
      completed_at: '2026-09-07',
      updated_at: '2026-09-07'
    })),
    notifications: works.map((work, i) => ({
      id: `notice-${i}`,
      body: `${work.title}: novo capítulo disponível.`,
      read_at: null,
      created_at: '2026-09-07',
      href: `/obra/${work.slug}`
    })),
    tab: area === 'biblioteca' ? 'READING' : '',
    filter: area === 'notificacoes' ? 'nao-lidas' : '',
    page: 6,
    total: 125,
    pageSize: 20,
    completed: 125,
    completedWorks: 12,
    libraryTotal: 125
  };
</script>

<Layout {data}><Member {data} /></Layout>
