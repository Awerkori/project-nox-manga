<script lang="ts">
  import {
    ShieldCheck,
    BookOpen,
    Users,
    Globe,
    MessageSquare,
    ArrowLeft,
    UserPlus,
    Briefcase,
    CheckCircle2,
    X,
    AlertCircle,
    Star,
    Heart,
    Pin,
    PinOff,
    Trash2,
    Flag,
    Send,
    CornerDownRight,
    LayoutDashboard
  } from "@lucide/svelte";
  import { enhance } from "$app/forms";
  import WorkCard from "$lib/components/WorkCard.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import FluxerIcon from "$lib/components/icons/FluxerIcon.svelte";
  import DiscordIcon from "$lib/components/icons/DiscordIcon.svelte";
  import { relativeTime } from "$lib/types";
  import { onMount } from "svelte";

  let { data, form }: { data: any; form: any } = $props();

  // ONLY 4 PUBLIC TABS: Obras, Equipe, Recrutamento, Comentários
  type PublicScanTab = "works" | "members" | "recruitment" | "comments";

  const TAB_HASH: Record<PublicScanTab, string> = {
    works: "",
    members: "#equipe",
    recruitment: "#recrutamento",
    comments: "#comentarios"
  };

  const HASH_TAB: Record<string, PublicScanTab | undefined> = {
    "": "works",
    "#obras": "works",
    "#capitulos": "works",   // Graceful redirect of legacy chapters hash
    "#equipe": "members",
    "#membros": "members",
    "#recrutamento": "recruitment",
    "#vagas": "recruitment",
    "#atividade": "works",   // Graceful redirect of legacy activity hash
    "#comentarios": "comments"
  };

  let activeTab = $state<PublicScanTab>("works");
  let applyingOpening = $state<any>(null);
  let openingQuestions = $derived(
    (data.recruitmentQuestions || []).filter((q: any) => q.opening_id === applyingOpening?.id)
  );
  let isSubmitting = $state(false);

  // Comments interaction state
  let replyToId = $state<string | null>(null);
  let reportingComment = $state<any>(null);
  let reportReason = $state("");

  function formatNumber(n: number = 0) {
    return new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(n);
  }

  let currentWorks = $derived(
    (data.works || []).filter((w: any) => !w.scan_status || w.scan_status === "ACTIVE" || w.scan_status === "PAUSED")
  );
  let pastWorks = $derived(
    (data.works || []).filter((w: any) => w.scan_status === "COMPLETED" || w.scan_status === "ABANDONED")
  );

  // Group members logically
  let owners = $derived((data.members || []).filter((m: any) => m.role === "OWNER"));
  let admins = $derived((data.members || []).filter((m: any) => m.role === "ADMIN"));
  let otherMembers = $derived(
    (data.members || []).filter((m: any) => m.role !== "OWNER" && m.role !== "ADMIN")
  );

  let isRecruiting = $derived((data.openings || []).length > 0);

  // Threading for comments
  let rootComments = $derived(
    (data.comments || []).filter((c: any) => !c.parent_id)
  );
  let repliesMap = $derived.by(() => {
    const map: Record<string, any[]> = {};
    for (const c of (data.comments || [])) {
      if (c.parent_id) {
        (map[c.parent_id] ??= []).push(c);
      }
    }
    return map;
  });

  function openApplyModal(opening: any) {
    applyingOpening = opening;
  }

  function closeApplyModal() {
    applyingOpening = null;
  }

  function syncTabFromHash() {
    if (typeof window === "undefined") return;
    const tab = HASH_TAB[window.location.hash];
    if (tab) activeTab = tab;
  }

  function selectPublicTab(tab: PublicScanTab) {
    activeTab = tab;
    if (typeof window === "undefined") return;
    const nextHash = TAB_HASH[tab];
    if (window.location.hash !== nextHash) {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
    }
  }

  function getPositionColor(posName: string = ""): string {
    const p = posName.toLowerCase();
    if (p.includes("trad") || p.includes("trans")) return "role-cyan";
    if (p.includes("rev") || p.includes("proof")) return "role-emerald";
    if (p.includes("type") || p.includes("diag") || p.includes("letra")) return "role-purple";
    if (p.includes("clean") || p.includes("redr") || p.includes("raw")) return "role-amber";
    if (p.includes("qual") || p.includes("qc")) return "role-indigo";
    return "role-slate";
  }

  onMount(() => {
    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  });
</script>

<svelte:head>
  <title>{data.scan.name} — Scan {data.scan.is_official ? "Oficial" : "Parceira"} | Project Nox</title>
  <meta
    name="description"
    content={data.scan.description || `Perfil oficial de traduções de ${data.scan.name} no Project Nox.`}
  />
</svelte:head>

