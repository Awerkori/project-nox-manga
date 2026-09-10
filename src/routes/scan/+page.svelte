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
    ArrowRight,
    CheckCircle2,
    Settings,
    Clock,
    AlertCircle,
    Copy,
    Check,
    Plus,
    X,
    UserMinus,
    Crown,
    AlertTriangle,
    Send
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { relativeTime, slugify } from '$lib/types';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let { data, form } = $props();

  let works = $derived(data.works || []);
  let chapters = $derived(data.chapters || []);
  let team = $derived(data.team || []);

  let saving = $state(false);
  let showSuccess = $state(false);

  // Non-member request form state
  let reqScanName = $state('');
  let reqScanSlug = $state('');
  let reqSlugCustomized = $state(false);
  let reqSubmitting = $state(false);

  function handleReqNameChange(val: string) {
    reqScanName = val;
    if (!reqSlugCustomized) {
      reqScanSlug = slugify(val);
    }
  }

  // Active member modals state
  let showInviteModal = $state(false);
  let inviteRole = $state('MEMBER');
  let inviteHours = $state(24);
  let inviteSubmitting = $state(false);
  let copiedCode = $state<string | null>(null);

  let createdInvite = $derived(
    form && typeof form === 'object' && 'createdInvite' in form && form.createdInvite
      ? (form.createdInvite as { code: string; expires_at: string; role: string; id: string })
      : null
  );

  let showProjectModal = $state(false);
  let selectedWorkId = $state('');
  let projectMessage = $state('');
  let projectSubmitting = $state(false);

  let transferTarget = $state<any>(null);
  let transferSubmitting = $state(false);

  let removeTarget = $state<any>(null);
  let removeSubmitting = $state(false);

  function formatNumber(n: number = 0) {
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(n);
  }

  const ROLE_LABELS: Record<string, string> = {
    OWNER: 'Dono',
    ADMIN: 'Admin da Scan',
    UPLOADER: 'Uploader',
    MEMBER: 'Staff'
  };

  function copyInviteLink(code: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://noxscans.com';
    navigator.clipboard.writeText(`${origin}/convite/${code}`);
    copiedCode = code;
    setTimeout(() => {
      if (copiedCode === code) copiedCode = null;
    }, 3000);
  }

  $effect(() => {
    if (form?.success) {
      showSuccess = true;
      const t = setTimeout(() => {
        showSuccess = false;
      }, 4000);
      return () => clearTimeout(t);
    }
  });
</script>

<svelte:head>
  <title>Painel de Scan Parceira | Project Nox</title>
</svelte:head>

