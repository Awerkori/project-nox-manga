<script lang="ts">
  import WorkPage from '../../src/routes/obra/[slug]/+page.svelte';

  const aliases = [
    'The Extremely Long Official English Title Used to Stress a Narrow Mobile Layout',
    '原題が長い作品タイトル',
    '나 혼자만 레벨업',
    'Título alternativo em português',
    'Romanized Alternate Title',
    'An old editorial duplicate that must not render twice'
  ];
  const tags = ['Ação', 'Fantasia', 'Aventura', 'Romance', 'Drama', 'Escolar', 'MILF', 'Vanilla', 'NTR', 'Hentai', 'Adulto (+18)', 'Psicológico']
    .map((name, index) => ({ id: `tag-${index}`, name, slug: `tag-${index}` }));
  const chapters = Array.from({ length: 205 }, (_, index) => ({
    id: `chapter-${index + 1}`,
    number: index === 5 ? '12.10' : String(index + 1),
    display_number: index === 5 ? '12.10' : String(index + 1),
    canonical_chapter_key: `pt-br|default|chapter|${index + 1}|-`,
    chapter_order_key: `n|${String(index + 1).padStart(12, '0')}`,
    language: index === 4 ? 'en' : 'pt-BR',
    edition: index === 6 ? 'collector' : 'default',
    title: index === 8 ? 'Um título real de capítulo' : null,
    published_at: new Date(Date.now() - index * 86_400_000).toISOString(),
    views_total: 1200 + index,
    chapter_scans: []
  }));

  const data: any = {
    work: {
      id: 'work-preview', slug: 'obra-preview', title: 'Uma Obra com um Título Muito Longo para Validar a Hierarquia do Redesign',
      synopsis: 'Esta sinopse propositalmente longa permite validar largura de leitura, ritmo tipográfico e o estado expandido. '.repeat(14),
      description: '', cover_id: null, kind: 'MANHWA', status: 'ONGOING', year: 2026,
      author: 'Autora de exemplo', artist: 'Artista de exemplo', aliases, content_rating: 'ADULT_18', age_rating: 18,
      featured: true, updated_at: new Date().toISOString()
    },
    chapters, tags, scans: [], metrics: { readers: 15342 }, progress: [], profile: null,
    library: null, likes: [], comments: [], metaImage: '/brand/nox-symbol.webp',
    canonical: 'https://nox.invalid/obra/obra-preview', structuredData: '{}'
  };
</script>

<WorkPage {data} />
