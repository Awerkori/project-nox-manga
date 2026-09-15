<script lang="ts">
  import ScanSidebar from '../../src/routes/scan/components/ScanSidebar.svelte';
  import PipelineStageView from '../../src/routes/scan/components/PipelineStageView.svelte';
  import ScanHome from '../../src/routes/scan/components/ScanHome.svelte';
  import WorkloadTab from '../../src/routes/scan/components/WorkloadTab.svelte';
  import ChatTab from '../../src/routes/scan/components/ChatTab.svelte';

  let { initialTab = 'pipeline', initialStage = 'clean_redraw', role = 'OWNER' } = $props<{
    initialTab?: string;
    initialStage?: string;
    role?: string;
  }>();

  let activeTab = $state(initialTab);
  let activeStageSlug = $state(initialStage);

  const mockUser = {
    id: 'user-awerkori',
    username: 'awerkori',
    display_name: 'Awerkori'
  };

  const mockScan = {
    id: 'scan-nox',
    name: 'Project Nox',
    slug: 'project-nox',
    description: 'Equipe oficial e núcleo de lançamentos do Project Nox.'
  };

  const mockWorks = [
    {
      id: 'work-1',
      title: 'Céu Distante',
      slug: 'ceu-distante',
      synopsis: 'Uma jornada cósmica por dimensões desconhecidas.',
      cover_id: null
    },
    {
      id: 'work-2',
      title: 'Crônicas do Demônio de Sangue',
      slug: 'cronicas-demonio',
      synopsis: 'Batalhas impiedosas no submundo das artes marciais.',
      cover_id: null
    }
  ];

  const mockChapters = [
    {
      id: 'pch-1',
      scan_id: 'scan-nox',
      work_id: 'work-1',
      chapter_number: 1,
      chapter_label: 'O Despertar',
      status: 'IN_PROGRESS',
      priority: 'NORMAL',
      work: mockWorks[0]
    },
    {
      id: 'pch-2',
      scan_id: 'scan-nox',
      work_id: 'work-1',
      chapter_number: 2,
      chapter_label: 'A Queda',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      work: mockWorks[0]
    },
    {
      id: 'pch-3',
      scan_id: 'scan-nox',
      work_id: 'work-2',
      chapter_number: 10,
      chapter_label: 'Fúria Sangrenta',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      work: mockWorks[1]
    }
  ];

  const mockStages = [
    { id: 'st-raw', slug: 'raw', name: 'RAW', dependencies: [] },
    { id: 'st-clean', slug: 'clean_redraw', name: 'Clean / Redraw', dependencies: ['raw'] },
    { id: 'st-trad', slug: 'traducao', name: 'Tradução', dependencies: ['raw'] },
    { id: 'st-type', slug: 'typeset', name: 'Typeset', dependencies: ['clean_redraw', 'traducao'] },
    { id: 'st-rev', slug: 'revisao', name: 'Revisão', dependencies: ['typeset'] },
    { id: 'st-qc', slug: 'qc', name: 'QC', dependencies: ['revisao'] },
    { id: 'st-ready', slug: 'ready', name: 'Pronto pra Upar', dependencies: ['qc'] }
  ];

  let mockChapterStages = $state([
    // Clean available (unclaimed)
    {
      id: 'cs-1',
      production_chapter_id: 'pch-1',
      stage_id: 'st-clean',
      stage: mockStages[1],
      status: 'AVAILABLE',
      assigned_to: null,
      notes: 'Capítulo sem reconstruções complexas.'
    },
    // Typeset for pch-1 (assigned to user-awerkori)
    {
      id: 'cs-2',
      production_chapter_id: 'pch-1',
      stage_id: 'st-type',
      stage: mockStages[3],
      status: 'IN_PROGRESS',
      assigned_to: 'user-awerkori',
      notes: null
    },
    // Tradução rework available
    {
      id: 'cs-3',
      production_chapter_id: 'pch-2',
      stage_id: 'st-trad',
      stage: mockStages[2],
      status: 'REWORK',
      assigned_to: null,
      rejection_reason: 'Corrigir termos da página 7 e revisar balões duplos.',
      notes: null
    },
    // RAW available urgent
    {
      id: 'cs-4',
      production_chapter_id: 'pch-3',
      stage_id: 'st-raw',
      stage: mockStages[0],
      status: 'AVAILABLE',
      assigned_to: null,
      notes: 'RAW de alta resolução.'
    }
  ]);

  const mockProductionFiles = [
    {
      id: 'file-clean-1',
      production_chapter_id: 'pch-1',
      stage_id: 'st-clean',
      stage_slug: 'clean_redraw',
      file_name: 'Ceu_Distante_Cap01_Clean.zip',
      byte_size: 18450000,
      version: 1,
      is_current: true
    },
    {
      id: 'file-trad-1',
      production_chapter_id: 'pch-1',
      stage_id: 'st-trad',
      stage_slug: 'traducao',
      file_name: 'Ceu_Distante_Cap01_Traducao.docx',
      byte_size: 52000,
      version: 1,
      is_current: true
    }
  ];

  const mockMembers = [
    {
      id: 'mem-1',
      user_id: 'user-awerkori',
      role: 'OWNER',
      member: mockUser
    },
    {
      id: 'mem-2',
      user_id: 'user-lucas',
      role: 'TRANSLATOR',
      member: {
        id: 'user-lucas',
        display_name: 'Lucas Tradutor',
        username: 'lucas_trad'
      }
    }
  ];

  let mockChannels = $state([
    { id: 'c-1', scan_id: 'scan-nox', name: 'avisos', type: 'ANNOUNCEMENT', display_order: 1 },
    { id: 'c-2', scan_id: 'scan-nox', name: 'geral', type: 'TEXT', display_order: 2 },
    { id: 'c-3', scan_id: 'scan-nox', name: 'producao', type: 'TEXT', display_order: 3 }
  ]);

  let mockMessages = $state([
    {
      id: 'msg-1',
      channel_id: 'c-2',
      user_id: 'user-awerkori',
      body: 'Bem-vindos ao chat de produção da scan!',
      created_at: new Date().toISOString(),
      member: mockUser
    }
  ]);

  function handleSelectTab(tabId: string, subParam?: string) {
    activeTab = tabId;
    if (tabId === 'pipeline' && subParam) {
      activeStageSlug = subParam;
    }
  }

  function handleSelectPipelineStage(slug: string) {
    activeTab = 'pipeline';
    activeStageSlug = slug;
  }