<div class="scan-dashboard-page">
  <div class="dashboard-container">
    {#if data.incomingTransfer}
      <div class="transfer-alert-card">
        <div class="transfer-alert-left">
          <div class="transfer-icon-ring">
            <Crown size={24} />
          </div>
          <div class="transfer-alert-text">
            <h3>Proposta de Liderança Recebida</h3>
            <p>
              <strong>{data.incomingTransfer.from_user?.display_name || data.incomingTransfer.from_user?.username || 'O líder atual'}</strong>
              propôs transferir a liderança da scan <strong>{data.incomingTransfer.scans?.name}</strong> para você.
            </p>
          </div>
        </div>
        <div class="transfer-alert-actions">
          <form method="POST" action="?/respondOwnershipTransfer" use:enhance>
            <input type="hidden" name="request_id" value={data.incomingTransfer.id} />
            <input type="hidden" name="accept" value="true" />
            <button type="submit" class="btn-transfer-accept">
              <Check size={16} />
              <span>Aceitar Liderança</span>
            </button>
          </form>
          <form method="POST" action="?/respondOwnershipTransfer" use:enhance>
            <input type="hidden" name="request_id" value={data.incomingTransfer.id} />
            <input type="hidden" name="accept" value="false" />
            <button type="submit" class="btn-transfer-reject">
              <X size={16} />
              <span>Recusar</span>
            </button>
          </form>
        </div>
      </div>
    {/if}

    {#if !data.authenticated}
      <!-- Unauthenticated State -->
      <section class="onboarding-hero">
        <div class="hero-icon-ring">
          <ShieldCheck size={48} />
        </div>
        <h1 class="onboarding-title">Painel de Scan Parceira</h1>
        <p class="onboarding-sub">
          Faça login ou crie sua conta no Project Nox para acessar seu painel editorial e gerenciar suas obras.
        </p>
        <div class="onboarding-actions">
          <a href="/entrar" class="btn-primary">Entrar na Conta</a>
          <a href="/registro" class="btn-secondary">Criar Conta</a>
        </div>
      </section>
    {:else if !data.isMember}
      <!-- Not a Scan Member State -->
      <section class="partnership-portal">
        <header class="portal-header">
          <div class="badge-partnership">
            <Sparkles size={15} />
            <span>Programa de Parcerias</span>
          </div>
          <h1 class="portal-title">Torne-se uma Scan Parceira no Project Nox</h1>
          <p class="portal-sub">
            Traga sua equipe para uma plataforma focada na melhor experiência de leitura, com respeito integral aos
            tradutores e visibilidade para a sua comunidade.
          </p>
        </header>

        {#if data.partnerRequests && data.partnerRequests.length > 0}
          <div class="my-partner-requests-card">
            <div class="requests-card-header">
              <Clock size={18} />
              <h2>Suas Solicitações de Parceria ({data.partnerRequests.length})</h2>
            </div>
            <div class="requests-track-list">
              {#each data.partnerRequests as req (req.id)}
                <div class="track-item status-{req.status.toLowerCase()}">
                  <div class="track-header">
                    <div class="track-scan-info">
                      <strong class="track-scan-name">{req.scan_name}</strong>
                      <span class="track-scan-slug font-mono">/{req.scan_slug}</span>
                    </div>
                    <div class="track-status-cell">
                      <span class="status-pill status-{req.status.toLowerCase()}">
                        {req.status === 'PENDING' ? 'Em Análise' : req.status === 'APPROVED' ? 'Aprovada' : req.status === 'CANCELLED' ? 'Cancelada' : 'Recusada'}
                      </span>
                      {#if req.status === 'PENDING'}
                        <form method="POST" action="?/cancelPartnerRequest" use:enhance>
                          <input type="hidden" name="request_id" value={req.id} />
                          <button type="submit" class="btn-cancel-req">Cancelar Solicitação</button>
                        </form>
                      {/if}
                    </div>
                  </div>

                  {#if req.description}
                    <p class="track-desc">{req.description}</p>
                  {/if}

                  {#if req.status === 'REJECTED' && req.rejection_reason}
                    <div class="track-rejection-msg">
                      <AlertTriangle size={14} />
                      <span>Motivo da recusa: {req.rejection_reason}</span>
                    </div>
                  {:else if req.status === 'APPROVED'}
                    <div class="track-approved-msg">
                      <CheckCircle2 size={14} />
                      <span>Parceria aprovada! Você foi nomeado líder. Recarregue a página para acessar seu painel.</span>
                    </div>
                  {:else if req.status === 'CANCELLED'}
                    <div class="track-cancelled-msg">
                      <X size={14} />
                      <span>Solicitação cancelada por você.</span>
                    </div>
                  {:else}
                    <div class="track-pending-msg">
                      <Clock size={14} />
                      <span>Sua solicitação está sendo revisada por nossa equipe editorial.</span>
                    </div>
                  {/if}
                  <span class="track-date">Enviado em {new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="perks-grid">
          <div class="perk-card">
            <div class="perk-icon">
              <ShieldCheck size={22} />
            </div>
            <h3>Atribuição Oficial Garantida</h3>
            <p>Seu nome e logotipo aparecem no topo de cada capítulo e na página da obra com selo de verificação.</p>
          </div>

          <div class="perk-card">
            <div class="perk-icon">
              <MessageSquare size={22} />
            </div>
            <h3>Tráfego Direto para seu Discord</h3>
            <p>Botões de atalho integrados levam os leitores diretamente para o servidor ou site da sua scan.</p>
          </div>

          <div class="perk-card">
            <div class="perk-icon">
              <Eye size={22} />
            </div>
            <h3>Métricas Reais de Audiência</h3>
            <p>Acompanhe em tempo real leituras totais, obras mais lidas e retenção de público com proteção anti-bots.</p>
          </div>

          <div class="perk-card">
            <div class="perk-icon">
              <Settings size={22} />
            </div>
            <h3>Painel Dedicado e Equipe</h3>
            <p>Gerencie membros da sua scan (Líder, Admins, Uploaders) e personalize a bio e redes do seu grupo.</p>
          </div>
        </div>

        <!-- In-Platform Partnership Request Form -->
        <div class="partner-form-card">
          <div class="partner-form-header">
            <Sparkles size={20} class="accent-icon" />
            <div>
              <h2>Solicitar Parceria Direta</h2>
              <p>Envie os dados do seu grupo para cadastro e validação pela equipe Project Nox.</p>
            </div>
          </div>

          {#if showSuccess && form?.partnerRequested}
            <div class="success-banner">
              <CheckCircle2 size={16} />
              <span>Solicitação enviada com sucesso! Nossa equipe analisará sua solicitação em breve.</span>
            </div>
          {/if}

          {#if form?.message}
            <div class="error-banner">
              <AlertCircle size={16} />
              <span>{form.message}</span>
            </div>
          {/if}

          <form
            method="POST"
            action="?/requestPartner"
            use:enhance={() => {
              reqSubmitting = true;
              return async ({ update }) => {
                reqSubmitting = false;
                await update();
              };
            }}
            class="partner-request-form"
          >
            <div class="form-row">
              <div class="form-field flex-1">
                <label for="req-name">Nome da Scan *</label>
                <input
                  id="req-name"
                  name="scan_name"
                  type="text"
                  required
                  placeholder="Ex: Hanami Scans, Moonlight Traduções"
                  value={reqScanName}
                  oninput={(e) => handleReqNameChange((e.currentTarget as HTMLInputElement).value)}
                />
              </div>

              <div class="form-field flex-1">
                <label for="req-slug">Slug da Scan (URL única) *</label>
                <input
                  id="req-slug"
                  name="scan_slug"
                  type="text"
                  required
                  class="font-mono"
                  placeholder="ex: hanami-scans"
                  value={reqScanSlug}
                  oninput={(e) => {
                    reqSlugCustomized = true;
                    reqScanSlug = (e.currentTarget as HTMLInputElement).value;
                  }}
                />
              </div>
            </div>

            <div class="form-field">
              <label for="req-desc">Descrição / Apresentação do Grupo</label>
              <textarea
                id="req-desc"
                name="description"
                rows={3}
                placeholder="Conte um pouco sobre sua scan, gêneros favoritos, histórico de projetos..."
              ></textarea>
            </div>

            <div class="form-row">
              <div class="form-field flex-1">
                <label for="req-discord">Link do Discord *</label>
                <input
                  id="req-discord"
                  name="discord"
                  type="url"
                  required
                  placeholder="https://discord.gg/seugrupo"
                />
              </div>

              <div class="form-field flex-1">
                <label for="req-fluxer">Comunidade Fluxer (opcional)</label>
                <input
                  id="req-fluxer"
                  name="fluxer"
                  type="text"
                  placeholder="Nome ou link no Fluxer"
                />
              </div>

              <div class="form-field flex-1">
                <label for="req-website">Website Oficial (opcional)</label>
                <input
                  id="req-website"
                  name="website"
                  type="url"
                  placeholder="https://suascan.com"
                />
              </div>
            </div>

            <div class="form-field">
              <label for="req-samples">Amostras de Tradução / Obras Lançadas</label>
              <textarea
                id="req-samples"
                name="sample_links"
                rows={2}
                placeholder="Links de leitores online, Mangadex, ou drive com amostras do trabalho da scan..."
              ></textarea>
            </div>

            <div class="form-actions-bar">
              <button type="submit" class="btn-submit-request" disabled={reqSubmitting}>
                {#if reqSubmitting}
                  <span>Enviando solicitação...</span>
                {:else}
                  <Send size={16} />
                  <span>Enviar Solicitação de Parceria</span>
                {/if}
              </button>
            </div>
          </form>
        </div>

        <div class="cta-box">
          <h2>Dúvidas antes de solicitar?</h2>
          <p>Entre no nosso Discord oficial e converse diretamente com a moderação na aba <strong>#parcerias-scan</strong>.</p>
          <a href="https://discord.gg/projectnox" target="_blank" rel="noopener noreferrer" class="btn-discord-cta">
            <MessageSquare size={18} />
            <span>Falar no Discord Oficial</span>
          </a>
        </div>
      </section>
    {:else}
      <!-- Active Member Dashboard -->
      <header class="dash-header">
        <div class="dash-title-cluster">
          <div class="header-tag">
            <ShieldCheck size={14} />
            <span>Painel Editorial de Scan</span>
          </div>
          <h1 class="dash-main-title">{data.currentScan.name}</h1>
          <div class="dash-role-row">
            <span class="role-badge">{ROLE_LABELS[data.userRole] || data.userRole}</span>
            <a href="/scans/{data.currentScan.slug}" class="link-public-profile">
              <span>Ver página pública ↗</span>
            </a>
          </div>
        </div>

        {#if data.myScans.length > 1}
          <div class="scan-switcher">
            <label for="switch-scan">Alternar Scan:</label>
            <select
              id="switch-scan"
              value={data.currentScan.id}
              onchange={(e) => {
                const target = e.target as HTMLSelectElement;
                window.location.href = `/scan?id=${target.value}`;
              }}
            >
              {#each data.myScans as s}
                <option value={s.id}>{s.name} ({ROLE_LABELS[s.role] || s.role})</option>
              {/each}
            </select>
          </div>
        {/if}
      </header>

      <!-- Stats Grid -->
      <div class="stats-overview">
        <div class="stat-card">
          <BookOpen size={20} class="stat-icon" />
          <div class="stat-meta">
            <span class="stat-num">{works.length}</span>
            <span class="stat-desc">Obras Vinculadas</span>
          </div>
        </div>

        <div class="stat-card">
          <Layers size={20} class="stat-icon" />
          <div class="stat-meta">
            <span class="stat-num">{chapters.length}</span>
            <span class="stat-desc">Capítulos Atribuídos</span>
          </div>
        </div>

        <div class="stat-card">
          <Eye size={20} class="stat-icon" />
          <div class="stat-meta">
            <span class="stat-num">{formatNumber(data.totalViews)}</span>
            <span class="stat-desc">Leituras Registradas</span>
          </div>
        </div>

        <div class="stat-card">
          <Users size={20} class="stat-icon" />
          <div class="stat-meta">
            <span class="stat-num">{team.length}</span>
            <span class="stat-desc">Membros na Equipe</span>
          </div>
        </div>
      </div>

      <!-- Main Columns -->
      <div class="dash-columns">
        <!-- Left: Settings & Team -->
        <div class="dash-col-left">
          {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
            <section class="card-section">
              <div class="section-top">
                <Settings size={18} />
                <h2>Informações da Scan</h2>
              </div>

              {#if showSuccess}
                <div class="success-banner">
                  <CheckCircle2 size={16} />
                  <span>Configurações salvas com sucesso!</span>
                </div>
              {/if}

              {#if form?.message}
                <div class="error-banner">
                  <AlertCircle size={16} />
                  <span>{form.message}</span>
                </div>
              {/if}

              <form
                method="POST"
                action="?/updateProfile"
                use:enhance={() => {
                  saving = true;
                  return async ({ update }) => {
                    saving = false;
                    await update();
                  };
                }}
                class="settings-form"
              >
                <input type="hidden" name="scan_id" value={data.currentScan.id} />

                <div class="form-field">
                  <label for="desc">Descrição / Bio:</label>
                  <textarea
                    id="desc"
                    name="description"
                    rows="3"
                    maxlength="2000"
                    placeholder="Apresente sua scan para os leitores..."
                  >{data.currentScan.description || ''}</textarea>
                </div>

                <div class="form-field">
                  <label for="discord">Link de Convite do Discord:</label>
                  <input
                    id="discord"
                    name="discord"
                    type="url"
                    placeholder="https://discord.gg/..."
                    value={data.currentScan.discord || ''}
                  />
                </div>

                <div class="form-field">
                  <label for="website">Website Oficial:</label>
                  <input
                    id="website"
                    name="website"
                    type="url"
                    placeholder="https://..."
                    value={data.currentScan.website || ''}
                  />
                </div>

                <button type="submit" class="btn-save" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </form>
            </section>
          {/if}

          <!-- Team Section -->
          <!-- Team Section -->
          <section class="card-section">
            <div class="section-top space-between">
              <div class="section-title-wrap">
                <Users size={18} />
                <h2>Membros da Equipe ({team.length})</h2>
              </div>
              {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
                <button type="button" class="btn-sm-action" onclick={() => (showInviteModal = true)}>
                  <Plus size={14} />
                  <span>Gerar Convite</span>
                </button>
              {/if}
            </div>

            {#if createdInvite}
              <div class="created-invite-banner">
                <div class="invite-banner-header">
                  <CheckCircle2 size={16} />
                  <span>Convite gerado com sucesso!</span>
                </div>
                <div class="invite-copy-group">
                  <input
                    type="text"
                    readonly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/convite/${createdInvite.code}` : `/convite/${createdInvite.code}`}
                    class="invite-copy-input font-mono"
                  />
                  <button
                    type="button"
                    class="btn-copy-action"
                    onclick={() => copyInviteLink(createdInvite.code)}
                  >
                    {#if copiedCode === createdInvite.code}
                      <Check size={14} />
                      <span>Copiado</span>
                    {:else}
                      <Copy size={14} />
                      <span>Copiar Link</span>
                    {/if}
                  </button>
                </div>
                <span class="invite-hint-txt">Link de uso único válido até {createdInvite.expires_at ? new Date(createdInvite.expires_at).toLocaleString('pt-BR') : 'expirar'}.</span>
              </div>
            {/if}

            {#if data.invites && data.invites.length > 0}
              <div class="active-invites-block">
                <span class="sub-section-title">Convites Ativos ({data.invites.length})</span>
                <div class="invites-list">
                  {#each data.invites as inv (inv.id)}
                    <div class="active-invite-item">
                      <div class="invite-info-left">
                        <span class="invite-role-tag">{ROLE_LABELS[inv.role] || inv.role}</span>
                        <span class="invite-exp-tag">
                          <Clock size={11} />
                          <span>Expira {relativeTime(inv.expires_at)}</span>
                        </span>
                      </div>
                      <div class="invite-actions-right">
                        <button
                          type="button"
                          class="btn-icon-sq"
                          title="Copiar Link"
                          onclick={() => copyInviteLink(inv.code)}
                        >
                          {#if copiedCode === inv.code}
                            <Check size={13} class="text-green" />
                          {:else}
                            <Copy size={13} />
                          {/if}
                        </button>
                        <form method="POST" action="?/revokeInvite" use:enhance>
                          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
                          <input type="hidden" name="invite_id" value={inv.id} />
                          <button type="submit" class="btn-revoke-sq" title="Revogar Convite">
                            <X size={13} />
                          </button>
                        </form>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            {#if data.transferRequests && data.transferRequests.some((t: any) => t.status === 'PENDING')}
              <div class="pending-transfers-block">
                <span class="sub-section-title"><Crown size={14} class="inline mr-1" /> Transferência Pendente</span>
                {#each data.transferRequests.filter((t: any) => t.status === 'PENDING') as tr (tr.id)}
                  <div class="pending-transfer-item">
                    <div class="transfer-to-info">
                      <span class="transfer-to-name">Proposta para <strong>{tr.to_user?.display_name || tr.to_user?.username}</strong></span>
                      <span class="transfer-to-sub">Aguardando aceite do membro</span>
                    </div>
                    {#if data.userRole === 'OWNER'}
                      <form method="POST" action="?/cancelOwnershipTransfer" use:enhance>
                        <input type="hidden" name="request_id" value={tr.id} />
                        <button type="submit" class="btn-cancel-req">Cancelar Proposta</button>
                      </form>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}

            <div class="team-list">
              {#each team as member (member.id)}
                <div class="team-member-item">
                  <UserAvatar
                    avatarId={member.avatar_id}
                    displayName={member.display_name || member.username}
                    size={38}
                  />
                  <div class="member-text">
                    <span class="member-display">{member.display_name || member.username}</span>
                    <span class="member-user">@{member.username}</span>
                  </div>

                  {#if data.userRole === 'OWNER' && member.id !== data.userId}
                    <div class="member-controls">
                      <form method="POST" action="?/updateMemberRole" use:enhance class="role-form">
                        <input type="hidden" name="scan_id" value={data.currentScan?.id} />
                        <input type="hidden" name="user_id" value={member.id} />
                        <select
                          name="role"
                          value={member.role}
                          class="role-select"
                          onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                        >
                          <option value="MEMBER">Staff</option>
                          <option value="UPLOADER">Uploader</option>
                          <option value="ADMIN">Admin da Scan</option>
                        </select>
                      </form>

                      <button
                        type="button"
                        class="btn-icon-member crown"
                        title="Transferir Liderança"
                        onclick={() => (transferTarget = member)}
                      >
                        <Crown size={14} />
                      </button>

                      <button
                        type="button"
                        class="btn-icon-member remove"
                        title="Remover da Equipe"
                        onclick={() => (removeTarget = member)}
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  {:else if data.userRole === 'ADMIN' && member.id !== data.userId && ['MEMBER', 'UPLOADER'].includes(member.role)}
                    <div class="member-controls">
                      <span class="role-pill">{ROLE_LABELS[member.role] || member.role}</span>
                      <button
                        type="button"
                        class="btn-icon-member remove"
                        title="Remover da Equipe"
                        onclick={() => (removeTarget = member)}
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  {:else}
                    <span class="role-pill" class:is-owner={member.role === 'OWNER'}>
                      {#if member.role === 'OWNER'}<Crown size={12} class="mr-1 inline" />{/if}
                      {ROLE_LABELS[member.role] || member.role}
                    </span>
                  {/if}
                </div>
              {/each}
            </div>
          </section>
        </div>

        <!-- Right: Works & Chapters -->
        <div class="dash-col-right">
          <!-- Works Section -->
          <section class="card-section">
            <div class="section-top space-between">
              <div class="section-title-wrap">
                <BookOpen size={18} />
                <h2>Obras Atribuídas ({works.length})</h2>
              </div>
              {#if ['OWNER', 'ADMIN', 'UPLOADER'].includes(data.userRole)}
                <button type="button" class="btn-sm-action" onclick={() => (showProjectModal = true)}>
                  <Plus size={14} />
                  <span>Solicitar Obra</span>
                </button>
              {/if}
            </div>

            {#if works.length > 0}
              <div class="works-list">
                {#each works as work (work.id)}
                  <div class="dash-work-row">
                    <a href="/obra/{work.slug}" class="dash-work-item">
                      {#if work.cover_id}
                        <img src="/media/{work.cover_id}" alt={work.title} class="work-mini-cover" />
                      {:else}
                        <div class="work-mini-placeholder">NOX</div>
                      {/if}
                      <div class="work-mini-info">
                        <span class="work-mini-title">{work.title}</span>
                        <span class="work-mini-views">
                          <Eye size={12} />
                          <span>{formatNumber(work.views_total || 0)} leituras</span>
                        </span>
                      </div>
                      <ArrowRight size={15} class="work-arrow" />
                    </a>

                    <div class="dash-work-status-cell">
                      {#if ['OWNER', 'ADMIN'].includes(data.userRole)}
                        <form method="POST" action="?/updateProjectStatus" use:enhance class="project-status-form">
                          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
                          <input type="hidden" name="work_id" value={work.id} />
                          <label for="work-status-{work.id}" class="sr-only">Status do Projeto</label>
                          <select
                            id="work-status-{work.id}"
                            name="status"
                            value={work.project_status || 'ACTIVE'}
                            class="project-status-select status-{(work.project_status || 'ACTIVE').toLowerCase()}"
                            onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                          >
                            <option value="ACTIVE">Ativo</option>
                            <option value="PAUSED">Pausado</option>
                            <option value="COMPLETED">Concluído</option>
                            <option value="ABANDONED">Abandonado</option>
                          </select>
                        </form>
                      {:else}
                        <span class="status-pill status-{(work.project_status || 'ACTIVE').toLowerCase()}">
                          {work.project_status === 'ACTIVE' ? 'Ativo' : work.project_status === 'PAUSED' ? 'Pausado' : work.project_status === 'COMPLETED' ? 'Concluído' : 'Abandonado'}
                        </span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="empty-text">Nenhuma obra atribuída a esta scan ainda.</p>
            {/if}

            <!-- Project Requests tracker for this scan -->
            {#if data.projectRequests && data.projectRequests.length > 0}
              <div class="project-requests-block">
                <span class="sub-section-title">Solicitações de Obras ({data.projectRequests.length})</span>
                <div class="proj-requests-list">
                  {#each data.projectRequests as req (req.id)}
                    <div class="proj-req-item status-{req.status.toLowerCase()}">
                      {#if req.works?.cover_id}
                        <img src="/media/{req.works.cover_id}" alt="" class="proj-cover-mini" />
                      {:else}
                        <div class="proj-cover-fallback">NOX</div>
                      {/if}
                      <div class="proj-info">
                        <strong class="proj-title">{req.works?.title}</strong>
                        {#if req.message}
                          <span class="proj-msg">"{req.message}"</span>
                        {/if}
                        {#if req.status === 'REJECTED' && req.rejection_reason}
                          <span class="proj-rejection-note">
                            <AlertTriangle size={12} />
                            <span>Motivo: {req.rejection_reason}</span>
                          </span>
                        {/if}
                      </div>
                      <div class="proj-actions-cell">
                        <span class="status-pill status-{req.status.toLowerCase()}">
                          {req.status === 'PENDING' ? 'Em Análise' : req.status === 'APPROVED' ? 'Aprovada' : req.status === 'CANCELLED' ? 'Cancelada' : 'Recusada'}
                        </span>
                        {#if req.status === 'PENDING' && ['OWNER', 'ADMIN'].includes(data.userRole)}
                          <form method="POST" action="?/cancelProjectRequest" use:enhance>
                            <input type="hidden" name="request_id" value={req.id} />
                            <button type="submit" class="btn-cancel-req">Cancelar Pedido</button>
                          </form>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </section>

          <!-- Recent Chapters -->
          <section class="card-section">
            <div class="section-top">
              <Layers size={18} />
              <h2>Últimos Capítulos Registrados</h2>
            </div>

            {#if chapters.length > 0}
              <div class="recent-chapters-list">
                {#each chapters as ch (ch.id)}
                  <a href="/ler/{ch.id}" class="dash-ch-item">
                    <div class="ch-left">
                      <span class="ch-work">{ch.works?.title}</span>
                      <span class="ch-num">Capítulo {ch.number}</span>
                    </div>
                    <div class="ch-right">
                      <span class="ch-views-count">
                        <Eye size={12} />
                        <span>{formatNumber(ch.views_total || 0)}</span>
                      </span>
                      <time datetime={ch.published_at}>{relativeTime(ch.published_at)}</time>
                    </div>
                  </a>
                {/each}
              </div>
            {:else}
              <p class="empty-text">Nenhum capítulo lançado recentemente.</p>
            {/if}
          </section>
        </div>
      </div>
    {/if}
  </div>

  <!-- Modals -->
  {#if showInviteModal}
    <div class="modal-backdrop" onclick={() => (showInviteModal = false)}>
      <div class="modal-card mini-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">Gerar Convite de Equipe</h2>
          <button class="btn-close-modal" onclick={() => (showInviteModal = false)}><X size={18} /></button>
        </div>
        <form
          method="POST"
          action="?/createInvite"
          use:enhance={() => {
            inviteSubmitting = true;
            return async ({ update }) => {
              inviteSubmitting = false;
              showInviteModal = false;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          <div class="form-field">
            <label for="inv-role">Cargo Concedido:</label>
            <select id="inv-role" name="role" bind:value={inviteRole} class="form-select">
              <option value="MEMBER">Membro / Tradutor</option>
              <option value="UPLOADER">Uploader / Revisor</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div class="form-field">
            <label for="inv-hours">Validade do Link:</label>
            <select id="inv-hours" name="hours" bind:value={inviteHours} class="form-select">
              <option value={24}>24 Horas (1 dia)</option>
              <option value={48}>48 Horas (2 dias)</option>
              <option value={168}>7 Dias</option>
              <option value={720}>30 Dias</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (showInviteModal = false)}>Cancelar</button>
            <button type="submit" class="btn-primary" disabled={inviteSubmitting}>
              <Plus size={15} />
              <span>{inviteSubmitting ? 'Gerando...' : 'Gerar Convite'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if showProjectModal}
    <div class="modal-backdrop" onclick={() => (showProjectModal = false)}>
      <div class="modal-card mini-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">Solicitar Obra do Catálogo</h2>
          <button class="btn-close-modal" onclick={() => (showProjectModal = false)}><X size={18} /></button>
        </div>
        <form
          method="POST"
          action="?/requestProject"
          use:enhance={() => {
            projectSubmitting = true;
            return async ({ update }) => {
              projectSubmitting = false;
              showProjectModal = false;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          <div class="form-field">
            <label for="proj-work">Selecione a Obra Desejada:</label>
            <select id="proj-work" name="work_id" bind:value={selectedWorkId} required class="form-select">
              <option value="" disabled>Escolha uma obra...</option>
              {#each data.catalogWorks as w}
                <option value={w.id}>{w.title}</option>
              {/each}
            </select>
          </div>
          <div class="form-field">
            <label for="proj-msg">Mensagem / Justificativa (Opcional):</label>
            <textarea
              id="proj-msg"
              name="message"
              rows={3}
              bind:value={projectMessage}
              placeholder="Ex: Nossa equipe já traduz essa obra há 2 anos e gostaríamos de vincular nossos lançamentos..."
              class="form-textarea"
            ></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (showProjectModal = false)}>Cancelar</button>
            <button type="submit" class="btn-primary" disabled={projectSubmitting || !selectedWorkId}>
              <Send size={15} />
              <span>{projectSubmitting ? 'Enviando...' : 'Enviar Solicitação'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if transferTarget}
    <div class="modal-backdrop" onclick={() => (transferTarget = null)}>
      <div class="modal-card mini-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">Transferir Liderança</h2>
          <button class="btn-close-modal" onclick={() => (transferTarget = null)}><X size={18} /></button>
        </div>
        <form
          method="POST"
          action="?/transferOwnership"
          use:enhance={() => {
            transferSubmitting = true;
            return async ({ update }) => {
              transferSubmitting = false;
              transferTarget = null;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          <input type="hidden" name="target_user_id" value={transferTarget.id} />
          <div class="warning-alert-box">
            <AlertTriangle size={24} class="warning-alert-icon" />
            <div>
              <strong>Atenção: Confirmação em duas etapas</strong>
              <p>
                Você está prestes a propor a transferência de liderança da scan <strong>{data.currentScan?.name}</strong> para
                <strong>{transferTarget.display_name || transferTarget.username}</strong> (@{transferTarget.username}).
                O membro receberá um alerta e precisará aceitar a transferência para se tornar o novo Dono.
              </p>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (transferTarget = null)}>Cancelar</button>
            <button type="submit" class="btn-primary" disabled={transferSubmitting}>
              <Crown size={15} />
              <span>{transferSubmitting ? 'Enviando Proposta...' : 'Enviar Proposta de Transferência'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if removeTarget}
    <div class="modal-backdrop" onclick={() => (removeTarget = null)}>
      <div class="modal-card mini-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2 class="modal-title">Remover Membro</h2>
          <button class="btn-close-modal" onclick={() => (removeTarget = null)}><X size={18} /></button>
        </div>
        <form
          method="POST"
          action="?/removeMember"
          use:enhance={() => {
            removeSubmitting = true;
            return async ({ update }) => {
              removeSubmitting = false;
              removeTarget = null;
              await update();
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={data.currentScan?.id} />
          <input type="hidden" name="user_id" value={removeTarget.id} />
          <div class="warning-alert-box danger">
            <UserMinus size={24} class="warning-alert-icon text-red" />
            <div>
              <strong>Remover da equipe?</strong>
              <p>
                Tem certeza que deseja remover <strong>{removeTarget.display_name || removeTarget.username}</strong> (@{removeTarget.username}) da equipe?
                Ele perderá o acesso às permissões de uploader e edição da scan.
              </p>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => (removeTarget = null)}>Cancelar</button>
            <button type="submit" class="btn-danger-action" disabled={removeSubmitting}>
              <UserMinus size={15} />
              <span>{removeSubmitting ? 'Removendo...' : 'Remover Membro'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .scan-dashboard-page {
    min-height: 100vh;
    padding: 2.5rem 1.5rem 5rem;
    color: #e2e8f0;
  }

  .dashboard-container {
    max-width: 1440px;
    margin: 0 auto;
  }

  /* Unauthenticated */
  .onboarding-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 6rem 2rem;
    background: radial-gradient(circle at top, rgba(139, 92, 246, 0.15), transparent 70%), #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
  }

  .hero-icon-ring {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c4b5fd;
    margin-bottom: 1.5rem;
  }

  .onboarding-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.4rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.75rem;
  }

  .onboarding-sub {
    font-size: 1.05rem;
    color: #94a3b8;
    max-width: 580px;
    line-height: 1.6;
    margin: 0 0 2rem;
  }

  .onboarding-actions {
    display: flex;
    gap: 1rem;
  }

  .btn-primary {
    padding: 0.85rem 2rem;
    background: #8b5cf6;
    color: #ffffff;
    border-radius: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    background: #7c3aed;
    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
  }

  .btn-secondary {
    padding: 0.85rem 2rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    border-radius: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  /* Partnership Portal */
  .partnership-portal {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .portal-header {
    text-align: center;
    max-width: 800px;
    margin: 0 auto;
  }

  .badge-partnership {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    border-radius: 9999px;
    color: #dfc28d;
    font-size: 0.82rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .portal-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.4rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 1rem;
    letter-spacing: -0.02em;
  }

  .portal-sub {
    font-size: 1.05rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0;
  }

  .perks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .perk-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .perk-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(139, 92, 246, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c4b5fd;
    margin-bottom: 0.25rem;
  }

  .perk-card h3 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .perk-card p {
    font-size: 0.9rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0;
  }

  .cta-box {
    background: radial-gradient(circle at top center, rgba(139, 92, 246, 0.2), transparent 70%), #0e111d;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 20px;
    padding: 3rem 2rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .cta-box h2 {
    font-size: 1.8rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .cta-box p {
    font-size: 1rem;
    color: #cbd5e1;
    max-width: 600px;
    line-height: 1.6;
    margin: 0 0 0.5rem;
  }

  .btn-discord-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.9rem 2.2rem;
    background: #5865f2;
    color: #ffffff;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-discord-cta:hover {
    background: #4752c4;
    box-shadow: 0 6px 24px rgba(88, 101, 242, 0.45);
    transform: translateY(-2px);
  }

  /* Active Dashboard */
  .dash-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-wrap: wrap;
  }

  .header-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #dfc28d;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.4rem;
  }

  .dash-main-title {
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 2.2rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
  }

  .dash-role-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .role-badge {
    padding: 0.25rem 0.65rem;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 6px;
    color: #c4b5fd;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .link-public-profile {
    font-size: 0.85rem;
    color: #94a3b8;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .link-public-profile:hover {
    color: #dfc28d;
  }

  .scan-switcher {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .scan-switcher select {
    padding: 0.5rem 1rem;
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #ffffff;
    font-size: 0.88rem;
    outline: none;
  }

  /* Stats overview */
  .stats-overview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
    margin-bottom: 2.5rem;
  }

  .stat-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 1.25rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  :global(.stat-icon) {
    color: #dfc28d;
  }

  .stat-meta {
    display: flex;
    flex-direction: column;
  }

  .stat-num {
    font-size: 1.6rem;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.1;
  }

  .stat-desc {
    font-size: 0.8rem;
    color: #94a3b8;
    margin-top: 0.2rem;
  }

  /* Columns */
  .dash-columns {
    display: grid;
    grid-template-columns: 1fr 1.25fr;
    gap: 2rem;
  }

  .dash-col-left,
  .dash-col-right {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .card-section {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
    padding: 1.5rem;
  }

  .section-top {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1.25rem;
    color: #dfc28d;
  }

  .section-top h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .form-field label {
    font-size: 0.85rem;
    color: #cbd5e1;
    font-weight: 600;
  }

  .form-field input,
  .form-field textarea {
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #ffffff;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .form-field input:focus,
  .form-field textarea:focus {
    border-color: #8b5cf6;
  }

  .btn-save {
    padding: 0.75rem 1.5rem;
    background: #8b5cf6;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    align-self: flex-start;
    margin-top: 0.5rem;
  }

  .btn-save:hover {
    background: #7c3aed;
  }

  .success-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 8px;
    color: #6ee7b7;
    font-size: 0.88rem;
    margin-bottom: 1rem;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.88rem;
    margin-bottom: 1rem;
  }

  /* Team */
  .team-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .team-member-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
  }

  .member-text {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .member-display {
    font-size: 0.9rem;
    font-weight: 700;
    color: #ffffff;
  }

  .member-user {
    font-size: 0.75rem;
    color: #64748b;
  }

  .role-pill {
    padding: 0.2rem 0.5rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    font-size: 0.72rem;
    color: #cbd5e1;
  }

  /* Works List */
  .works-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .dash-work-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.6rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
  }

  .dash-work-item:hover {
    background: rgba(255, 255, 255, 0.07);
    transform: translateX(3px);
  }

  .work-mini-cover {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    object-fit: cover;
  }

  .work-mini-placeholder {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    background: #1e1b4b;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: #c4b5fd;
  }

  .work-mini-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.2rem;
  }

  .work-mini-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: #ffffff;
  }

  .work-mini-views {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  :global(.work-arrow) {
    color: #64748b;
  }

  /* Recent Chapters */
  .recent-chapters-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .dash-ch-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: background 0.2s ease;
  }

  .dash-ch-item:hover {
    background: rgba(255, 255, 255, 0.07);
  }

  .ch-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .ch-work {
    font-weight: 700;
    color: #ffffff;
    font-size: 0.9rem;
  }

  .ch-num {
    padding: 0.15rem 0.45rem;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #c4b5fd;
  }

  .ch-right {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.78rem;
    color: #64748b;
  }

  .ch-views-count {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .empty-text {
    font-size: 0.88rem;
    color: #64748b;
    margin: 0;
  }

  .font-mono {
    font-family: monospace;
  }

  .text-green {
    color: #34d399 !important;
  }

  .text-red {
    color: #f87171 !important;
  }

  /* Non-member Request Tracking */
  .my-partner-requests-card {
    background: #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .requests-card-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: #dfc28d;
  }

  .requests-card-header h2 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  .requests-track-list {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .track-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
  }

  .track-item.status-pending {
    border-color: rgba(139, 92, 246, 0.3);
  }

  .track-item.status-approved {
    border-color: rgba(16, 185, 129, 0.3);
  }

  .track-item.status-rejected {
    border-color: rgba(239, 68, 68, 0.25);
  }

  .track-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .track-scan-info {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .track-scan-name {
    font-size: 1.05rem;
    font-weight: 800;
    color: #ffffff;
  }

  .track-scan-slug {
    font-size: 0.82rem;
    color: #8c899e;
  }

  .track-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    margin: 0;
  }

  .track-rejection-msg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 0.82rem;
  }

  .track-approved-msg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 8px;
    color: #6ee7b7;
    font-size: 0.82rem;
  }

  .track-pending-msg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: 0.82rem;
  }

  .track-date {
    font-size: 0.75rem;
    color: #64748b;
    align-self: flex-end;
  }

  /* In-Platform Application Form Card */
  .partner-form-card {
    background: radial-gradient(circle at top right, rgba(139, 92, 246, 0.1), transparent 60%), #0e111d;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2.2rem;
  }

  .partner-form-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .partner-form-header h2 {
    font-size: 1.4rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.25rem;
  }

  .partner-form-header p {
    font-size: 0.9rem;
    color: #94a3b8;
    margin: 0;
  }

  .accent-icon {
    color: #dfc28d;
    margin-top: 3px;
  }

  .partner-request-form {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .flex-1 {
    flex: 1;
    min-width: 220px;
  }

  .form-actions-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .btn-submit-request {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 2rem;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.92rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-submit-request:hover:not(:disabled) {
    background: linear-gradient(135deg, #9333ea, #8b5cf6);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
  }

  .btn-submit-request:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Member Team Section Controls & Invites */
  .space-between {
    justify-content: space-between;
  }

  .section-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .btn-sm-action {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.9rem;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.35);
    color: #c4b5fd;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-sm-action:hover {
    background: rgba(139, 92, 246, 0.25);
    color: #ffffff;
  }

  .created-invite-banner {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .invite-banner-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6ee7b7;
    font-weight: 700;
    font-size: 0.88rem;
  }

  .invite-copy-group {
    display: flex;
    gap: 0.5rem;
  }

  .invite-copy-input {
    flex: 1;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.5rem 0.8rem;
    color: #ffffff;
    font-size: 0.85rem;
    outline: none;
  }

  .btn-copy-action {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: #10b981;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-copy-action:hover {
    background: #059669;
  }

  .invite-hint-txt {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .active-invites-block {
    margin-bottom: 1.25rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sub-section-title {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #8c899e;
    margin-bottom: 0.75rem;
  }

  .invites-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .active-invite-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.85rem;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }

  .invite-info-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .invite-role-tag {
    font-size: 0.75rem;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .invite-exp-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .invite-actions-right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .btn-icon-sq {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-icon-sq:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .btn-revoke-sq {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #f87171;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-revoke-sq:hover {
    background: rgba(239, 68, 68, 0.22);
  }

  .member-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .role-form {
    margin: 0;
  }

  .role-select {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #cbd5e1;
    font-size: 0.75rem;
    padding: 3px 6px;
    outline: none;
  }

  .btn-icon-member {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-icon-member.crown {
    color: #dfc28d;
  }

  .btn-icon-member.crown:hover {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.35);
  }

  .btn-icon-member.remove {
    color: #f87171;
  }

  .btn-icon-member.remove:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.35);
  }

  .role-pill.is-owner {
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-weight: 700;
  }

  /* Project Requests Tracker */
  .project-requests-block {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .proj-requests-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .proj-req-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  .proj-cover-mini {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    object-fit: cover;
  }

  .proj-cover-fallback {
    width: 36px;
    height: 50px;
    border-radius: 6px;
    background: #1a1d2e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: #8c899e;
  }

  .proj-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.2rem;
  }

  .proj-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #ffffff;
  }

  .proj-msg {
    font-size: 0.78rem;
    color: #94a3b8;
    font-style: italic;
  }

  .proj-rejection-note {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #fca5a5;
  }

  .status-pill {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .status-pill.status-pending {
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .status-pill.status-approved {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-pill.status-rejected {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 20px;
  }

  .modal-card {
    background: #0f121d;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    width: 100%;
    max-width: 560px;
    padding: 24px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
  }

  .mini-modal {
    max-width: 480px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
  }

  .modal-title {
    font-size: 1.2rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
  }

  .btn-close-modal {
    background: transparent;
    border: none;
    color: #8c899e;
    cursor: pointer;
    padding: 4px;
  }

  .btn-close-modal:hover {
    color: #ffffff;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-select {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    color: #ffffff;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .form-select:focus {
    border-color: #8b5cf6;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .btn-danger-action {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #ef4444;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .btn-danger-action:hover:not(:disabled) {
    background: #dc2626;
  }

  .btn-danger-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .warning-alert-box {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 12px;
    color: #fde68a;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .warning-alert-box strong {
    display: block;
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
    color: #fbbf24;
  }

  .warning-alert-box p {
    margin: 0;
    color: #fde68a;
  }

  .warning-alert-box.danger {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .warning-alert-box.danger strong {
    color: #f87171;
  }

  .warning-alert-box.danger p {
    color: #fca5a5;
  }

  /* Transfer Alert Card */
  .transfer-alert-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    background: linear-gradient(135deg, rgba(223, 194, 141, 0.15) 0%, rgba(18, 20, 32, 0.95) 100%);
    border: 1px solid rgba(223, 194, 141, 0.4);
    box-shadow: 0 8px 32px rgba(223, 194, 141, 0.1);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 2rem;
  }

  .transfer-alert-left {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .transfer-icon-ring {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(223, 194, 141, 0.2);
    border: 1px solid rgba(223, 194, 141, 0.4);
    color: #dfc28d;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .transfer-alert-text h3 {
    font-size: 1.05rem;
    font-weight: 800;
    color: #fef08a;
    margin: 0 0 0.25rem 0;
  }

  .transfer-alert-text p {
    font-size: 0.88rem;
    color: #cbd5e1;
    margin: 0;
  }

  .transfer-alert-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .btn-transfer-accept {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #10b981;
    color: #ffffff;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.6rem 1.1rem;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-transfer-accept:hover {
    background: #059669;
  }

  .btn-transfer-reject {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.6rem 1.1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-transfer-reject:hover {
    background: rgba(239, 68, 68, 0.25);
    color: #ffffff;
  }

  /* Status and Action Buttons */
  .track-status-cell,
  .proj-actions-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-cancel-req {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.25rem 0.6rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #fca5a5;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel-req:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ffffff;
  }

  /* Pending Transfers Block */
  .pending-transfers-block {
    margin-bottom: 1.25rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .pending-transfer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: rgba(223, 194, 141, 0.06);
    border: 1px solid rgba(223, 194, 141, 0.15);
    border-radius: 8px;
  }

  .transfer-to-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.82rem;
    color: #ffffff;
  }

  .transfer-to-sub {
    font-size: 0.72rem;
    color: #dfc28d;
  }

  /* Work Rows and Project Status Selector */
  .dash-work-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .dash-work-row .dash-work-item {
    flex: 1;
    background: transparent;
    padding: 0;
  }

  .dash-work-row .dash-work-item:hover {
    background: transparent;
    transform: none;
  }

  .project-status-select {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    background: #141828;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
    cursor: pointer;
    outline: none;
    transition: all 0.15s ease;
  }

  .project-status-select:hover {
    border-color: rgba(223, 194, 141, 0.5);
  }

  .project-status-select.status-active {
    color: #6ee7b7;
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.1);
  }

  .project-status-select.status-paused {
    color: #fcd34d;
    border-color: rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.1);
  }

  .project-status-select.status-completed {
    color: #93c5fd;
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.1);
  }

  .project-status-select.status-abandoned {
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.1);
  }

  .status-pill.status-cancelled {
    background: rgba(100, 116, 139, 0.15);
    color: #94a3b8;
    border: 1px solid rgba(100, 116, 139, 0.3);
  }

  @media (max-width: 900px) {
    .dash-columns {
      grid-template-columns: 1fr;
    }
    .transfer-alert-card {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