<div class="scan-profile-page">
  <!-- Immersive Cinematic Header Backdrop -->
  <header class="profile-hero-backdrop">
    <div class="hero-banner-image-wrap">
      {#if data.scan.banner_id}
        <img src="/media/{data.scan.banner_id}" alt="Banner de {data.scan.name}" class="hero-banner-img" />
      {:else}
        <div class="hero-banner-fallback" class:official-bg={data.scan.is_official}></div>
      {/if}
      <div class="hero-banner-fade"></div>
    </div>

    <!-- Navigation Breadcrumb -->
    <div class="profile-top-bar">
      <a href="/scans" class="btn-back-catalog">
        <ArrowLeft size={15} />
        <span>Voltar ao Hub de Scans</span>
      </a>

      {#if data.canAccessScanPanel}
        <a
          href={data.scanPanelUrl}
          class="btn-staff-cockpit"
          title="Acessar painel interno de gerenciamento desta scan"
        >
          <LayoutDashboard size={15} />
          <span>Painel da Scan</span>
        </a>
      {/if}
    </div>

    <!-- Hero Profile Identity Card -->
    <div class="profile-identity-container">
      <div class="profile-identity-card" class:is-official-card={data.scan.is_official}>
        <!-- Floating Logo Emblem -->
        <div class="profile-logo-frame" class:official-logo-rim={data.scan.is_official}>
          {#if data.scan.logo_id}
            <img src="/media/{data.scan.logo_id}" alt="Logo de {data.scan.name}" class="profile-logo-img" />
          {:else}
            <div class="profile-logo-fallback">
              {data.scan.name.charAt(0).toUpperCase()}
            </div>
          {/if}
        </div>

        <!-- Identity Meta & Details -->
        <div class="profile-identity-content">
          <div class="identity-header-row">
            <div class="title-and-badges">
              <h1 class="profile-title">{data.scan.name}</h1>
              <div class="verification-badges-row">
                {#if data.scan.is_official}
                  <span class="seal-official-gold">
                    <Star size={12} fill="#f59e0b" color="#f59e0b" />
                    <span>NÚCLEO OFICIAL PROJECT NOX</span>
                  </span>
                {:else}
                  <span class="seal-partner-cyan">
                    <ShieldCheck size={12} />
                    <span>SCAN PARCEIRA VERIFICADA</span>
                  </span>
                {/if}

                {#if isRecruiting}
                  <button
                    type="button"
                    class="seal-recruiting-beacon"
                    onclick={() => selectPublicTab("recruitment")}
                    title="Ver vagas disponíveis para esta equipe"
                  >
                    <span class="pulse-beacon green"></span>
                    <span>RECRUTANDO NOVOS TALENTOS</span>
                  </button>
                {/if}
              </div>
            </div>

            <!-- Social Links Cluster -->
            <div class="profile-social-dock">
              {#if data.scan.discord}
                <a href={data.scan.discord} target="_blank" rel="noopener noreferrer" class="social-dock-btn discord" title="Servidor oficial no Discord">
                  <DiscordIcon size={15} />
                  <span>Discord</span>
                </a>
              {/if}
              {#if data.scan.fluxer}
                <a href={data.scan.fluxer} target="_blank" rel="noopener noreferrer" class="social-dock-btn fluxer" title="Comunidade oficial no Fluxer">
                  <FluxerIcon size={15} />
                  <span>Fluxer</span>
                </a>
              {/if}
              {#if data.scan.website}
                <a href={data.scan.website} target="_blank" rel="noopener noreferrer" class="social-dock-btn website" title="Website oficial">
                  <Globe size={15} />
                  <span>Website</span>
                </a>
              {/if}
            </div>
          </div>

          <!-- Description -->
          <p class="profile-description">
            {data.scan.description || (data.scan.is_official ? "Scan oficial e núcleo editorial de traduções do Project Nox. Equipe dedicada à localização e diagramação de alta fidelidade." : "Grupo independente de tradução e edição parceiro da comunidade Project Nox.")}
          </p>

          <!-- Integrated Stats Dock (Sem caixas soltas e redundantes) -->
          <div class="profile-stats-dock">
            <div class="stat-dock-item">
              <span class="stat-dock-val">{data.works.length}</span>
              <span class="stat-dock-lbl">{data.works.length === 1 ? "Obra Ativa" : "Obras Ativas"}</span>
            </div>
            <div class="stat-dock-sep"></div>
            <div class="stat-dock-item">
              <span class="stat-dock-val">{formatNumber(data.totalViews)}</span>
              <span class="stat-dock-lbl">Leituras Totais</span>
            </div>
            <div class="stat-dock-sep"></div>
            <div class="stat-dock-item">
              <span class="stat-dock-val">{data.members.length}</span>
              <span class="stat-dock-lbl">{data.members.length === 1 ? "Integrante" : "Integrantes"}</span>
            </div>
            {#if isRecruiting}
              <div class="stat-dock-sep"></div>
              <div class="stat-dock-item stat-highlight-recruiting">
                <span class="stat-dock-val">{data.openings.length}</span>
                <span class="stat-dock-lbl">{data.openings.length === 1 ? "Vaga Aberta" : "Vagas Abertas"}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- 4 NAVIGATION TABS: Obras | Equipe | Recrutamento | Comentários -->
  <main class="profile-body-container">
    <nav class="profile-navigation-bar" aria-label="Abas da scan">
      <div class="nav-tabs-segmented">
        <!-- 1. Obras -->
        <button
          type="button"
          class="nav-tab-item"
          class:is-active={activeTab === "works"}
          onclick={() => selectPublicTab("works")}
        >
          <BookOpen size={16} class="tab-icon" />
          <span>Obras</span>
          <span class="tab-count-badge">{data.works.length}</span>
        </button>

        <!-- 2. Equipe -->
        <button
          type="button"
          class="nav-tab-item"
          class:is-active={activeTab === "members"}
          onclick={() => selectPublicTab("members")}
        >
          <Users size={16} class="tab-icon" />
          <span>Equipe</span>
          <span class="tab-count-badge">{data.members.length}</span>
        </button>

        <!-- 3. Recrutamento -->
        <button
          type="button"
          class="nav-tab-item tab-recruiting-btn"
          class:is-active={activeTab === "recruitment"}
          onclick={() => selectPublicTab("recruitment")}
        >
          <Briefcase size={16} class="tab-icon" />
          <span>Recrutamento</span>
          {#if isRecruiting}
            <span class="tab-count-badge badge-green">{data.openings.length}</span>
            <span class="pulse-beacon green small"></span>
          {:else}
            <span class="tab-count-badge">0</span>
          {/if}
        </button>

        <!-- 4. Comentários -->
        <button
          type="button"
          class="nav-tab-item"
          class:is-active={activeTab === "comments"}
          onclick={() => selectPublicTab("comments")}
        >
          <MessageSquare size={16} class="tab-icon" />
          <span>Comentários</span>
          <span class="tab-count-badge">{(data.comments || []).length}</span>
        </button>
      </div>
    </nav>

    <!-- Feedback Banner on Form Submission -->
    {#if form?.applicationSent}
      <div class="feedback-alert success-alert" role="alert">
        <CheckCircle2 size={22} class="alert-icon" />
        <div class="alert-body">
          <strong>Candidatura enviada com sucesso!</strong>
          <p>A equipe de liderança de <strong>{data.scan.name}</strong> recebeu suas respostas e analisará seu perfil.</p>
        </div>
      </div>
    {:else if form?.message}
      <div class="feedback-alert error-alert" role="alert">
        <AlertCircle size={22} class="alert-icon" />
        <div class="alert-body">
          <strong>Atenção</strong>
          <p>{form.message}</p>
        </div>
      </div>
    {/if}

    <!-- TAB VIEWPORT -->
    <div class="tab-pane-container">
      <!-- ====================================================================
           1. ABA: OBRAS
           ==================================================================== -->
      {#if activeTab === "works"}
        <section class="tab-section works-section">
          {#if currentWorks.length > 0}
            <div class="works-group-block">
              <div class="block-header-line">
                <div>
                  <h2 class="block-title">Projetos em Andamento</h2>
                  <p class="block-subtitle">Obras com publicação e tradução ativa por {data.scan.name}</p>
                </div>
                <span class="block-counter">{currentWorks.length} {currentWorks.length === 1 ? "título" : "títulos"}</span>
              </div>

              <div class="works-catalog-grid">
                {#each currentWorks as work (work.id)}
                  <WorkCard {work} />
                {/each}
              </div>
            </div>
          {/if}

          {#if pastWorks.length > 0}
            <div class="works-group-block past-works-block">
              <div class="block-header-line">
                <div>
                  <h2 class="block-title">Projetos Concluídos & Anteriores</h2>
                  <p class="block-subtitle">Obras finalizadas ou temporadas anteriores do catálogo</p>
                </div>
                <span class="block-counter">{pastWorks.length} {pastWorks.length === 1 ? "título" : "títulos"}</span>
              </div>

              <div class="works-catalog-grid">
                {#each pastWorks as work (work.id)}
                  <WorkCard {work} />
                {/each}
              </div>
            </div>
          {/if}

          {#if data.works.length === 0}
            <div class="empty-state-view">
              <BookOpen size={48} class="empty-icon" />
              <h3 class="empty-title">Nenhuma obra associada no catálogo</h3>
              <p class="empty-desc">Esta equipe ainda não possui obras públicas atribuídas no momento.</p>
            </div>
          {/if}
        </section>

      <!-- ====================================================================
           2. ABA: EQUIPE
           ==================================================================== -->
      {:else if activeTab === "members"}
        <section class="tab-section team-section">
          <div class="team-header-intro">
            <div>
              <h2 class="block-title">Integrantes da Equipe</h2>
              <p class="block-subtitle">Profissionais e voluntários dedicados à tradução, edição e revisão</p>
            </div>
            <span class="block-counter">{data.members.length} {data.members.length === 1 ? "membro" : "membros"}</span>
          </div>

          {#if data.members.length > 0}
            <!-- 1. Liderança / Dono -->
            {#if owners.length > 0}
              <div class="team-tier-block">
                <div class="tier-label-row">
                  <Star size={15} fill="#f59e0b" color="#f59e0b" />
                  <span class="tier-label-text gold">Liderança & Direção</span>
                </div>

                <div class="team-grid leadership-grid">
                  {#each owners as member (member.id)}
                    <article class="member-profile-card is-leadership">
                      <div class="member-avatar-cell">
                        <UserAvatar user={member} size={58} />
                      </div>
                      <div class="member-info-cell">
                        <div class="member-name-badge-row">
                          <a href="/u/{member.username}" class="member-display-name">
                            {member.display_name || member.username}
                          </a>
                          <span class="badge-role-gold">👑 Líder</span>
                        </div>
                        <span class="member-username">@{member.username}</span>

                        <div class="member-positions-cluster">
                          {#if member.positions && member.positions.length > 0}
                            {#each member.positions as pos (pos.id ?? pos.slug ?? pos.name)}
                              <span class="pos-chip {getPositionColor(pos.name)}">{pos.name}</span>
                            {/each}
                          {:else}
                            <span class="pos-chip role-amber">Diretor Editorial</span>
                          {/if}
                        </div>
                      </div>
                    </article>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- 2. Administração -->
            {#if admins.length > 0}
              <div class="team-tier-block">
                <div class="tier-label-row">
                  <ShieldCheck size={15} color="#818cf8" />
                  <span class="tier-label-text purple">Administração & Coordenação</span>
                </div>

                <div class="team-grid">
                  {#each admins as member (member.id)}
                    <article class="member-profile-card is-admin">
                      <div class="member-avatar-cell">
                        <UserAvatar user={member} size={52} />
                      </div>
                      <div class="member-info-cell">
                        <div class="member-name-badge-row">
                          <a href="/u/{member.username}" class="member-display-name">
                            {member.display_name || member.username}
                          </a>
                          <span class="badge-role-admin">Admin</span>
                        </div>
                        <span class="member-username">@{member.username}</span>

                        <div class="member-positions-cluster">
                          {#if member.positions && member.positions.length > 0}
                            {#each member.positions as pos (pos.id ?? pos.slug ?? pos.name)}
                              <span class="pos-chip {getPositionColor(pos.name)}">{pos.name}</span>
                            {/each}
                          {:else}
                            <span class="pos-chip role-indigo">Administrador</span>
                          {/if}
                        </div>
                      </div>
                    </article>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- 3. Corpo Editorial -->
            {#if otherMembers.length > 0}
              <div class="team-tier-block">
                <div class="tier-label-row">
                  <Users size={15} color="#94a3b8" />
                  <span class="tier-label-text">Corpo Editorial & Tradução</span>
                </div>

                <div class="team-grid">
                  {#each otherMembers as member (member.id)}
                    <article class="member-profile-card">
                      <div class="member-avatar-cell">
                        <UserAvatar user={member} size={48} />
                      </div>
                      <div class="member-info-cell">
                        <div class="member-name-badge-row">
                          <a href="/u/{member.username}" class="member-display-name">
                            {member.display_name || member.username}
                          </a>
                          {#if member.role === "UPLOADER"}
                            <span class="badge-role-uploader">Uploader</span>
                          {/if}
                        </div>
                        <span class="member-username">@{member.username}</span>

                        <div class="member-positions-cluster">
                          {#if member.positions && member.positions.length > 0}
                            {#each member.positions as pos (pos.id ?? pos.slug ?? pos.name)}
                              <span class="pos-chip {getPositionColor(pos.name)}">{pos.name}</span>
                            {/each}
                          {:else}
                            <span class="pos-chip role-slate">Membro Editorial</span>
                          {/if}
                        </div>
                      </div>
                    </article>
                  {/each}
                </div>
              </div>
            {/if}

          {:else}
            <div class="empty-state-view">
              <Users size={48} class="empty-icon" />
              <h3 class="empty-title">Nenhum membro público registrado</h3>
              <p class="empty-desc">Os dados de equipe estão sendo atualizados pela administração da scan.</p>
            </div>
          {/if}
        </section>

      <!-- ====================================================================
           3. ABA: RECRUTAMENTO (TOTALMENTE REDESENHADO)
           ==================================================================== -->
      {:else if activeTab === "recruitment"}
        <section class="tab-section recruitment-section">
          <!-- Recruitment Hero Banner -->
          <div class="recruitment-banner-card">
            <div class="recruitment-banner-info">
              <div class="recruitment-beacon-tag">
                <span class="pulse-beacon green"></span>
                <span>QUADRO DE OPORTUNIDADES</span>
              </div>
              <h2 class="recruitment-main-title">Faça parte da equipe {data.scan.name}</h2>
              <p class="recruitment-main-lead">
                Trabalhe na tradução, revisão, limpeza e diagramação de mangás e webtoons no Project Nox. Ganhe experiência real, visibilidade na comunidade e participe de projetos de ponta.
              </p>
            </div>
          </div>

          {#if isRecruiting}
            <div class="openings-cards-grid">
              {#each data.openings as opening (opening.id)}
                {@const alreadyApplied = (data.userAppOpenings || []).includes(opening.id)}
                <article class="opening-detail-card">
                  <div class="opening-card-top-bar">
                    <div class="opening-pos-indicator">
                      <Briefcase size={15} />
                      <span>{opening.positionName || "Função Editorial"}</span>
                    </div>

                    <span class="opening-active-pill">
                      <span class="pulse-beacon green"></span>
                      <span>Vaga Disponível</span>
                    </span>
                  </div>

                  <h3 class="opening-title-head">{opening.title}</h3>

                  {#if opening.description}
                    <p class="opening-description-text">{opening.description}</p>
                  {/if}

                  <!-- Meta Details Grid -->
                  <div class="opening-specs-grid">
                    {#if opening.language}
                      <div class="spec-cell">
                        <span class="spec-name">Idioma de Origem</span>
                        <span class="spec-value">{opening.language}</span>
                      </div>
                    {/if}

                    {#if opening.experience_level && opening.experience_level !== "QUALQUER"}
                      <div class="spec-cell">
                        <span class="spec-name">Nível Desejado</span>
                        <span class="spec-value">{opening.experience_level}</span>
                      </div>
                    {/if}

                    {#if opening.availability}
                      <div class="spec-cell">
                        <span class="spec-name">Disponibilidade</span>
                        <span class="spec-value">{opening.availability}</span>
                      </div>
                    {/if}

                    <div class="spec-cell">
                      <span class="spec-name">Fluxo de Vagas</span>
                      <span class="spec-value">{opening.slots ? `${opening.slots} ${opening.slots === 1 ? 'posição' : 'posições'}` : 'Seleção Contínua'}</span>
                    </div>
                  </div>

                  {#if opening.requirements}
                    <div class="opening-requirements-block">
                      <span class="req-title">Requisitos & Conhecimentos:</span>
                      <p class="req-text">{opening.requirements}</p>
                    </div>
                  {/if}

                  <!-- Card Action Footer -->
                  <div class="opening-footer-action">
                    {#if alreadyApplied}
                      <div class="applied-status-badge">
                        <CheckCircle2 size={16} />
                        <span>Candidatura Já Enviada</span>
                      </div>
                    {:else if !data.viewer}
                      <a
                        href={`/auth?redirect=${encodeURIComponent(`/scans/${data.scan.slug}#recrutamento`)}`}
                        class="btn-apply-primary"
                      >
                        <UserPlus size={15} />
                        <span>Entrar para Candidatar-se</span>
                      </a>
                    {:else}
                      <button
                        type="button"
                        class="btn-apply-primary"
                        onclick={() => openApplyModal(opening)}
                      >
                        <UserPlus size={15} />
                        <span>Candidatar-se à Vaga</span>
                      </button>
                    {/if}
                  </div>
                </article>
              {/each}
            </div>
          {:else}
            <div class="empty-state-view">
              <Briefcase size={48} class="empty-icon" />
              <h3 class="empty-title">Nenhuma vaga aberta no momento</h3>
              <p class="empty-desc">A equipe de {data.scan.name} está com o quadro completo no momento. Fique atento a futuros comunicados!</p>
            </div>
          {/if}
        </section>

      <!-- ====================================================================
           4. ABA: COMENTÁRIOS (COM AVATARES REAIS PRESERVADOS)
           ==================================================================== -->
      {:else if activeTab === "comments"}
        <section class="tab-section comments-section">
          <div class="comments-section-header">
            <div>
              <h2 class="block-title">Mural da Comunidade</h2>
              <p class="block-subtitle">Envie mensagens de apoio, feedback sobre capítulos e recados para a equipe</p>
            </div>
            <span class="block-counter">
              {(data.comments || []).length} {(data.comments || []).length === 1 ? "comentário" : "comentários"}
            </span>
          </div>

          <!-- New Comment Composer -->
          {#if data.viewer}
            <form
              method="POST"
              action="?/postComment"
              use:enhance={() => {
                isSubmitting = true;
                return async ({ update }) => {
                  isSubmitting = false;
                  await update();
                };
              }}
              class="composer-panel"
            >
              <input type="hidden" name="scan_id" value={data.scan.id} />

              <div class="composer-body-row">
                <div class="composer-avatar-slot">
                  <!-- Canonical UserAvatar: Preserves user's equipped avatar & frame -->
                  <UserAvatar user={data.viewer} size={44} />
                </div>

                <div class="composer-input-area">
                  <textarea
                    name="body"
                    rows="3"
                    maxlength="2000"
                    placeholder="Deixe um recado para a equipe de {data.scan.name}..."
                    required
                    class="composer-input-field"
                  ></textarea>

                  <div class="composer-dock-footer">
                    <span class="composer-dock-hint">
                      Respeite a equipe editorial e as diretrizes do Project Nox.
                    </span>
                    <button type="submit" class="btn-send-comment" disabled={isSubmitting}>
                      <Send size={14} />
                      <span>{isSubmitting ? "Enviando..." : "Publicar Comentário"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          {:else}
            <div class="composer-login-prompt">
              <MessageSquare size={26} class="prompt-icon" />
              <div class="prompt-text">
                <strong>Deseja enviar uma mensagem para a equipe?</strong>
                <p>Faça login ou crie sua conta para participar do mural de recados desta scan.</p>
              </div>
              <a
                href={`/auth?redirect=${encodeURIComponent(`/scans/${data.scan.slug}#comentarios`)}`}
                class="btn-prompt-login"
              >
                Conectar-se
              </a>
            </div>
          {/if}

          <!-- Comments List Feed -->
          {#if rootComments.length > 0}
            <div class="comments-feed">
              {#each rootComments as comment (comment.id)}
                {@const replies = repliesMap[comment.id] || []}
                <article class="comment-bubble-card" class:is-pinned-card={comment.pinned}>
                  {#if comment.pinned}
                    <div class="pinned-notice-bar">
                      <Pin size={13} />
                      <span>Comentário Fixado pela Moderação</span>
                    </div>
                  {/if}

                  <div class="comment-layout-row">
                    <div class="comment-avatar-slot">
                      <UserAvatar user={comment.author} size={42} />
                    </div>

                    <div class="comment-content-slot">
                      <!-- Author Meta -->
                      <div class="comment-author-bar">
                        <div class="author-info-group">
                          <a href="/u/{comment.author?.username}" class="author-name-link">
                            {comment.author?.display_name || comment.author?.username || "Leitor"}
                          </a>
                          {#if comment.isStaff}
                            <span class="staff-author-badge">Equipe Scan</span>
                          {/if}
                        </div>
                        <time class="comment-time-stamp">{relativeTime(comment.created_at)}</time>
                      </div>

                      <!-- Text -->
                      <p class="comment-text-body">{comment.body}</p>

                      <!-- Actions Bar -->
                      <div class="comment-actions-dock">
                        <!-- Like Form -->
                        <form method="POST" action="?/likeComment" use:enhance class="action-inline-form">
                          <input type="hidden" name="comment_id" value={comment.id} />
                          <button
                            type="submit"
                            class="action-dock-btn"
                            class:is-active-heart={comment.isLiked}
                            title={comment.isLiked ? "Descurtir" : "Curtir"}
                          >
                            <Heart size={14} fill={comment.isLiked ? "#f43f5e" : "none"} color={comment.isLiked ? "#f43f5e" : "currentColor"} />
                            <span>{comment.likesCount}</span>
                          </button>
                        </form>

                        {#if data.viewer}
                          <button
                            type="button"
                            class="action-dock-btn"
                            onclick={() => (replyToId = replyToId === comment.id ? null : comment.id)}
                          >
                            <MessageSquare size={14} />
                            <span>Responder</span>
                          </button>
                        {/if}

                        {#if comment.canModerate}
                          <form method="POST" action="?/moderateComment" use:enhance class="action-inline-form">
                            <input type="hidden" name="comment_id" value={comment.id} />
                            <input
                              type="hidden"
                              name="action_type"
                              value={comment.pinned ? "UNPIN" : "PIN"}
                            />
                            <button
                              type="submit"
                              class="action-dock-btn mod-btn"
                              title={comment.pinned ? "Desafixar comentário" : "Fixar comentário no topo"}
                            >
                              {#if comment.pinned}
                                <PinOff size={14} />
                                <span>Desafixar</span>
                              {:else}
                                <Pin size={14} />
                                <span>Fixar</span>
                              {/if}
                            </button>
                          </form>
                        {/if}

                        {#if comment.canDelete}
                          <form
                            method="POST"
                            action="?/moderateComment"
                            use:enhance={() => {
                              if (!confirm("Tem certeza que deseja excluir este comentário?")) return () => {};
                              return async ({ update }) => { await update(); };
                            }}
                            class="action-inline-form"
                          >
                            <input type="hidden" name="comment_id" value={comment.id} />
                            <input type="hidden" name="action_type" value="REMOVE" />
                            <button
                              type="submit"
                              class="action-dock-btn delete-btn"
                              title="Excluir comentário"
                            >
                              <Trash2 size={14} />
                              <span>Excluir</span>
                            </button>
                          </form>
                        {/if}

                        {#if data.viewer && comment.user_id !== data.viewer.id}
                          <button
                            type="button"
                            class="action-dock-btn report-btn"
                            onclick={() => (reportingComment = comment)}
                            title="Denunciar este comentário"
                          >
                            <Flag size={13} />
                          </button>
                        {/if}
                      </div>

                      <!-- Inline Reply Composer -->
                      {#if replyToId === comment.id && data.viewer}
                        <form
                          method="POST"
                          action="?/postComment"
                          use:enhance={() => {
                            isSubmitting = true;
                            return async ({ update }) => {
                              isSubmitting = false;
                              replyToId = null;
                              await update();
                            };
                          }}
                          class="reply-composer-box"
                        >
                          <input type="hidden" name="scan_id" value={data.scan.id} />
                          <input type="hidden" name="parent_id" value={comment.id} />

                          <textarea
                            name="body"
                            rows="2"
                            maxlength="2000"
                            placeholder="Escreva sua resposta para @{comment.author?.username || 'usuário'}..."
                            required
                            class="reply-textarea-field"
                          ></textarea>

                          <div class="reply-composer-actions">
                            <button
                              type="button"
                              class="btn-reply-cancel"
                              onclick={() => (replyToId = null)}
                            >
                              Cancelar
                            </button>
                            <button type="submit" class="btn-reply-send" disabled={isSubmitting}>
                              <Send size={13} />
                              <span>Enviar Resposta</span>
                            </button>
                          </div>
                        </form>
                      {/if}

                      <!-- Nested Replies Feed -->
                      {#if replies.length > 0}
                        <div class="nested-replies-feed">
                          {#each replies as reply (reply.id)}
                            <div class="nested-reply-card">
                              <div class="reply-turn-indicator">
                                <CornerDownRight size={14} />
                              </div>

                              <div class="reply-avatar-slot">
                                <UserAvatar user={reply.author} size={32} />
                              </div>

                              <div class="reply-content-slot">
                                <div class="comment-author-bar">
                                  <div class="author-info-group">
                                    <a href="/u/{reply.author?.username}" class="author-name-link">
                                      {reply.author?.display_name || reply.author?.username || "Leitor"}
                                    </a>
                                    {#if reply.isStaff}
                                      <span class="staff-author-badge">Equipe Scan</span>
                                    {/if}
                                  </div>
                                  <time class="comment-time-stamp">{relativeTime(reply.created_at)}</time>
                                </div>

                                <p class="comment-text-body">{reply.body}</p>

                                <div class="comment-actions-dock">
                                  <form method="POST" action="?/likeComment" use:enhance class="action-inline-form">
                                    <input type="hidden" name="comment_id" value={reply.id} />
                                    <button
                                      type="submit"
                                      class="action-dock-btn"
                                      class:is-active-heart={reply.isLiked}
                                      title={reply.isLiked ? "Descurtir" : "Curtir"}
                                    >
                                      <Heart size={13} fill={reply.isLiked ? "#f43f5e" : "none"} color={reply.isLiked ? "#f43f5e" : "currentColor"} />
                                      <span>{reply.likesCount}</span>
                                    </button>
                                  </form>

                                  {#if reply.canDelete}
                                    <form
                                      method="POST"
                                      action="?/moderateComment"
                                      use:enhance={() => {
                                        if (!confirm("Excluir esta resposta?")) return () => {};
                                        return async ({ update }) => { await update(); };
                                      }}
                                      class="action-inline-form"
                                    >
                                      <input type="hidden" name="comment_id" value={reply.id} />
                                      <input type="hidden" name="action_type" value="REMOVE" />
                                      <button type="submit" class="action-dock-btn delete-btn">
                                        <Trash2 size={13} />
                                        <span>Excluir</span>
                                      </button>
                                    </form>
                                  {/if}

                                  {#if data.viewer && reply.user_id !== data.viewer.id}
                                    <button
                                      type="button"
                                      class="action-dock-btn report-btn"
                                      onclick={() => (reportingComment = reply)}
                                      title="Denunciar resposta"
                                    >
                                      <Flag size={12} />
                                    </button>
                                  {/if}
                                </div>
                              </div>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>
                </article>
              {/each}
            </div>
          {:else}
            <div class="empty-state-view">
              <MessageSquare size={48} class="empty-icon" />
              <h3 class="empty-title">Nenhum comentário publicado ainda</h3>
              <p class="empty-desc">Seja o primeiro a deixar uma mensagem de incentivo ou feedback para {data.scan.name}!</p>
            </div>
          {/if}
        </section>
      {/if}
    </div>
  </main>
</div>

<!-- ==========================================================================
     APPLICATION MODAL
     ========================================================================== -->
{#if applyingOpening}
  <div
    class="modal-backdrop-layer"
    onclick={closeApplyModal}
    onkeydown={(e) => e.key === "Escape" && closeApplyModal()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-dialog-box" onclick={(e) => e.stopPropagation()} role="presentation">
      <div class="modal-dialog-header">
        <div class="modal-head-titles">
          <div class="modal-role-pill">
            <Briefcase size={14} />
            <span>{applyingOpening.positionName || "Vaga Editorial"}</span>
          </div>
          <h2 class="modal-dialog-title">Candidatar-se: {applyingOpening.title}</h2>
          <span class="modal-team-tag">Equipe: {data.scan.name}</span>
        </div>
        <button class="modal-close-btn" onclick={closeApplyModal} type="button" aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      <form
        method="POST"
        action="?/apply"
        use:enhance={() => {
          isSubmitting = true;
          return async ({ update }) => {
            isSubmitting = false;
            closeApplyModal();
            await update();
          };
        }}
        class="modal-form-content"
      >
        <input type="hidden" name="opening_id" value={applyingOpening.id} />

        <div class="form-field-group">
          <label for="experience" class="form-field-label">
            Experiência Prévia *
          </label>
          <textarea
            id="experience"
            name="experience"
            rows="3"
            required
            placeholder="Conte se já trabalhou com tradução/edição de mangás ou se é iniciante dedicado..."
            class="form-field-textarea"
          ></textarea>
        </div>

        <div class="form-field-group">
          <label for="availability" class="form-field-label">
            Disponibilidade de Tempo *
          </label>
          <input
            id="availability"
            name="availability"
            type="text"
            required
            placeholder="Ex: 2 a 3 capítulos por semana, noites ou finais de semana..."
            class="form-field-input"
          />
        </div>

        <div class="form-field-group">
          <label for="presentation" class="form-field-label">
            Mensagem / Apresentação *
          </label>
          <textarea
            id="presentation"
            name="presentation"
            rows="3"
            required
            placeholder="Apresente-se para os líderes da scan e explique por que deseja fazer parte..."
            class="form-field-textarea"
          ></textarea>
        </div>

        <div class="form-field-group">
          <label for="portfolio_url" class="form-field-label">
            Link de Portfólio / Amostra de Trabalho (Opcional)
          </label>
          <input
            id="portfolio_url"
            name="portfolio_url"
            type="url"
            placeholder="https://drive.google.com/... ou link de trabalhos anteriores"
            class="form-field-input"
          />
        </div>

        <div class="form-field-group">
          <label for="contact_info" class="form-field-label">
            Contato Adicional (Opcional)
          </label>
          <input
            id="contact_info"
            name="contact_info"
            type="text"
            placeholder="Discord (ex: usuario#0000) ou email preferencial..."
            class="form-field-input"
          />
        </div>

        {#if openingQuestions.length > 0}
          <div class="custom-questions-card">
            <h4 class="custom-questions-title">Perguntas Específicas da Vaga</h4>
            {#each openingQuestions as q (q.id)}
              <div class="form-field-group">
                <label for="q-{q.id}" class="form-field-label">
                  {q.question} {q.required ? "*" : "(Opcional)"}
                </label>
                {#if q.question_type === "TEXT_LONG"}
                  <textarea
                    id="q-{q.id}"
                    name="question_{q.id}"
                    rows="3"
                    required={q.required}
                    class="form-field-textarea"
                    placeholder="Sua resposta..."
                  ></textarea>
                {:else if q.question_type === "YES_NO"}
                  <select id="q-{q.id}" name="question_{q.id}" required={q.required} class="form-field-select">
                    <option value="">Selecione...</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                {:else if q.question_type === "SINGLE_CHOICE"}
                  {@const opts = Array.isArray(q.options) ? q.options : []}
                  <select id="q-{q.id}" name="question_{q.id}" required={q.required} class="form-field-select">
                    <option value="">Selecione uma opção...</option>
                    {#each opts as opt (opt)}
                      <option value={opt}>{opt}</option>
                    {/each}
                  </select>
                {:else}
                  <input
                    id="q-{q.id}"
                    name="question_{q.id}"
                    type="text"
                    required={q.required}
                    class="form-field-input"
                    placeholder="Sua resposta..."
                  />
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="modal-dialog-actions">
          <button type="button" class="btn-dialog-cancel" onclick={closeApplyModal}>Cancelar</button>
          <button type="submit" class="btn-dialog-submit" disabled={isSubmitting}>
            <UserPlus size={15} />
            <span>{isSubmitting ? "Enviando..." : "Enviar Candidatura"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ==========================================================================
     COMMENT REPORT MODAL
     ========================================================================== -->
{#if reportingComment}
  <div
    class="modal-backdrop-layer"
    onclick={() => (reportingComment = null)}
    onkeydown={(e) => e.key === "Escape" && (reportingComment = null)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-dialog-box modal-compact" onclick={(e) => e.stopPropagation()} role="presentation">
      <div class="modal-dialog-header">
        <div class="modal-head-titles">
          <div class="modal-role-pill report-pill">
            <Flag size={14} />
            <span>Denúncia de Comentário</span>
          </div>
          <h2 class="modal-dialog-title">Denunciar @{reportingComment.author?.username}</h2>
        </div>
        <button class="modal-close-btn" onclick={() => (reportingComment = null)} type="button">
          <X size={18} />
        </button>
      </div>

      <form
        method="POST"
        action="?/reportComment"
        use:enhance={() => {
          isSubmitting = true;
          return async ({ update }) => {
            isSubmitting = false;
            reportingComment = null;
            reportReason = "";
            await update();
          };
        }}
        class="modal-form-content"
      >
        <input type="hidden" name="comment_id" value={reportingComment.id} />

        <div class="reported-quote-box">
          <p>"{reportingComment.body}"</p>
        </div>

        <div class="form-field-group">
          <label for="report_reason" class="form-field-label">Motivo da Denúncia *</label>
          <textarea
            id="report_reason"
            name="reason"
            rows="3"
            required
            maxlength="500"
            bind:value={reportReason}
            placeholder="Descreva o motivo (ex: spam, ofensas, assédio, spoiler indevido)..."
            class="form-field-textarea"
          ></textarea>
        </div>

        <div class="modal-dialog-actions">
          <button type="button" class="btn-dialog-cancel" onclick={() => (reportingComment = null)}>
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-dialog-submit report-submit"
            disabled={isSubmitting || reportReason.trim().length < 2}
          >
            <Flag size={14} />
            <span>Enviar Denúncia</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  /* ==========================================================================
     PAGE WRAPPER & CINEMATIC BACKDROP
     ========================================================================== */
  .scan-profile-page {
    min-height: 100vh;
    color: #e2e8f0;
    background: #090c15;
    padding-bottom: 6rem;
  }

  .profile-hero-backdrop {
    position: relative;
    width: 100%;
    background: #0d111d;
    padding-top: 1.5rem;
    padding-bottom: 2.5rem;
  }

  .hero-banner-image-wrap {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 320px;
    overflow: hidden;
    z-index: 0;
  }

  .hero-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 30%;
  }

  .hero-banner-fallback {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
  }

  .hero-banner-fallback.official-bg {
    background: radial-gradient(circle at 70% 30%, rgba(245, 158, 11, 0.22), transparent 70%),
      linear-gradient(135deg, #2b1f14 0%, #1e1b4b 60%, #0f172a 100%);
  }

  .hero-banner-fade {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(9, 12, 21, 0.2) 0%,
      rgba(9, 12, 21, 0.6) 50%,
      rgba(9, 12, 21, 0.98) 95%,
      #090c15 100%
    );
  }

  /* Top Bar: Back & Staff Cockpit */
  .profile-top-bar {
    position: relative;
    z-index: 2;
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 1.5rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-back-catalog {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 9999px;
    padding: 0.45rem 0.95rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: #cbd5e1;
    text-decoration: none;
    backdrop-filter: blur(12px);
    transition: all 0.2s ease;
  }

  .btn-back-catalog:hover {
    background: rgba(0, 0, 0, 0.8);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateX(-2px);
  }

  /* Executive Staff Cockpit Button */
  .btn-staff-cockpit {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(124, 58, 237, 0.2) 100%);
    border: 1px solid rgba(245, 158, 11, 0.4);
    border-radius: 9999px;
    padding: 0.45rem 1rem;
    font-size: 0.82rem;
    font-weight: 800;
    color: #fde68a;
    text-decoration: none;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.2);
    transition: all 0.2s ease;
  }

  .btn-staff-cockpit:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.28) 0%, rgba(124, 58, 237, 0.35) 100%);
    border-color: #f59e0b;
    color: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.35);
  }

  /* Identity Container */
  .profile-identity-container {
    position: relative;
    z-index: 2;
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }

  .profile-identity-card {
    display: flex;
    align-items: flex-start;
    gap: 2rem;
    background: linear-gradient(135deg, rgba(17, 22, 39, 0.95) 0%, rgba(11, 15, 27, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 24px;
    padding: 2.25rem;
    box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(20px);
  }

  .profile-identity-card.is-official-card {
    border-color: rgba(245, 158, 11, 0.3);
  }

  /* Logo Frame */
  .profile-logo-frame {
    width: 110px;
    height: 110px;
    border-radius: 24px;
    overflow: hidden;
    background: #0b0e19;
    border: 3px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 16px 32px rgba(0, 0, 0, 0.6);
    flex-shrink: 0;
  }

  .profile-logo-frame.official-logo-rim {
    border-color: #f59e0b;
    box-shadow: 0 0 28px rgba(245, 158, 11, 0.35), 0 16px 32px rgba(0, 0, 0, 0.6);
  }

  .profile-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-logo-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.85rem;
    font-weight: 900;
    background: linear-gradient(135deg, #7c3aed 0%, #4338ca 100%);
    color: #ffffff;
  }

  /* Identity Content */
  .profile-identity-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
  }

  .identity-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .title-and-badges {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .profile-title {
    font-family: "Manrope", sans-serif;
    font-size: 2.35rem;
    font-weight: 850;
    color: #ffffff;
    line-height: 1.15;
    margin: 0;
    letter-spacing: -0.025em;
  }

  .verification-badges-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }

  .seal-official-gold {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(245, 158, 11, 0.16);
    border: 1px solid rgba(245, 158, 11, 0.45);
    border-radius: 6px;
    padding: 0.22rem 0.65rem;
    font-size: 0.72rem;
    font-weight: 800;
    color: #fbbf24;
    letter-spacing: 0.04em;
  }

  .seal-partner-cyan {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(14, 165, 233, 0.16);
    border: 1px solid rgba(14, 165, 233, 0.45);
    border-radius: 6px;
    padding: 0.22rem 0.65rem;
    font-size: 0.72rem;
    font-weight: 800;
    color: #38bdf8;
    letter-spacing: 0.04em;
  }

  .seal-recruiting-beacon {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(16, 185, 129, 0.14);
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: 6px;
    padding: 0.22rem 0.65rem;
    font-size: 0.72rem;
    font-weight: 800;
    color: #34d399;
    cursor: pointer;
    transition: all 0.2s;
  }

  .seal-recruiting-beacon:hover {
    background: rgba(16, 185, 129, 0.25);
  }

  .pulse-beacon {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }

  .pulse-beacon.small {
    width: 5px;
    height: 5px;
  }

  /* Social Dock */
  .profile-social-dock {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .social-dock-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 9999px;
    padding: 0.4rem 0.85rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: #cbd5e1;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .social-dock-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .social-dock-btn.discord:hover {
    background: rgba(88, 101, 242, 0.25);
    border-color: rgba(88, 101, 242, 0.5);
    color: #c7d2fe;
  }

  .social-dock-btn.fluxer:hover {
    background: rgba(14, 165, 233, 0.25);
    border-color: rgba(14, 165, 233, 0.5);
    color: #bae6fd;
  }

  .social-dock-btn.website:hover {
    background: rgba(168, 85, 247, 0.25);
    border-color: rgba(168, 85, 247, 0.5);
    color: #f3e8ff;
  }

  /* Description */
  .profile-description {
    font-size: 0.95rem;
    color: #94a3b8;
    line-height: 1.65;
    margin: 0;
    max-width: 860px;
  }

  /* Integrated Stats Dock */
  .profile-stats-dock {
    display: inline-flex;
    align-items: center;
    gap: 1.5rem;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 0.75rem 1.25rem;
    align-self: flex-start;
  }

  .stat-dock-item {
    display: flex;
    flex-direction: column;
  }

  .stat-dock-val {
    font-family: "Manrope", sans-serif;
    font-size: 1.25rem;
    font-weight: 850;
    color: #ffffff;
    line-height: 1;
  }

  .stat-dock-lbl {
    font-size: 0.74rem;
    color: #64748b;
    margin-top: 0.25rem;
    font-weight: 600;
  }

  .stat-dock-sep {
    width: 1px;
    height: 28px;
    background: rgba(255, 255, 255, 0.08);
  }

  .stat-highlight-recruiting .stat-dock-val {
    color: #34d399;
  }

  .stat-highlight-recruiting .stat-dock-lbl {
    color: #a7f3d0;
  }

  /* ==========================================================================
     4 NAVIGATION TABS (SEGMENTED BAR)
     ========================================================================== */
  .profile-body-container {
    max-width: 1280px;
    margin: 2.25rem auto 0;
    padding: 0 1.5rem;
  }

  .profile-navigation-bar {
    margin-bottom: 2.25rem;
  }

  .nav-tabs-segmented {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(17, 21, 38, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 0.4rem;
    backdrop-filter: blur(16px);
  }

  .nav-tab-item {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    background: transparent;
    border: none;
    border-radius: 12px;
    padding: 0.75rem 1.15rem;
    font-size: 0.9rem;
    font-weight: 700;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .nav-tab-item:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
  }

  .nav-tab-item.is-active {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%);
    border: 1px solid rgba(139, 92, 246, 0.45);
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
  }

  .tab-count-badge {
    background: rgba(0, 0, 0, 0.4);
    border-radius: 9999px;
    padding: 0.15rem 0.5rem;
    font-size: 0.72rem;
    font-weight: 800;
    color: inherit;
  }

  .badge-green {
    background: rgba(16, 185, 129, 0.25);
    color: #34d399;
  }

  /* Feedback Alert */
  .feedback-alert {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 2rem;
  }

  .success-alert {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #34d399;
  }

  .error-alert {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #f87171;
  }

  .alert-body strong {
    display: block;
    font-size: 0.95rem;
    margin-bottom: 0.2rem;
  }

  .alert-body p {
    margin: 0;
    font-size: 0.88rem;
    color: #cbd5e1;
  }

  /* ==========================================================================
     TAB PANE: OBRAS
     ========================================================================== */
  .works-section {
    display: flex;
    flex-direction: column;
    gap: 2.75rem;
  }

  .block-header-line {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding-bottom: 0.85rem;
  }

  .block-title {
    font-family: "Manrope", sans-serif;
    font-size: 1.35rem;
    font-weight: 850;
    color: #ffffff;
    margin: 0 0 0.25rem;
  }

  .block-subtitle {
    font-size: 0.86rem;
    color: #94a3b8;
    margin: 0;
  }

  .block-counter {
    font-size: 0.82rem;
    font-weight: 700;
    color: #64748b;
  }

  .works-catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1.5rem;
  }

  /* ==========================================================================
     TAB PANE: EQUIPE
     ========================================================================== */
  .team-section {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .team-header-intro {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding-bottom: 0.85rem;
  }

  .team-tier-block {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .tier-label-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tier-label-text {
    font-family: "Manrope", sans-serif;
    font-size: 0.95rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .tier-label-text.gold {
    color: #fbbf24;
  }

  .tier-label-text.purple {
    color: #c084fc;
  }

  .team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }

  .member-profile-card {
    background: linear-gradient(135deg, rgba(17, 21, 38, 0.85) 0%, rgba(12, 16, 28, 0.92) 100%);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 18px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1.15rem;
    transition: all 0.2s ease;
  }

  .member-profile-card:hover {
    background: rgba(20, 26, 46, 0.95);
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.5);
  }

  .member-profile-card.is-leadership {
    border-color: rgba(245, 158, 11, 0.35);
    background: linear-gradient(135deg, rgba(30, 24, 16, 0.9) 0%, rgba(14, 18, 30, 0.95) 100%);
  }

  .member-profile-card.is-admin {
    border-color: rgba(129, 140, 248, 0.35);
  }

  .member-info-cell {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .member-name-badge-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.15rem;
  }

  .member-display-name {
    font-family: "Manrope", sans-serif;
    font-size: 1.05rem;
    font-weight: 800;
    color: #ffffff;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .member-display-name:hover {
    color: #c084fc;
  }

  .badge-role-gold {
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(245, 158, 11, 0.45);
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    font-size: 0.68rem;
    font-weight: 800;
    color: #fbbf24;
    white-space: nowrap;
  }

  .badge-role-admin {
    background: rgba(129, 140, 248, 0.2);
    border: 1px solid rgba(129, 140, 248, 0.45);
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    font-size: 0.68rem;
    font-weight: 800;
    color: #c7d2fe;
    white-space: nowrap;
  }

  .badge-role-uploader {
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    font-size: 0.68rem;
    font-weight: 800;
    color: #38bdf8;
    white-space: nowrap;
  }

  .member-username {
    font-size: 0.78rem;
    color: #64748b;
    margin-bottom: 0.6rem;
  }

  .member-positions-cluster {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .pos-chip {
    font-size: 0.72rem;
    font-weight: 700;
    border-radius: 6px;
    padding: 0.15rem 0.5rem;
  }

  .role-cyan {
    background: rgba(6, 182, 212, 0.15);
    border: 1px solid rgba(6, 182, 212, 0.35);
    color: #67e8f9;
  }

  .role-emerald {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  .role-purple {
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.35);
    color: #d8b4fe;
  }

  .role-amber {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fde68a;
  }

  .role-indigo {
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.35);
    color: #c7d2fe;
  }

  .role-slate {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
  }

  /* ==========================================================================
     TAB PANE: RECRUTAMENTO (TOTALMENTE REDESENHADO)
     ========================================================================== */
  .recruitment-section {
    display: flex;
    flex-direction: column;
    gap: 2.25rem;
  }

  .recruitment-banner-card {
    background: linear-gradient(135deg, rgba(20, 26, 46, 0.95) 0%, rgba(13, 17, 30, 0.98) 100%);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 20px;
    padding: 2rem;
    position: relative;
    overflow: hidden;
  }

  .recruitment-banner-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 5px;
    height: 100%;
    background: linear-gradient(180deg, #10b981 0%, #06b6d4 100%);
  }

  .recruitment-beacon-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 9999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.72rem;
    font-weight: 800;
    color: #34d399;
    letter-spacing: 0.06em;
    margin-bottom: 0.75rem;
  }

  .recruitment-main-title {
    font-family: "Manrope", sans-serif;
    font-size: 1.65rem;
    font-weight: 850;
    color: #ffffff;
    margin: 0 0 0.5rem;
  }

  .recruitment-main-lead {
    font-size: 0.94rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0;
    max-width: 750px;
  }

  .openings-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 1.5rem;
  }

  .opening-detail-card {
    background: linear-gradient(180deg, rgba(16, 21, 38, 0.9) 0%, rgba(11, 15, 27, 0.95) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.25s ease;
  }

  .opening-detail-card:hover {
    border-color: rgba(16, 185, 129, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.6);
  }

  .opening-card-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.85rem;
  }

  .opening-pos-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 6px;
    padding: 0.25rem 0.6rem;
    font-size: 0.76rem;
    font-weight: 750;
    color: #c4b5fd;
  }

  .opening-active-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 9999px;
    padding: 0.2rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: #34d399;
  }

  .opening-title-head {
    font-family: "Manrope", sans-serif;
    font-size: 1.25rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
  }

  .opening-description-text {
    font-size: 0.88rem;
    color: #94a3b8;
    line-height: 1.55;
    margin: 0 0 1.25rem;
  }

  .opening-specs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 0.85rem;
    margin-bottom: 1.25rem;
  }

  .spec-cell {
    display: flex;
    flex-direction: column;
  }

  .spec-name {
    font-size: 0.7rem;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 700;
  }

  .spec-value {
    font-size: 0.84rem;
    font-weight: 700;
    color: #e2e8f0;
    margin-top: 0.15rem;
  }

  .opening-requirements-block {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .req-title {
    display: block;
    font-size: 0.74rem;
    font-weight: 800;
    color: #fbbf24;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }

  .req-text {
    font-size: 0.84rem;
    color: #cbd5e1;
    line-height: 1.5;
    margin: 0;
  }

  .opening-footer-action {
    margin-top: auto;
  }

  .applied-status-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: 12px;
    padding: 0.75rem;
    font-size: 0.86rem;
    font-weight: 750;
    color: #34d399;
  }

  .btn-apply-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    border-radius: 12px;
    padding: 0.75rem 1.25rem;
    font-size: 0.88rem;
    font-weight: 800;
    color: #ffffff;
    cursor: pointer;
    text-decoration: none;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
    transition: all 0.2s ease;
  }

  .btn-apply-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(16, 185, 129, 0.5);
  }

  /* ==========================================================================
     TAB PANE: COMENTÁRIOS (COM AVATARES REAIS)
     ========================================================================== */
  .comments-section {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .comments-section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding-bottom: 0.85rem;
  }

  .composer-panel {
    background: linear-gradient(135deg, rgba(17, 22, 39, 0.95) 0%, rgba(12, 16, 28, 0.98) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 1.5rem;
  }

  .composer-body-row {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
  }

  .composer-avatar-slot {
    flex-shrink: 0;
  }

  .composer-input-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .composer-input-field {
    width: 100%;
    background: rgba(10, 13, 24, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 14px;
    padding: 0.85rem 1rem;
    color: #ffffff;
    font-size: 0.92rem;
    line-height: 1.5;
    resize: vertical;
    transition: border-color 0.2s ease;
  }

  .composer-input-field:focus {
    outline: none;
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
  }

  .composer-dock-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .composer-dock-hint {
    font-size: 0.78rem;
    color: #64748b;
  }

  .btn-send-comment {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    border: none;
    border-radius: 10px;
    padding: 0.65rem 1.25rem;
    font-size: 0.86rem;
    font-weight: 800;
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
    transition: all 0.2s ease;
  }

  .btn-send-comment:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(124, 58, 237, 0.5);
  }

  .composer-login-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    background: rgba(17, 22, 39, 0.7);
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 18px;
    padding: 1.5rem;
  }

  :global(.prompt-icon) {
    color: #a78bfa;
    flex-shrink: 0;
  }

  .prompt-text strong {
    display: block;
    font-size: 0.95rem;
    color: #ffffff;
    margin-bottom: 0.2rem;
  }

  .prompt-text p {
    font-size: 0.84rem;
    color: #94a3b8;
    margin: 0;
  }

  .btn-prompt-login {
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 10px;
    padding: 0.6rem 1.15rem;
    font-size: 0.86rem;
    font-weight: 750;
    color: #c4b5fd;
    text-decoration: none;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .btn-prompt-login:hover {
    background: rgba(139, 92, 246, 0.35);
    color: #ffffff;
  }

  /* Comments Feed & Cards */
  .comments-feed {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .comment-bubble-card {
    background: linear-gradient(135deg, rgba(16, 21, 38, 0.85) 0%, rgba(11, 15, 27, 0.92) 100%);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 18px;
    padding: 1.35rem;
    transition: border-color 0.2s ease;
  }

  .comment-bubble-card.is-pinned-card {
    border-color: rgba(245, 158, 11, 0.35);
    background: linear-gradient(135deg, rgba(28, 22, 14, 0.85) 0%, rgba(13, 17, 30, 0.92) 100%);
  }

  .pinned-notice-bar {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.74rem;
    font-weight: 800;
    color: #fbbf24;
    margin-bottom: 0.85rem;
  }

  .comment-layout-row {
    display: flex;
    align-items: flex-start;
    gap: 1.15rem;
  }

  .comment-content-slot {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .comment-author-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .author-info-group {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .author-name-link {
    font-family: "Manrope", sans-serif;
    font-size: 0.96rem;
    font-weight: 800;
    color: #ffffff;
    text-decoration: none;
  }

  .author-name-link:hover {
    color: #c084fc;
  }

  .staff-author-badge {
    background: rgba(139, 92, 246, 0.18);
    border: 1px solid rgba(139, 92, 246, 0.4);
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    font-size: 0.68rem;
    font-weight: 800;
    color: #c4b5fd;
  }

  .comment-time-stamp {
    font-size: 0.76rem;
    color: #64748b;
  }

  .comment-text-body {
    font-size: 0.92rem;
    color: #cbd5e1;
    line-height: 1.6;
    margin: 0 0 0.85rem;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .comment-actions-dock {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .action-dock-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 0.3rem 0.6rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-dock-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .action-dock-btn.is-active-heart {
    color: #f43f5e;
  }

  .action-dock-btn.delete-btn:hover {
    color: #f87171;
    background: rgba(239, 68, 68, 0.1);
  }

  .action-dock-btn.mod-btn:hover {
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.1);
  }

  /* Inline Reply Composer */
  .reply-composer-box {
    margin-top: 1rem;
    background: rgba(10, 13, 24, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .reply-textarea-field {
    width: 100%;
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 0.88rem;
    line-height: 1.5;
    resize: none;
  }

  .reply-textarea-field:focus {
    outline: none;
  }

  .reply-composer-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .btn-reply-cancel {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0.35rem 0.75rem;
  }

  .btn-reply-send {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    border: none;
    border-radius: 8px;
    padding: 0.4rem 0.85rem;
    font-size: 0.78rem;
    font-weight: 800;
    color: #ffffff;
    cursor: pointer;
  }

  /* Nested Replies */
  .nested-replies-feed {
    margin-top: 1rem;
    padding-top: 0.85rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .nested-reply-card {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    padding-left: 0.5rem;
  }

  :global(.reply-turn-indicator) {
    color: #64748b;
    margin-top: 0.25rem;
    flex-shrink: 0;
  }

  .reply-content-slot {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* ==========================================================================
     EMPTY STATES
     ========================================================================== */
  .empty-state-view {
    text-align: center;
    padding: 4.5rem 2rem;
    background: rgba(16, 21, 38, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    max-width: 580px;
    margin: 1.5rem auto;
  }

  :global(.empty-icon) {
    color: #64748b;
    margin-bottom: 1rem;
  }

  .empty-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
  }

  .empty-desc {
    font-size: 0.88rem;
    color: #94a3b8;
    line-height: 1.55;
    margin: 0;
  }

  /* ==========================================================================
     MODAL DIALOG LAYOUT
     ========================================================================== */
  .modal-backdrop-layer {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .modal-dialog-box {
    background: linear-gradient(135deg, #13182b 0%, #0d111d 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 22px;
    width: 100%;
    max-width: 620px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8);
    padding: 2rem;
  }

  .modal-dialog-box.modal-compact {
    max-width: 480px;
  }

  .modal-dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding-bottom: 1rem;
  }

  .modal-role-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 6px;
    padding: 0.2rem 0.55rem;
    font-size: 0.74rem;
    font-weight: 750;
    color: #c4b5fd;
    margin-bottom: 0.4rem;
  }

  .modal-role-pill.report-pill {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
    color: #f87171;
  }

  .modal-dialog-title {
    font-family: "Manrope", sans-serif;
    font-size: 1.35rem;
    font-weight: 850;
    color: #ffffff;
    margin: 0 0 0.2rem;
  }

  .modal-team-tag {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .modal-close-btn {
    background: rgba(255, 255, 255, 0.06);
    border: none;
    border-radius: 9999px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s;
  }

  .modal-close-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    color: #ffffff;
  }

  .modal-form-content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .form-field-label {
    font-size: 0.82rem;
    font-weight: 750;
    color: #cbd5e1;
  }

  .form-field-input,
  .form-field-textarea,
  .form-field-select {
    width: 100%;
    background: rgba(10, 13, 24, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.75rem 0.95rem;
    color: #ffffff;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .form-field-input:focus,
  .form-field-textarea:focus,
  .form-field-select:focus {
    outline: none;
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
  }

  .custom-questions-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .custom-questions-title {
    font-size: 0.88rem;
    font-weight: 800;
    color: #fbbf24;
    margin: 0;
  }

  .reported-quote-box {
    background: rgba(0, 0, 0, 0.4);
    border-left: 3px solid #f87171;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-style: italic;
    color: #cbd5e1;
    font-size: 0.86rem;
  }

  .modal-dialog-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.85rem;
    margin-top: 1rem;
  }

  .btn-dialog-cancel {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 0.65rem 1.15rem;
    font-size: 0.86rem;
    font-weight: 700;
    color: #94a3b8;
    cursor: pointer;
  }

  .btn-dialog-submit {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    border-radius: 10px;
    padding: 0.65rem 1.35rem;
    font-size: 0.88rem;
    font-weight: 800;
    color: #ffffff;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  }

  .btn-dialog-submit.report-submit {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
  }

  /* ==========================================================================
     RESPONSIVE BREAKPOINTS
     ========================================================================== */
  @media (max-width: 900px) {
    .profile-identity-card {
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1.5rem;
      padding: 1.75rem;
    }

    .identity-header-row {
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .verification-badges-row {
      justify-content: center;
    }

    .profile-stats-dock {
      align-self: center;
    }

    .profile-social-dock {
      justify-content: center;
    }
  }

  @media (max-width: 680px) {
    .profile-top-bar {
      padding: 0 1rem 1rem;
    }

    .profile-identity-container {
      padding: 0 1rem;
    }

    .profile-body-container {
      padding: 0 1rem;
      margin-top: 1.5rem;
    }

    .profile-title {
      font-size: 1.85rem;
    }

    .profile-logo-frame {
      width: 82px;
      height: 82px;
      border-radius: 18px;
    }

    .profile-stats-dock {
      width: 100%;
      justify-content: space-around;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
    }

    .nav-tabs-segmented {
      overflow-x: auto;
      scrollbar-width: none;
      white-space: nowrap;
      justify-content: flex-start;
      padding: 0.3rem;
    }

    .nav-tab-item {
      flex: none;
      padding: 0.65rem 1rem;
      font-size: 0.84rem;
    }

    .works-catalog-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .team-grid {
      grid-template-columns: 1fr;
    }

    .openings-cards-grid {
      grid-template-columns: 1fr;
    }

    .composer-panel {
      padding: 1rem;
    }

    .composer-body-row {
      gap: 0.85rem;
    }

    .comment-bubble-card {
      padding: 1rem;
    }
  }
</style>
