<script lang="ts">
  import {
    ShieldCheck,
    Sparkles,
    BookOpen,
    Layers,
    Eye,
    Users,
    Globe,
    MessageSquare,
    ArrowLeft,
    Clock,
    UserPlus,
    Briefcase,
    CheckCircle2,
    X,
    ExternalLink,
    AlertCircle,
    Star,
    Heart,
    Pin,
    PinOff,
    Trash2,
    Flag,
    Send,
    CornerDownRight
  } from "@lucide/svelte";
  import { enhance } from "$app/forms";
  import WorkCard from "$lib/components/WorkCard.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import FluxerIcon from "$lib/components/icons/FluxerIcon.svelte";
  import DiscordIcon from "$lib/components/icons/DiscordIcon.svelte";
  import { relativeTime } from "$lib/types";
  import { formatScanRoleTitle, getScanPreposition } from "$lib/scans";

  let { data, form } = $props();

  let activeTab = $state<"works" | "chapters" | "members" | "recruitment" | "activity" | "comments">("works");
  let applyingOpening = $state<any>(null);
  let openingQuestions = $derived((data.recruitmentQuestions || []).filter((q: any) => q.openingId === applyingOpening?.id));
  let isSubmitting = $state(false);
  let successModal = $state(false);

  // Comments interaction state
  let replyToId = $state<string | null>(null);
  let reportingComment = $state<any>(null);
  let reportReason = $state("");

  function formatNumber(n: number = 0) {
    return new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(n);
  }

  let currentWorks = $derived(
    data.works.filter((w: any) => !w.scan_status || w.scan_status === "ACTIVE" || w.scan_status === "PAUSED")
  );
  let pastWorks = $derived(
    data.works.filter((w: any) => w.scan_status === "COMPLETED" || w.scan_status === "ABANDONED")
  );

  let preposition = $derived(getScanPreposition(data.scan));

  // Group members logically
  let owners = $derived(data.members.filter((m: any) => m.role === "OWNER"));
  let admins = $derived(data.members.filter((m: any) => m.role === "ADMIN"));
  let otherMembers = $derived(data.members.filter((m: any) => m.role !== "OWNER" && m.role !== "ADMIN"));

  let isRecruiting = $derived((data.openings || []).length > 0);

  // Threading for comments
  let rootComments = $derived(
    (data.comments || []).filter((c: any) => !c.parentId)
  );
  let repliesMap = $derived.by(() => {
    const map = new Map<string, any[]>();
    for (const c of (data.comments || [])) {
      if (c.parentId) {
        if (!map.has(c.parentId)) map.set(c.parentId, []);
        map.get(c.parentId)!.push(c);
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
</script>

<svelte:head>
  <title>{data.scan.name} — Scan {data.scan.isOfficial ? "Oficial" : "Parceira"} | Project Nox</title>
  <meta
    name="description"
    content={data.scan.description || `Página oficial de traduções de ${data.scan.name} no Project Nox.`}
  />
</svelte:head>

<div class="scan-profile-page">
  <div class="profile-container">
    <!-- Back Link -->
    <nav class="back-nav">
      <a href="/scans" class="back-link">
        <ArrowLeft size={16} />
        <span>Voltar para todas as scans</span>
      </a>
    </nav>

    <!-- Hero Card -->
    <header class="scan-hero">
      <div class="hero-banner">
        {#if data.scan.bannerId}
          <img src="/media/{data.scan.bannerId}" alt="Banner de {data.scan.name}" class="banner-img" />
          <div class="banner-gradient"></div>
        {:else}
          <div class="banner-placeholder" class:official-bg={data.scan.isOfficial}></div>
        {/if}
      </div>

      <div class="hero-body">
        <div class="hero-identity-row">
          <!-- Logo Wrap: relative z-2 prevents any banner cut-off -->
          <div class="scan-logo-wrap" class:official-logo={data.scan.isOfficial}>
            {#if data.scan.logoId}
              <img src="/media/{data.scan.logoId}" alt="Logo de {data.scan.name}" class="logo-img" />
            {:else}
              <div class="logo-placeholder">
                {data.scan.name.charAt(0).toUpperCase()}
              </div>
            {/if}
          </div>

          <div class="identity-meta">
            <div class="name-line">
              <h1 class="scan-title">{data.scan.name}</h1>
              {#if data.scan.isOfficial}
                <span class="badge-official">
                  <Star size={13} fill="#dfc28d" />
                  <span>Scan Oficial</span>
                </span>
              {:else}
                <span class="badge-partner">
                  <Sparkles size={13} />
                  <span>Scan Parceira</span>
                </span>
              {/if}

              {#if isRecruiting}
                <span class="badge-recruiting">
                  <span class="pulse-dot"></span>
                  <span>Recrutando</span>
                </span>
              {/if}
            </div>

            <p class="scan-bio">
              {data.scan.description || (data.scan.isOfficial ? "Scan oficial e núcleo editorial de traduções do Project Nox." : "Grupo independente de tradução e edição parceiro do Project Nox.")}
            </p>
          </div>

          <!-- Socials & Actions -->
          <div class="hero-actions">
            {#if isRecruiting}
              <button
                type="button"
                class="btn-hero-recruit"
                onclick={() => (activeTab = "recruitment")}
              >
                <UserPlus size={16} />
                <span>Vagas Abertas</span>
              </button>
            {/if}
            {#if data.scan.discord}
              <a href={data.scan.discord} target="_blank" rel="noopener noreferrer" class="btn-social discord" title="Discord oficial">
                <DiscordIcon size={16} />
                <span>Discord</span>
              </a>
            {/if}
            {#if data.scan.fluxer}
              <a href={data.scan.fluxer} target="_blank" rel="noopener noreferrer" class="btn-social fluxer" title="Fluxer oficial">
                <FluxerIcon size={16} />
                <span>Fluxer</span>
              </a>
            {/if}
            {#if data.scan.website}
              <a href={data.scan.website} target="_blank" rel="noopener noreferrer" class="btn-social website" title="Website oficial">
                <Globe size={16} />
                <span>Website</span>
              </a>
            {/if}
          </div>
        </div>

        <!-- Metrics Strip -->
        <div class="metrics-strip">
          <div class="metric-card">
            <BookOpen size={18} class="metric-icon" />
            <div class="metric-info">
              <span class="metric-val">{data.works.length}</span>
              <span class="metric-label">{data.works.length === 1 ? "Obra Ativa" : "Obras Ativas"}</span>
            </div>
          </div>

          <div class="metric-card">
            <Layers size={18} class="metric-icon" />
            <div class="metric-info">
              <span class="metric-val">{data.chapters.length}</span>
              <span class="metric-label">{data.chapters.length === 1 ? "Capítulo" : "Capítulos"}</span>
            </div>
          </div>

          <div class="metric-card">
            <Eye size={18} class="metric-icon" />
            <div class="metric-info">
              <span class="metric-val">{formatNumber(data.totalViews)}</span>
              <span class="metric-label">Leituras Totais</span>
            </div>
          </div>

          <div class="metric-card">
            <Users size={18} class="metric-icon" />
            <div class="metric-info">
              <span class="metric-val">{data.members.length}</span>
              <span class="metric-label">{data.members.length === 1 ? "Membro" : "Membros"}</span>
            </div>
          </div>

          {#if isRecruiting}
            <div class="metric-card recruiting-metric">
              <Briefcase size={18} class="metric-icon text-purple" />
              <div class="metric-info">
                <span class="metric-val text-purple">{data.openings.length}</span>
                <span class="metric-label">{data.openings.length === 1 ? "Vaga Aberta" : "Vagas Abertas"}</span>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="profile-tabs-nav">
      <button
        class="tab-btn"
        class:active={activeTab === "works"}
        onclick={() => (activeTab = "works")}
        type="button"
      >
        <BookOpen size={16} />
        <span>Obras ({data.works.length})</span>
      </button>

      <button
        class="tab-btn"
        class:active={activeTab === "chapters"}
        onclick={() => (activeTab = "chapters")}
        type="button"
      >
        <Layers size={16} />
        <span>Capítulos ({data.chapters.length})</span>
      </button>

      <button
        class="tab-btn"
        class:active={activeTab === "members"}
        onclick={() => (activeTab = "members")}
        type="button"
      >
        <Users size={16} />
        <span>Equipe ({data.members.length})</span>
      </button>

      <button
        class="tab-btn"
        id="recrutamento"
        class:active={activeTab === "recruitment"}
        onclick={() => (activeTab = "recruitment")}
        type="button"
      >
        <Briefcase size={16} />
        <span>Recrutamento {#if isRecruiting}({data.openings.length}){/if}</span>
        {#if isRecruiting}
          <span class="tab-pulse-dot"></span>
        {/if}
      </button>

      <button
        class="tab-btn"
        class:active={activeTab === "activity"}
        onclick={() => (activeTab = "activity")}
        type="button"
      >
        <Clock size={16} />
        <span>Atividade ({data.activities.length})</span>
      </button>

      <button
        class="tab-btn"
        class:active={activeTab === "comments"}
        onclick={() => (activeTab = "comments")}
        type="button"
      >
        <MessageSquare size={16} />
        <span>Comentários ({(data.comments || []).length})</span>
      </button>
    </nav>

    <!-- Feedback Message on Form Submit -->
    {#if form?.applicationSent}
      <div class="success-banner">
        <CheckCircle2 size={20} class="success-icon" />
        <div>
          <strong>Candidatura enviada com sucesso!</strong>
          <p>A equipe de <strong>{data.scan.name}</strong> recebeu sua inscrição e responderá em breve.</p>
        </div>
      </div>
    {:else if form?.message}
      <div class="error-banner">
        <AlertCircle size={20} class="error-icon" />
        <span>{form.message}</span>
      </div>
    {/if}

    <!-- Tab Contents -->
    <div class="tab-viewport">
      <!-- 1. WORKS TAB -->
      {#if activeTab === "works"}
        <div class="tab-pane">
          {#if currentWorks.length > 0}
            <div class="section-block">
              <div class="section-title-wrap">
                <h2 class="section-title">Projetos Atuais ({currentWorks.length})</h2>
                <p class="section-subtitle">Obras ativas e em lançamento contínuo por {data.scan.name}</p>
              </div>
              <div class="works-grid">
                {#each currentWorks as work}
                  <WorkCard {work} />
                {/each}
              </div>
            </div>
          {/if}

          {#if pastWorks.length > 0}
            <div class="section-block past-works-block">
              <div class="section-title-wrap">
                <h2 class="section-title">Projetos Anteriores ({pastWorks.length})</h2>
                <p class="section-subtitle">Obras concluídas ou encerradas no catálogo</p>
              </div>
              <div class="works-grid">
                {#each pastWorks as work}
                  <WorkCard {work} />
                {/each}
              </div>
            </div>
          {/if}

          {#if data.works.length === 0}
            <div class="empty-state">
              <BookOpen size={40} />
              <h3>Nenhuma obra associada</h3>
              <p>Esta scan ainda não possui obras públicas atribuídas no catálogo do Project Nox.</p>
            </div>
          {/if}
        </div>

      <!-- 2. CHAPTERS TAB -->
      {:else if activeTab === "chapters"}
        <div class="tab-pane">
          {#if data.chapters.length > 0}
            <div class="chapters-list">
              {#each data.chapters as ch}
                <div class="chapter-card">
                  <div class="chapter-left">
                    <a href="/obra/{ch.works.slug}" class="chapter-work-link">
                      {ch.works.title}
                    </a>
                    <div class="chapter-title-line">
                      <span class="chapter-number">Cap. {ch.number}</span>
                      {#if ch.title}
                        <span class="chapter-name">{ch.title}</span>
                      {/if}
                    </div>
                  </div>

                  <div class="chapter-right">
                    <span class="chapter-date">
                      <Clock size={13} />
                      <span>{relativeTime(ch.publishedAt)}</span>
                    </span>
                    <a href="/ler/{ch.id}" class="btn-read">
                      <span>Ler Capítulo</span>
                    </a>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <Layers size={40} />
              <h3>Nenhum capítulo disponível</h3>
              <p>Esta scan ainda não possui lançamentos recentes registrados.</p>
            </div>
          {/if}
        </div>

      <!-- 3. MEMBERS TAB -->
      {:else if activeTab === "members"}
        <div class="tab-pane">
          {#if data.members.length > 0}
            <!-- Owners Section -->
            {#if owners.length > 0}
              <div class="members-group">
                <h3 class="group-title">
                  <Star size={16} fill="#dfc28d" color="#dfc28d" />
                  <span>Liderança & Propriedade</span>
                </h3>
                <div class="members-grid">
                  {#each owners as member}
                    <div class="member-card is-owner">
                      <UserAvatar
                        avatarId={member.avatarId}
                        displayName={member.displayName || member.username}
                        size={56}
                        frameId={member.frame_id}
                      />
                      <div class="member-info">
                        <div class="member-name-row">
                          <a href="/u/{member.username}" class="member-name">
                            {member.displayName || member.username}
                          </a>
                          <span class="owner-badge">
                            👑 Dono
                          </span>
                        </div>
                        <span class="member-handle">@{member.username}</span>

                        <!-- Positions -->
                        <div class="member-positions-tags">
                          {#if member.positions && member.positions.length > 0}
                            {#each member.positions as pos}
                              <span class="position-badge">{pos.name}</span>
                            {/each}
                          {:else}
                            <span class="position-badge">Líder da Equipe</span>
                          {/if}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Admins Section -->
            {#if admins.length > 0}
              <div class="members-group">
                <h3 class="group-title">
                  <ShieldCheck size={16} color="#c084fc" />
                  <span>Administração</span>
                </h3>
                <div class="members-grid">
                  {#each admins as member}
                    <div class="member-card is-admin">
                      <UserAvatar
                        avatarId={member.avatarId}
                        displayName={member.displayName || member.username}
                        size={52}
                        frameId={member.frame_id}
                      />
                      <div class="member-info">
                        <div class="member-name-row">
                          <a href="/u/{member.username}" class="member-name">
                            {member.displayName || member.username}
                          </a>
                          <span class="admin-badge">Admin</span>
                        </div>
                        <span class="member-handle">@{member.username}</span>

                        <div class="member-positions-tags">
                          {#if member.positions && member.positions.length > 0}
                            {#each member.positions as pos}
                              <span class="position-badge">{pos.name}</span>
                            {/each}
                          {:else}
                            <span class="position-badge">Administrador</span>
                          {/if}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- General Staff Section -->
            {#if otherMembers.length > 0}
              <div class="members-group">
                <h3 class="group-title">
                  <Users size={16} color="#94a3b8" />
                  <span>Equipe Editorial</span>
                </h3>
                <div class="members-grid">
                  {#each otherMembers as member}
                    <div class="member-card">
                      <UserAvatar
                        avatarId={member.avatarId}
                        displayName={member.displayName || member.username}
                        size={48}
                        frameId={member.frame_id}
                      />
                      <div class="member-info">
                        <div class="member-name-row">
                          <a href="/u/{member.username}" class="member-name">
                            {member.displayName || member.username}
                          </a>
                          {#if member.role === "UPLOADER"}
                            <span class="uploader-badge">Uploader</span>
                          {/if}
                        </div>
                        <span class="member-handle">@{member.username}</span>

                        <div class="member-positions-tags">
                          {#if member.positions && member.positions.length > 0}
                            {#each member.positions as pos}
                              <span class="position-badge">{pos.name}</span>
                            {/each}
                          {:else}
                            <span class="position-badge">Membro da Equipe</span>
                          {/if}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {:else}
            <div class="empty-state">
              <Users size={40} />
              <h3>Nenhum membro público registrado</h3>
              <p>Os dados de membros desta equipe estão ocultos ou em atualização.</p>
            </div>
          {/if}
        </div>

      <!-- 4. RECRUITMENT TAB -->
      {:else if activeTab === "recruitment"}
        <div class="tab-pane">
          {#if isRecruiting}
            <div class="recruitment-header">
              <div>
                <h2 class="recruitment-title">Vagas Abertas em {data.scan.name}</h2>
                <p class="recruitment-subtitle">
                  Faça parte da equipe! Candidate-se preenchendo o formulário específico para a vaga desejada.
                </p>
              </div>
            </div>

            <div class="openings-grid">
              {#each data.openings as opening}
                {@const alreadyApplied = data.userAppOpenings.includes(opening.id)}
                <div class="opening-card">
                  <div class="opening-top">
                    <div class="opening-role-badge">
                      <Briefcase size={14} />
                      <span>{opening.positionName}</span>
                    </div>
                    <span class="badge-status-open">Vaga Aberta</span>
                  </div>

                  <h3 class="opening-card-title">{opening.title}</h3>

                  {#if opening.description}
                    <p class="opening-card-desc">{opening.description}</p>
                  {/if}

                  <div class="opening-meta-list">
                    {#if opening.language}
                      <div class="meta-row">
                        <span class="meta-label">Idioma:</span>
                        <span class="meta-val">{opening.language}</span>
                      </div>
                    {/if}
                    {#if opening.experienceLevel && opening.experienceLevel !== "QUALQUER"}
                      <div class="meta-row">
                        <span class="meta-label">Experiência:</span>
                        <span class="meta-val">{opening.experienceLevel}</span>
                      </div>
                    {/if}
                    {#if opening.availability}
                      <div class="meta-row">
                        <span class="meta-label">Disponibilidade:</span>
                        <span class="meta-val">{opening.availability}</span>
                      </div>
                    {/if}
                    {#if opening.requirements}
                      <div class="meta-requirements">
                        <strong>Requisitos:</strong>
                        <p>{opening.requirements}</p>
                      </div>
                    {/if}
                  </div>

                  <div class="opening-card-footer">
                    {#if alreadyApplied}
                      <div class="applied-badge">
                        <CheckCircle2 size={15} />
                        <span>Candidatura Enviada</span>
                      </div>
                    {:else if !data.viewer}
                      <a
                        href="/auth?redirect=/scans/{data.scan.slug}?vaga={opening.id}#recrutamento"
                        class="btn-apply-action"
                      >
                        <UserPlus size={15} />
                        <span>Conectar-se para Candidatar</span>
                      </a>
                    {:else}
                      <button
                        type="button"
                        class="btn-apply-action"
                        onclick={() => openApplyModal(opening)}
                      >
                        <UserPlus size={15} />
                        <span>Candidatar-se à Vaga</span>
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <Briefcase size={40} />
              <h3>Nenhuma vaga aberta no momento</h3>
              <p>A equipe de {data.scan.name} não possui vagas de recrutamento abertas no momento. Volte em breve!</p>
            </div>
          {/if}
        </div>

      <!-- 5. ACTIVITY TAB -->
      {:else if activeTab === "activity"}
        <div class="tab-pane">
          {#if data.activities.length > 0}
            <div class="activity-timeline">
              {#each data.activities as act}
                <div class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="timeline-action">
                        {#if act.action === "APPLICATION_RECEIVED"}
                          Nova candidatura recebida para <strong>{act.details?.positionName || "vaga"}</strong>
                        {:else if act.action === "MEMBER_ADDED"}
                          <strong>{act.details?.userName}</strong> entrou para a equipe como <strong>{act.details?.positionName || "Membro"}</strong>
                        {:else if act.action === "OPENING_CREATED"}
                          Nova vaga aberta para <strong>{act.details?.positionName || "equipe"}</strong>
                        {:else if act.action === "APPLICATION_STATUS"}
                          Candidatura de <strong>{act.details?.applicant_name}</strong> atualizada para <strong>{act.details?.status}</strong>
                        {:else}
                          Atividade registrada na scan
                        {/if}
                      </span>
                      <span class="timeline-time">{relativeTime(act.createdAt)}</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <Clock size={40} />
              <h3>Nenhuma atividade recente</h3>
              <p>As atualizações da equipe aparecerão aqui conforme novos lançamentos e membros forem registrados.</p>
            </div>
          {/if}
        </div>

      <!-- 6. COMMENTS TAB -->
      {:else if activeTab === "comments"}
        <div class="tab-pane comments-pane">
          <div class="comments-header">
            <div>
              <h2 class="section-title">Comentários & Mural da Comunidade</h2>
              <p class="section-subtitle">
                Deixe seu apoio, feedback ou recado para a equipe de {data.scan.name}.
              </p>
            </div>
            <span class="comments-count-badge">
              {(data.comments || []).length} comentário{(data.comments || []).length === 1 ? "" : "s"}
            </span>
          </div>

          <!-- New Comment Box -->
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
              class="comment-composer-card"
            >
              <input type="hidden" name="scan_id" value={data.scan.id} />
              <div class="composer-top">
                <UserAvatar displayName={data.viewer.displayName || data.viewer.username} avatarId={data.viewer.avatarId} size={38} />
                <div class="composer-input-wrap">
                  <textarea
                    name="body"
                    rows="3"
                    maxlength="2000"
                    placeholder="Escreva um comentário ou mensagem para a scan {data.scan.name}..."
                    required
                    class="composer-textarea"
                  ></textarea>
                </div>
              </div>
              <div class="composer-footer">
                <span class="composer-hint">Seja respeitoso e apoie os tradutores e editores!</span>
                <button type="submit" class="btn-post-comment" disabled={isSubmitting}>
                  <Send size={15} />
                  <span>Publicar Comentário</span>
                </button>
              </div>
            </form>
          {:else}
            <div class="login-to-comment-card">
              <MessageSquare size={24} />
              <div class="login-msg-text">
                <strong>Quer deixar um recado para a equipe?</strong>
                <p>Faça login ou crie sua conta no Project Nox para comentar e interagir com as scans parceiras.</p>
              </div>
              <a href="/login" class="btn-login-comment">Entrar no Project Nox</a>
            </div>
          {/if}

          <!-- Comments List -->
          {#if rootComments.length > 0}
            <div class="comments-thread-list">
              {#each rootComments as comment (comment.id)}
                {@const replies = repliesMap.get(comment.id) || []}
                <article class="comment-item" class:is-pinned={comment.pinned}>
                  {#if comment.pinned}
                    <div class="pinned-indicator">
                      <Pin size={12} />
                      <span>Comentário Fixado pela Staff</span>
                    </div>
                  {/if}

                  <div class="comment-main">
                    <div class="comment-avatar">
                      <UserAvatar
                        displayName={comment.author?.displayName || comment.author?.username || 'Usuário'}
                        avatarId={comment.author?.avatarId}
                        frameId={comment.author?.avatarFrameId}
                        size={38}
                      />
                    </div>
                    <div class="comment-body-wrap">
                      <div class="comment-meta-header">
                        <div class="comment-author-info">
                          <a href="/u/{comment.author?.username}" class="comment-author-name">
                            {comment.author?.displayName || comment.author?.username || 'Usuário'}
                          </a>
                          {#if comment.isStaff}
                            <span class="comment-staff-pill" title="Membro desta scan">Staff</span>
                          {/if}
                        </div>
                        <time class="comment-timestamp">{relativeTime(comment.createdAt)}</time>
                      </div>

                      <p class="comment-text">{comment.body}</p>

                      <div class="comment-actions-bar">
                        <!-- Like Form -->
                        <form method="POST" action="?/likeComment" use:enhance class="action-form">
                          <input type="hidden" name="comment_id" value={comment.id} />
                          <button
                            type="submit"
                            class="btn-comment-action"
                            class:active={comment.isLiked}
                            title={comment.isLiked ? "Descurtir" : "Curtir"}
                          >
                            <Heart size={14} fill={comment.isLiked ? "currentColor" : "none"} />
                            <span>{comment.likesCount}</span>
                          </button>
                        </form>

                        {#if data.viewer}
                          <button
                            type="button"
                            class="btn-comment-action"
                            onclick={() => (replyToId = replyToId === comment.id ? null : comment.id)}
                          >
                            <MessageSquare size={14} />
                            <span>Responder</span>
                          </button>
                        {/if}

                        {#if comment.canModerate}
                          <form method="POST" action="?/moderateComment" use:enhance class="action-form">
                            <input type="hidden" name="comment_id" value={comment.id} />
                            <input
                              type="hidden"
                              name="action_type"
                              value={comment.pinned ? "UNPIN" : "PIN"}
                            />
                            <button
                              type="submit"
                              class="btn-comment-action btn-mod-pin"
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
                              if (!confirm("Tem certeza que deseja remover este comentário?")) return () => {};
                              return async ({ update }) => { await update(); };
                            }}
                            class="action-form"
                          >
                            <input type="hidden" name="comment_id" value={comment.id} />
                            <input type="hidden" name="action_type" value="REMOVE" />
                            <button
                              type="submit"
                              class="btn-comment-action btn-mod-delete"
                              title="Remover comentário"
                            >
                              <Trash2 size={14} />
                              <span>Remover</span>
                            </button>
                          </form>
                        {/if}

                        {#if data.viewer && comment.userId !== data.viewer.id}
                          <button
                            type="button"
                            class="btn-comment-action btn-report"
                            onclick={() => (reportingComment = comment)}
                            title="Denunciar comentário inadequado"
                          >
                            <Flag size={13} />
                          </button>
                        {/if}
                      </div>

                      <!-- Inline Reply Form -->
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
                          class="reply-composer-inline"
                        >
                          <input type="hidden" name="scan_id" value={data.scan.id} />
                          <input type="hidden" name="parent_id" value={comment.id} />
                          <div class="reply-input-wrap">
                            <textarea
                              name="body"
                              rows="2"
                              maxlength="2000"
                              placeholder="Escreva sua resposta para @{comment.author?.username || 'usuário'}..."
                              required
                              class="composer-textarea reply-textarea"
                            ></textarea>
                          </div>
                          <div class="reply-actions">
                            <button
                              type="button"
                              class="btn-cancel-reply"
                              onclick={() => (replyToId = null)}
                            >
                              Cancelar
                            </button>
                            <button type="submit" class="btn-post-reply" disabled={isSubmitting}>
                              <Send size={13} />
                              <span>Enviar Resposta</span>
                            </button>
                          </div>
                        </form>
                      {/if}

                      <!-- Nested Replies -->
                      {#if replies.length > 0}
                        <div class="nested-replies-list">
                          {#each replies as reply (reply.id)}
                            <div class="nested-reply-item">
                              <CornerDownRight size={14} class="reply-turn-icon" />
                              <div class="reply-avatar">
                                <UserAvatar
                                  displayName={reply.author?.displayName || reply.author?.username || 'Usuário'}
                                  avatarId={reply.author?.avatarId}
                                  frameId={reply.author?.avatarFrameId}
                                  size={28}
                                />
                              </div>
                              <div class="reply-body-wrap">
                                <div class="comment-meta-header">
                                  <div class="comment-author-info">
                                    <a href="/u/{reply.author?.username}" class="comment-author-name">
                                      {reply.author?.displayName || reply.author?.username || 'Usuário'}
                                    </a>
                                    {#if reply.isStaff}
                                      <span class="comment-staff-pill">Staff</span>
                                    {/if}
                                  </div>
                                  <time class="comment-timestamp">{relativeTime(reply.createdAt)}</time>
                                </div>

                                <p class="comment-text">{reply.body}</p>

                                <div class="comment-actions-bar">
                                  <form method="POST" action="?/likeComment" use:enhance class="action-form">
                                    <input type="hidden" name="comment_id" value={reply.id} />
                                    <button
                                      type="submit"
                                      class="btn-comment-action"
                                      class:active={reply.isLiked}
                                      title={reply.isLiked ? "Descurtir" : "Curtir"}
                                    >
                                      <Heart size={13} fill={reply.isLiked ? "currentColor" : "none"} />
                                      <span>{reply.likesCount}</span>
                                    </button>
                                  </form>

                                  {#if reply.canDelete}
                                    <form
                                      method="POST"
                                      action="?/moderateComment"
                                      use:enhance={() => {
                                        if (!confirm("Excluir resposta?")) return () => {};
                                        return async ({ update }) => { await update(); };
                                      }}
                                      class="action-form"
                                    >
                                      <input type="hidden" name="comment_id" value={reply.id} />
                                      <input type="hidden" name="action_type" value="REMOVE" />
                                      <button type="submit" class="btn-comment-action btn-mod-delete">
                                        <Trash2 size={13} />
                                        <span>Excluir</span>
                                      </button>
                                    </form>
                                  {/if}

                                  {#if data.viewer && reply.userId !== data.viewer.id}
                                    <button
                                      type="button"
                                      class="btn-comment-action btn-report"
                                      onclick={() => (reportingComment = reply)}
                                      title="Denunciar"
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
            <div class="empty-state">
              <MessageSquare size={40} />
              <h3>Nenhum comentário ainda</h3>
              <p>Seja o primeiro a deixar uma mensagem de incentivo ou feedback para {data.scan.name}!</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Application Modal -->
{#if applyingOpening}
  <div class="modal-backdrop" onclick={closeApplyModal} role="dialog" aria-modal="true">
    <div class="modal-card" onclick={(e) => e.stopPropagation()} role="presentation">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-badge">
            <Briefcase size={14} />
            <span>{applyingOpening.positionName}</span>
          </div>
          <h2 class="modal-title">Candidatar-se: {applyingOpening.title}</h2>
          <span class="modal-scan-tag">Equipe: {data.scan.name}</span>
        </div>
        <button class="btn-close-modal" onclick={closeApplyModal} type="button">
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
        class="modal-form"
      >
        <input type="hidden" name="opening_id" value={applyingOpening.id} />

        <div class="form-group">
          <label for="experience" class="form-label">
            Experiência Prévia *
          </label>
          <textarea
            id="experience"
            name="experience"
            rows="3"
            required
            placeholder="Conte se já trabalhou com tradução/edição de mangás ou se é iniciante dedicado..."
            class="form-textarea"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="availability" class="form-label">
            Disponibilidade de Tempo *
          </label>
          <input
            id="availability"
            name="availability"
            type="text"
            required
            placeholder="Ex: 2 a 3 capítulos por semana, noites e finais de semana..."
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="presentation" class="form-label">
            Mensagem / Apresentação *
          </label>
          <textarea
            id="presentation"
            name="presentation"
            rows="3"
            required
            placeholder="Apresente-se para os líderes e comente por que deseja fazer parte desta scan..."
            class="form-textarea"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="portfolio_url" class="form-label">
            Link de Portfólio / Amostra de Trabalho (Opcional)
          </label>
          <input
            id="portfolio_url"
            name="portfolio_url"
            type="url"
            placeholder="https://drive.google.com/... ou link do seu trabalho"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="contact_info" class="form-label">
            Contato Adicional (Opcional)
          </label>
          <input
            id="contact_info"
            name="contact_info"
            type="text"
            placeholder="Discord (ex: usuario#0000) ou email de contato..."
            class="form-input"
          />
        </div>

        {#if openingQuestions.length > 0}
          <div class="custom-questions-box">
            <h4 class="custom-questions-heading">Perguntas Específicas da Vaga</h4>
            {#each openingQuestions as q}
              <div class="form-group">
                <label for="q-{q.id}" class="form-label">
                  {q.question} {q.required ? '*' : '(Opcional)'}
                </label>
                {#if q.questionType === 'TEXT_LONG'}
                  <textarea
                    id="q-{q.id}"
                    name="question_{q.id}"
                    rows="3"
                    required={q.required}
                    class="form-textarea"
                    placeholder="Sua resposta..."
                  ></textarea>
                {:else if q.questionType === 'YES_NO'}
                  <select id="q-{q.id}" name="question_{q.id}" required={q.required} class="form-select">
                    <option value="">Selecione...</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                {:else if q.questionType === 'SINGLE_CHOICE'}
                  {@const opts = Array.isArray(q.options) ? q.options : []}
                  <select id="q-{q.id}" name="question_{q.id}" required={q.required} class="form-select">
                    <option value="">Selecione uma opção...</option>
                    {#each opts as opt}
                      <option value={opt}>{opt}</option>
                    {/each}
                  </select>
                {:else}
                  <input
                    id="q-{q.id}"
                    name="question_{q.id}"
                    type="text"
                    required={q.required}
                    class="form-input"
                    placeholder="Sua resposta..."
                  />
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick={closeApplyModal}>Cancelar</button>
          <button type="submit" class="btn-submit" disabled={isSubmitting}>
            <UserPlus size={15} />
            <span>{isSubmitting ? "Enviando..." : "Enviar Candidatura"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Comment Report Modal -->
{#if reportingComment}
  <div class="modal-backdrop" onclick={() => (reportingComment = null)} role="dialog" aria-modal="true">
    <div class="modal-card modal-small" onclick={(e) => e.stopPropagation()} role="presentation">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-badge report-badge">
            <Flag size={14} />
            <span>Denunciar Comentário</span>
          </div>
          <h2 class="modal-title">Denunciar comentário de @{reportingComment.author?.username}</h2>
        </div>
        <button class="btn-close-modal" onclick={() => (reportingComment = null)} type="button">
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
        class="modal-form"
      >
        <input type="hidden" name="comment_id" value={reportingComment.id} />
        <div class="comment-preview-quote">
          <p>"{reportingComment.body}"</p>
        </div>
        <div class="form-group">
          <label for="report_reason" class="form-label">Motivo da denúncia *</label>
          <textarea
            id="report_reason"
            name="reason"
            rows="3"
            required
            maxlength="500"
            bind:value={reportReason}
            placeholder="Descreva o motivo (ex: spam, assédio, spoiler sem aviso, conteúdo ofensivo)..."
            class="form-textarea"
          ></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick={() => (reportingComment = null)}>
            Cancelar
          </button>
          <button type="submit" class="btn-submit btn-submit-report" disabled={isSubmitting || reportReason.trim().length < 2}>
            <Flag size={14} />
            <span>Enviar Denúncia</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .scan-profile-page {
    min-height: 100vh;
    padding: 1.75rem 1.5rem 5rem;
    color: #e2e8f0;
  }

  .profile-container {
    max-width: 1440px;
    margin: 0 auto;
  }

  /* Back Nav */
  .back-nav {
    margin-bottom: 1.25rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: #94a3b8;
    text-decoration: none;
    font-size: 0.88rem;
    font-weight: 600;
    transition: color 0.2s ease;
  }

  .back-link:hover {
    color: #f8fafc;
  }

  /* Hero Section */
  .scan-hero {
    background: #0d101a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    overflow: hidden;
    margin-bottom: 2rem;
  }

  .hero-banner {
    height: 180px;
    width: 100%;
    position: relative;
    background: #141829;
    overflow: hidden;
  }

  .banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .banner-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 20%, rgba(13, 16, 26, 0.95) 100%);
  }

  .banner-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1e1b4b 0%, #0d101a 100%);
  }

  .banner-placeholder.official-bg {
    background: linear-gradient(135deg, rgba(60, 48, 25, 0.5) 0%, #0d101a 100%);
  }

  .hero-body {
    position: relative;
    z-index: 2;
    padding: 0 2rem 1.75rem;
  }

  .hero-identity-row {
    display: flex;
    align-items: flex-end;
    gap: 1.5rem;
    margin-top: -50px;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  /* Scan Logo */
  .scan-logo-wrap {
    width: 96px;
    height: 96px;
    border-radius: 22px;
    background: #131728;
    border: 4px solid #0d101a;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .scan-logo-wrap.official-logo {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(223, 194, 141, 0.4);
  }

  .logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .logo-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #3b0764, #1e1b4b);
    color: #f1f5f9;
    font-size: 2.25rem;
    font-weight: 800;
  }

  .identity-meta {
    flex: 1;
    min-width: 260px;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-bottom: 0.4rem;
  }

  .scan-title {
    font-family: "Manrope", -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.75rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .badge-official {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.7rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    border-radius: 8px;
    color: #dfc28d;
    font-size: 0.75rem;
    font-weight: 800;
  }

  .badge-partner {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.7rem;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .badge-recruiting {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.7rem;
    background: rgba(168, 85, 247, 0.18);
    border: 1px solid rgba(168, 85, 247, 0.45);
    border-radius: 8px;
    color: #f3e8ff;
    font-size: 0.75rem;
    font-weight: 800;
  }

  .pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #a855f7;
    box-shadow: 0 0 8px #a855f7;
  }

  .scan-bio {
    font-size: 0.92rem;
    color: #94a3b8;
    line-height: 1.55;
    margin: 0;
    max-width: 820px;
  }

  /* Actions */
  .hero-actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .btn-hero-recruit {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.6rem 1.1rem;
    background: #9333ea;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-hero-recruit:hover {
    background: #a855f7;
    box-shadow: 0 4px 16px rgba(168, 85, 247, 0.4);
    transform: translateY(-1px);
  }

  .btn-social {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 0.95rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #e2e8f0;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-social:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  /* Metrics Strip */
  .metrics-strip {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .metric-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 1.1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
  }

  .metric-card.recruiting-metric {
    background: rgba(168, 85, 247, 0.08);
    border-color: rgba(168, 85, 247, 0.25);
  }

  .metric-icon {
    color: #94a3b8;
  }

  .text-purple {
    color: #c084fc;
  }

  .metric-info {
    display: flex;
    flex-direction: column;
  }

  .metric-val {
    font-size: 1.15rem;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.1;
  }

  .metric-label {
    font-size: 0.72rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  /* Tabs Nav */
  .profile-tabs-nav {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.25rem;
    background: transparent;
    border: none;
    border-radius: 10px;
    font-size: 0.92rem;
    font-weight: 600;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    position: relative;
  }

  .tab-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.04);
  }

  .tab-btn.active {
    color: #ffffff;
    background: rgba(139, 92, 246, 0.2);
    box-shadow: 0 2px 12px rgba(139, 92, 246, 0.25);
  }

  .tab-pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #a855f7;
    margin-left: 0.25rem;
  }

  /* Banners */
  .success-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 12px;
    margin-bottom: 2rem;
    color: #6ee7b7;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    margin-bottom: 2rem;
    color: #fca5a5;
  }

  /* Tab Viewport */
  .tab-viewport {
    min-height: 400px;
  }

  .section-block {
    margin-bottom: 2.5rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 1.25rem;
  }

  .works-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1.25rem;
  }

  /* Chapters List */
  .chapters-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .chapter-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1.25rem;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    transition: all 0.2s ease;
  }

  .chapter-card:hover {
    background: #131728;
    border-color: rgba(139, 92, 246, 0.3);
  }

  .chapter-left {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .chapter-work-link {
    font-size: 0.82rem;
    color: #94a3b8;
    text-decoration: none;
    font-weight: 600;
  }

  .chapter-work-link:hover {
    color: #c4b5fd;
  }

  .chapter-title-line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chapter-number {
    font-size: 0.95rem;
    font-weight: 700;
    color: #ffffff;
  }

  .chapter-name {
    font-size: 0.85rem;
    color: #64748b;
  }

  .chapter-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .chapter-date {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: #64748b;
  }

  .btn-read {
    display: inline-flex;
    align-items: center;
    padding: 0.4rem 0.85rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 0.8rem;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-read:hover {
    background: #8b5cf6;
    color: #ffffff;
  }

  /* Members Group */
  .members-group {
    margin-bottom: 2.25rem;
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.05rem;
    font-weight: 700;
    color: #e2e8f0;
    margin: 0 0 1rem;
  }

  .members-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }

  .member-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    transition: all 0.2s ease;
  }

  .member-card:hover {
    background: #131728;
    border-color: rgba(139, 92, 246, 0.25);
  }

  .member-card.is-owner {
    border-color: rgba(223, 194, 141, 0.3);
    background: radial-gradient(circle at top right, rgba(223, 194, 141, 0.06), transparent 70%), #0e111d;
  }

  .member-card.is-admin {
    border-color: rgba(192, 132, 252, 0.25);
  }

  .member-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .member-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .member-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: #ffffff;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .member-name:hover {
    color: #c4b5fd;
  }

  .member-handle {
    font-size: 0.78rem;
    color: #64748b;
    margin-bottom: 0.4rem;
  }

  .owner-badge {
    font-size: 0.7rem;
    font-weight: 800;
    padding: 0.15rem 0.5rem;
    background: rgba(223, 194, 141, 0.2);
    border: 1px solid rgba(223, 194, 141, 0.4);
    border-radius: 6px;
    color: #dfc28d;
  }

  .admin-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    background: rgba(192, 132, 252, 0.15);
    border: 1px solid rgba(192, 132, 252, 0.3);
    border-radius: 6px;
    color: #c084fc;
  }

  .uploader-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 6px;
    color: #93c5fd;
  }

  .member-positions-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .position-badge {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: #cbd5e1;
  }

  /* Openings / Recruitment Tab */
  .recruitment-header {
    margin-bottom: 1.75rem;
  }

  .recruitment-title {
    font-size: 1.4rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.35rem;
  }

  .recruitment-subtitle {
    font-size: 0.92rem;
    color: #94a3b8;
    margin: 0;
  }

  .openings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 1.5rem;
  }

  .opening-card {
    background: #0e111d;
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 18px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.2s ease;
  }

  .opening-card:hover {
    border-color: rgba(168, 85, 247, 0.5);
    box-shadow: 0 8px 24px -6px rgba(168, 85, 247, 0.15);
  }

  .opening-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .opening-role-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.35);
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 800;
    color: #d8b4fe;
  }

  .badge-status-open {
    font-size: 0.72rem;
    font-weight: 700;
    color: #34d399;
    padding: 0.2rem 0.55rem;
    background: rgba(52, 211, 153, 0.12);
    border-radius: 6px;
  }

  .opening-card-title {
    font-size: 1.2rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
  }

  .opening-card-desc {
    font-size: 0.88rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0 0 1rem;
  }

  .opening-meta-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.85rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 10px;
    margin-bottom: 1.25rem;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
  }

  .meta-label {
    color: #64748b;
    font-weight: 600;
  }

  .meta-val {
    color: #e2e8f0;
    font-weight: 600;
  }

  .meta-requirements {
    margin-top: 0.4rem;
    font-size: 0.82rem;
    color: #94a3b8;
    line-height: 1.5;
  }

  .meta-requirements strong {
    color: #cbd5e1;
  }

  .meta-requirements p {
    margin: 0.2rem 0 0;
  }

  .btn-apply-action {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: #9333ea;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-apply-action:hover {
    background: #a855f7;
    box-shadow: 0 4px 16px rgba(168, 85, 247, 0.35);
  }

  .applied-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.75rem;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 10px;
    color: #34d399;
    font-size: 0.88rem;
    font-weight: 700;
  }

  /* Activity Timeline */
  .activity-timeline {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    position: relative;
    padding-left: 1.5rem;
  }

  .activity-timeline::before {
    content: "";
    position: absolute;
    left: 6px;
    top: 6px;
    bottom: 6px;
    width: 2px;
    background: rgba(255, 255, 255, 0.08);
  }

  .timeline-item {
    position: relative;
    display: flex;
    align-items: flex-start;
  }

  .timeline-dot {
    position: absolute;
    left: -1.5rem;
    top: 4px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #8b5cf6;
    border: 3px solid #0a0d18;
  }

  .timeline-content {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    width: 100%;
  }

  .timeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .timeline-action {
    font-size: 0.88rem;
    color: #e2e8f0;
  }

  .timeline-time {
    font-size: 0.75rem;
    color: #64748b;
    white-space: nowrap;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 100;
  }

  .modal-card {
    background: #0d101b;
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 20px;
    width: 100%;
    max-width: 540px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 1.75rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .modal-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.6rem;
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    color: #d8b4fe;
    margin-bottom: 0.35rem;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.25rem;
  }

  .modal-scan-tag {
    font-size: 0.82rem;
    color: #94a3b8;
  }

  .btn-close-modal {
    background: rgba(255, 255, 255, 0.06);
    border: none;
    border-radius: 8px;
    color: #94a3b8;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-close-modal:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem 0.95rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: #ffffff;
    font-size: 0.88rem;
    outline: none;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .form-input:focus,
  .form-textarea:focus,
  .form-select:focus {
    border-color: #a855f7;
    box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.2);
  }

  .form-select {
    width: 100%;
    padding: 0.75rem 0.95rem;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: #ffffff;
    font-size: 0.88rem;
    outline: none;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .custom-questions-box {
    background: rgba(168, 85, 247, 0.06);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .custom-questions-heading {
    font-size: 0.82rem;
    font-weight: 700;
    color: #c084fc;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin: 0;
  }

  .modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .btn-cancel {
    padding: 0.7rem 1.25rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #94a3b8;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-cancel:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-submit {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.7rem 1.35rem;
    background: #9333ea;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-submit:hover:not(:disabled) {
    background: #a855f7;
    box-shadow: 0 4px 16px rgba(168, 85, 247, 0.4);
  }

  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Empty State */
  .empty-state {
    padding: 4.5rem 2rem;
    text-align: center;
    color: #64748b;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 18px;
  }

  .empty-state h3 {
    color: #f1f5f9;
    margin: 1rem 0 0.5rem;
    font-size: 1.15rem;
  }

  .btn-social.discord:hover {
    background: rgba(88, 101, 242, 0.18);
    border-color: rgba(88, 101, 242, 0.45);
    color: #fff;
  }

  .btn-social.fluxer:hover {
    background: rgba(0, 218, 143, 0.16);
    border-color: rgba(0, 218, 143, 0.45);
    color: #fff;
  }

  /* Section Titles with Subtitle */
  .section-title-wrap {
    margin-bottom: 1.25rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 0.25rem;
  }

  .section-subtitle {
    font-size: 0.88rem;
    color: #94a3b8;
    margin: 0;
  }

  .past-works-block {
    margin-top: 2.5rem;
    padding-top: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* Comments Pane */
  .comments-pane {
    max-width: 900px;
    margin: 0 auto;
  }

  .comments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .comments-count-badge {
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.3);
    color: #dfc28d;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 700;
  }

  .comment-composer-card {
    background: rgba(18, 22, 34, 0.85);
    border: 1px solid rgba(181, 154, 245, 0.18);
    border-radius: 16px;
    padding: 1.25rem;
    margin-bottom: 2rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .composer-top {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .composer-input-wrap {
    flex: 1;
  }

  .composer-textarea {
    width: 100%;
    background: rgba(10, 13, 22, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: #f1f5f9;
    padding: 0.85rem 1rem;
    font-family: inherit;
    font-size: 0.92rem;
    line-height: 1.5;
    resize: vertical;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .composer-textarea:focus {
    outline: none;
    border-color: rgba(223, 194, 141, 0.6);
    box-shadow: 0 0 0 3px rgba(223, 194, 141, 0.15);
  }

  .composer-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .composer-hint {
    font-size: 0.78rem;
    color: #64748b;
  }

  .btn-post-comment {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #dfc28d, #bda16b);
    color: #0d101a;
    border: none;
    border-radius: 10px;
    padding: 0.6rem 1.25rem;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-post-comment:hover:not(:disabled) {
    box-shadow: 0 4px 14px rgba(223, 194, 141, 0.35);
    transform: translateY(-1px);
  }

  .btn-post-comment:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .login-to-comment-card {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem 1.5rem;
    background: rgba(18, 22, 34, 0.7);
    border: 1px dashed rgba(223, 194, 141, 0.3);
    border-radius: 14px;
    margin-bottom: 2rem;
    color: #dfc28d;
    flex-wrap: wrap;
  }

  .login-msg-text {
    flex: 1;
    min-width: 240px;
  }

  .login-msg-text strong {
    display: block;
    color: #f1f5f9;
    font-size: 0.95rem;
    margin-bottom: 0.2rem;
  }

  .login-msg-text p {
    margin: 0;
    font-size: 0.82rem;
    color: #94a3b8;
  }

  .btn-login-comment {
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.4);
    color: #dfc28d;
    text-decoration: none;
    padding: 0.55rem 1.1rem;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 700;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-login-comment:hover {
    background: #dfc28d;
    color: #0d101a;
  }

  /* Comments List */
  .comments-thread-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .comment-item {
    background: rgba(18, 22, 34, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1.25rem;
    transition: border-color 0.2s ease;
  }

  .comment-item.is-pinned {
    border-color: rgba(223, 194, 141, 0.45);
    background: rgba(223, 194, 141, 0.04);
  }

  .pinned-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #dfc28d;
    margin-bottom: 0.85rem;
    padding: 0.2rem 0.6rem;
    background: rgba(223, 194, 141, 0.12);
    border-radius: 6px;
  }

  .comment-main {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .comment-avatar {
    flex-shrink: 0;
  }

  .comment-body-wrap {
    flex: 1;
    min-width: 0;
  }

  .comment-meta-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
    gap: 0.5rem;
  }

  .comment-author-info {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .comment-author-name {
    color: #f1f5f9;
    font-weight: 700;
    font-size: 0.92rem;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .comment-author-name:hover {
    color: #dfc28d;
    text-decoration: underline;
  }

  .comment-staff-pill {
    background: linear-gradient(135deg, rgba(223, 194, 141, 0.25), rgba(168, 85, 247, 0.25));
    border: 1px solid rgba(223, 194, 141, 0.45);
    color: #dfc28d;
    font-size: 0.68rem;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .comment-timestamp {
    font-size: 0.78rem;
    color: #64748b;
  }

  .comment-text {
    margin: 0 0 0.85rem;
    font-size: 0.92rem;
    color: #cbd5e1;
    line-height: 1.55;
    word-break: break-word;
  }

  .comment-actions-bar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .action-form {
    display: inline-flex;
    margin: 0;
  }

  .btn-comment-action {
    background: transparent;
    border: none;
    padding: 0.35rem 0.65rem;
    border-radius: 8px;
    color: #94a3b8;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-comment-action:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #f1f5f9;
  }

  .btn-comment-action.active {
    color: #f43f5e;
  }

  .btn-mod-pin:hover {
    color: #dfc28d;
  }

  .btn-mod-delete:hover {
    color: #ef4444;
  }

  .btn-report:hover {
    color: #f59e0b;
  }

  /* Inline Reply Composer */
  .reply-composer-inline {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(10, 13, 22, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
  }

  .reply-textarea {
    font-size: 0.85rem;
    padding: 0.6rem 0.85rem;
  }

  .reply-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 0.6rem;
  }

  .btn-cancel-reply {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #94a3b8;
    border-radius: 8px;
    padding: 0.4rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-post-reply {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #dfc28d;
    color: #0d101a;
    border: none;
    border-radius: 8px;
    padding: 0.4rem 0.95rem;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }

  /* Nested Replies */
  .nested-replies-list {
    margin-top: 1rem;
    padding-left: 1rem;
    border-left: 2px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .nested-reply-item {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
    padding: 0.75rem;
    background: rgba(10, 13, 22, 0.4);
    border-radius: 10px;
  }

  .reply-turn-icon {
    color: #475569;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .reply-avatar {
    flex-shrink: 0;
  }

  .reply-body-wrap {
    flex: 1;
    min-width: 0;
  }

  /* Report Modal */
  .modal-small {
    max-width: 480px;
  }

  .report-badge {
    background: rgba(239, 68, 68, 0.15) !important;
    border-color: rgba(239, 68, 68, 0.4) !important;
    color: #ef4444 !important;
  }

  .comment-preview-quote {
    background: rgba(0, 0, 0, 0.3);
    border-left: 3px solid #dfc28d;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1.25rem;
  }

  .comment-preview-quote p {
    margin: 0;
    font-size: 0.85rem;
    color: #94a3b8;
    font-style: italic;
  }

  .btn-submit-report {
    background: #ef4444 !important;
    color: #fff !important;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .scan-hero {
      border-radius: 16px;
    }

    .hero-banner {
      height: 140px;
    }

    .hero-body {
      padding: 0 1.25rem 1.5rem;
    }

    .hero-identity-row {
      margin-top: -40px;
      gap: 1rem;
    }

    .scan-logo-wrap {
      width: 76px;
      height: 76px;
      border-radius: 18px;
    }

    .scan-title {
      font-size: 1.45rem;
    }

    .hero-actions {
      width: 100%;
      margin-top: 0.5rem;
    }

    .btn-hero-recruit {
      width: 100%;
      justify-content: center;
    }

    .members-grid,
    .openings-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
