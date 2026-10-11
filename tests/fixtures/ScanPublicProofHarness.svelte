<script lang="ts">
  import PublicScanPage from '../../src/routes/scans/[slug]/+page.svelte';

  const data = {
    scan: {
      id: 'scan-public-proof',
      name: 'Nebula Scans',
      slug: 'nebula-scans',
      description: 'Equipe focada em fantasia, ação e lançamentos cuidadosos.',
      is_official: false,
      logo_id: null,
      banner_id: null,
      discord: 'https://discord.gg/example',
      website: 'https://example.com',
      fluxer: null
    },
    works: [],
    chapters: [],
    members: [
      { id: 'member-owner', username: 'luna', display_name: 'Luna', avatar_id: null, frame_id: null, role: 'OWNER', positions: [{ id: 'position-lead', name: 'Liderança', is_primary: true }] },
      { id: 'member-translator', username: 'kai', display_name: 'Kai Tradutor', avatar_id: null, frame_id: null, role: 'MEMBER', positions: [{ id: 'position-translator', name: 'Tradução', is_primary: true }] }
    ],
    openings: [
      {
        id: 'opening-translator',
        title: 'Tradutor(a) PT-BR',
        positionName: 'Tradução',
        description: 'Traduza capítulos em parceria com a revisão editorial.',
        language: 'Português',
        experience_level: 'INTERMEDIÁRIO',
        availability: '2 capítulos por semana',
        requirements: 'Boa escrita e familiaridade com balões de mangá.',
        slots: 2,
        created_at: '2026-10-01T12:00:00.000Z'
      },
      {
        id: 'opening-cleaner',
        title: 'Cleaner / Redrawer',
        positionName: 'Clean / Redraw',
        description: 'Prepare páginas limpas para o typesetting.',
        language: 'Português',
        experience_level: 'QUALQUER',
        availability: 'Conforme disponibilidade',
        requirements: 'Portfólio ou uma amostra curta.',
        slots: 1,
        created_at: '2026-09-29T12:00:00.000Z'
      }
    ],
    activities: [{ id: 'activity-opening', action: 'OPENING_CREATED', details: { position_name: 'Tradução' }, created_at: '2026-10-01T12:00:00.000Z' }],
    comments: [],
    canModerateComments: false,
    userApplications: [],
    userAppOpenings: [],
    recruitmentQuestions: [],
    totalViews: 12400,
    viewer: null
  };
</script>

<PublicScanPage {data} form={null} />