</script>

<div class="harness-root">
  <!-- Scan Sidebar Component -->
  <aside class="harness-sidebar">
    <ScanSidebar
      activeTab={activeTab}
      activeStage={activeStageSlug}
      userRole={role}
      unreadNotifications={0}
      unreadMessages={0}
      chapterStages={mockChapterStages}
      chapters={mockChapters}
      onSelectTab={handleSelectTab}
    />
  </aside>

  <!-- Main Viewport Area -->
  <main class="harness-content">
    {#if activeTab === 'home'}
      <ScanHome
        currentScan={mockScan}
        userProfile={mockUser}
        userRole={role}
        tasks={[]}
        stages={mockStages}
        chapters={mockChapters}
        chapterStages={mockChapterStages}
        works={mockWorks}
        muralPosts={[]}
        notifications={[]}
        qcIssues={[]}
        onNavigateTab={handleSelectTab}
        onOpenChapter={(ch: any) => console.log('Open chapter', ch)}
      />
    {:else if activeTab === 'pipeline'}
      <PipelineStageView
        currentStageSlug={activeStageSlug}
        scanId="scan-nox"
        currentUserId="user-awerkori"
        userRole={role}
        stages={mockStages}
        chapters={mockChapters}
        chapterStages={mockChapterStages}
        productionFiles={mockProductionFiles}
        works={mockWorks}
        onSelectStage={handleSelectPipelineStage}
        onOpenChapter={(ch: any) => console.log('Open chapter', ch)}
      />
    {:else if activeTab === 'workload'}
      <WorkloadTab
        team={mockMembers}
        chapterStages={mockChapterStages}
        chapters={mockChapters}
        works={mockWorks}
        stages={mockStages}
        currentUserId="user-awerkori"
        userRole={role}
        onOpenChapter={(ch: any) => console.log('Open chapter', ch)}
      />
    {:else if activeTab === 'chat'}
      <ChatTab
        scanId="scan-nox"
        channels={mockChannels}
        messages={mockMessages}
        currentUserId="user-awerkori"
        userRole={role}
        team={mockMembers}
        onChannelChange={(chId: string) => console.log('Channel', chId)}
      />
    {/if}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #08060f;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow-x: hidden;
  }

  .harness-root {
    display: flex;
    min-height: 100vh;
    background: #08060f;
    width: 100%;
    box-sizing: border-box;
  }

  .harness-sidebar {
    width: 250px;
    flex-shrink: 0;
    background: #0d0a18;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
  }

  .harness-content {
    flex: 1;
    min-width: 0;
    padding: 1.5rem;
    box-sizing: border-box;
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    .harness-root {
      flex-direction: column;
    }

    .harness-sidebar {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .harness-content {
      padding: 1rem 0.75rem;
    }
  }
</style>
