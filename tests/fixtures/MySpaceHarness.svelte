<script lang="ts">
  import '../../src/app.css';
  import MySpace from '../../src/routes/me/+page.svelte';

  const works = Array.from({ length: 8 }, (_, index) => ({
    id: `work-${index}`,
    slug: `work-${index}`,
    title: `Uma obra de título deliberadamente longo para validar o mobile ${index + 1}`,
    kind: 'MANHWA',
    status: 'ONGOING',
    cover_id: null
  }));

  const member = {
    // The harness is deliberately client-only: an empty id avoids opening a
    // realtime channel while exercising the layout.
    id: '',
    display_name: 'Leitor com nome propositalmente extenso',
    username: 'leitor_de_teste_com_nome_longo',
    avatar_id: null,
    avatar_crop: { x: 50, y: 50, zoom: 1 },
    banner_id: null,
    banner_crop: { x: 50, y: 50, zoom: 1 },
    frame_id: null,
    name_color: null,
    equipped_title_id: 'Explorador das Sombras',
    xp: 12540,
    created_at: '2026-01-01'
  };

  const data: any = {
    member,
    library: works.map((work) => ({ work_id: work.id, works: work, status: 'READING', favorite: true })),
    history: works.map((work, index) => ({
      chapter_id: `chapter-${index}`,
      chapters: { id: `chapter-${index}`, number: index + 1, works: work },
      page: index + 1,
      completed_at: '2026-09-01',
      updated_at: '2026-09-01'
    })),
    achievements: [],
    notifications: [],
    offlineDownloads: []
  };

</script>

<MySpace {data} />
