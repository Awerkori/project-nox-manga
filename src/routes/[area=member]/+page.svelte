<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import Empty from '$lib/components/Empty.svelte';
  import WorkCard from '$lib/components/WorkCard.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import { pageLink } from '$lib/pagination';
  import { date, statusLabels, memberRank } from '$lib/types';
  import {
    getLevelProgress,
    NOX_TITLES,
    NOX_BADGES,
    getUnlockedTitles,
    getUnlockedBadges
  } from '$lib/levels';
  import {
    BookOpen,
    MessageSquare,
    Trophy,
    Shield,
    Bell,
    Library,
    Bookmark,
    History,
    UserRound,
    Camera,
    ExternalLink,
    Sparkles,
    Check,
    AlertCircle,
    LogOut,
    Smartphone
  } from '@lucide/svelte';

  let { data } = $props();
  let notice = $state('');
  let noticeType = $state<'info' | 'success' | 'error'>('info');
  let busy = $state(false);
  let busyMihon = $state(false);
  let previewAvatar = $state<string | null>(null);
  let generatedMihonToken = $state('');
  let copiedToken = $state(false);

  const tabs = [
    { path: 'biblioteca', label: 'Biblioteca', icon: Library },
    { path: 'favoritos', label: 'Favoritos', icon: Bookmark },
    { path: 'historico', label: 'Histórico', icon: History },
    { path: 'notificacoes', label: 'Notificações', icon: Bell },
    { path: 'perfil', label: 'Perfil', icon: UserRound }
  ];

  const rank = $derived(
    memberRank(data.profile?.xp || 0, data.profile?.equipped_title_id, data.profile?.equipped_badge_id)
  );
  const progress = $derived(getLevelProgress(data.profile?.xp || 0));
  const unlockedTitles = $derived(getUnlockedTitles(progress.currentLevel));
  const unlockedBadges = $derived(getUnlockedBadges(progress.currentLevel));

  async function equipTitle(titleId: string) {
    if (busy) return;
    busy = true;
    notice = '';
    try {
      await action('member', 'equip_title', { title_id: titleId });
      noticeType = 'success';
      notice = 'Título equipado com sucesso!';
      await invalidateAll();
    } catch (e) {
      noticeType = 'error';
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function equipBadge(badgeId: string) {
    if (busy) return;
    busy = true;
    notice = '';
    try {
      await action('member', 'equip_badge', { badge_id: badgeId });
      noticeType = 'success';
      notice = 'Insígnia equipada com sucesso!';
      await invalidateAll();
    } catch (e) {
      noticeType = 'error';
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  const pageHref = (page: number) =>
    pageLink(`/${data.area}`, page, { status: data.tab, filtro: data.filter });

  async function avatar(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    busy = true;
    notice = '';

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    previewAvatar = localUrl;

    try {
      if (file.size > 5_000_000) throw new Error('Selecione uma imagem de até 5 MB.');
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível processar a imagem.');
      const size = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(
        bitmap,
        (bitmap.width - size) / 2,
        (bitmap.height - size) / 2,
        size,
        size,
        0,
        0,
        256,
        256
      );
      bitmap.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Imagem inválida.'))), 'image/webp', 0.85)
      );
      const response = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: blob
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      noticeType = 'success';
      notice = 'Avatar atualizado com sucesso!';
      await invalidateAll();
    } catch (e) {
      previewAvatar = null;
      noticeType = 'error';
      notice = (e as Error).message;
    } finally {
      busy = false;
      input.value = '';
    }
  }

  let title = $derived(
    {
      biblioteca: 'Sua biblioteca',
      favoritos: 'Histórias favoritas',
      historico: 'Histórico de leitura',
      notificacoes: 'Notificações',
      perfil: 'Meu perfil'
    }[data.area] || 'Meu espaço'
  );

  async function save(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    notice = '';
    try {
      await action(
        'member',
        'profile',
        Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement))
      );
      noticeType = 'success';
      notice = 'Perfil atualizado com sucesso!';
      await invalidateAll();
    } catch (e) {
      noticeType = 'error';
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function read() {
    if (busy) return;
    busy = true;
    try {
      await action('member', 'notifications', {});
      await invalidateAll();
      noticeType = 'success';
      notice = 'Notificações marcadas como lidas.';
    } catch (e) {
      noticeType = 'error';
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function clearHistory() {
    if (busy) return;
    if (!window.confirm('Tem certeza que deseja limpar todo o seu histórico de leitura? Esta ação não pode ser desfeita.')) return;
    busy = true;
    notice = '';
    try {
      await action('member', 'clear_history', {});
      noticeType = 'success';
      notice = 'Histórico de leitura limpo com sucesso.';
      await invalidateAll();
    } catch (e) {
      noticeType = 'error';
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function savePreferences(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    notice = '';
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const age_status = String(form.get('age_status') || 'UNKNOWN');
    const blur_nsfw = age_status === 'MINOR' ? true : form.get('blur_nsfw') === 'on';
    try {
      await action('member', 'preferences', { age_status, blur_nsfw });
      const { setAgeStatus, setBlurNsfw } = await import('$lib/preferences');
      if (age_status === 'ADULT' || age_status === 'MINOR') setAgeStatus(age_status);
      setBlurNsfw(blur_nsfw);
      noticeType = 'success';
      notice = 'Preferências de conteúdo atualizadas!';
      await invalidateAll();
    } catch (e) {
      noticeType = 'error';
      notice = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function createMihonToken() {
    busyMihon = true;
    notice = '';
    try {
      const res = await fetch('/api/mihon/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_name: 'Mihon Android' })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Erro ao gerar token');
      generatedMihonToken = resData.token;
      noticeType = 'success';
      notice = 'Token Mihon gerado com sucesso! Copie-o agora.';
    } catch (e) {
      noticeType = 'error';
      notice = (e as Error).message;
    } finally {
      busyMihon = false;
    }
  }
</script>

<svelte:head>
  <title>{title} — Project Nox</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="container spacer-bottom">
  <div class="page-top">
    <div class="badge-tag">
      <Sparkles size={12} />
      <span>MEU ESPAÇO</span>
    </div>
    <h1 class="page-title">{title}</h1>
  </div>

  <!-- Modern Responsive Tab Bar -->
  <nav class="member-tabs-bar" aria-label="Navegação da conta">
    <div class="member-tabs-scroll">
      {#each tabs as tab (tab.path)}
        <a
          class="member-tab-btn"
          class:active={tab.path === data.area}
          href="/{tab.path}"
        >
          <tab.icon size={16} />
          <span>{tab.label}</span>
          {#if tab.path === 'notificacoes' && data.unread > 0}
            <span class="tab-unread-pill">{data.unread}</span>
          {/if}
        </a>
      {/each}
    </div>
  </nav>

  {#if notice}
    <div
      class="member-notice-banner"
      class:is-success={noticeType === 'success'}
      class:is-error={noticeType === 'error'}
      role="status"
    >
      {#if noticeType === 'success'}
        <Check size={18} />
      {:else if noticeType === 'error'}
        <AlertCircle size={18} />
      {:else}
        <Sparkles size={18} />
      {/if}
      <span>{notice}</span>
    </div>
  {/if}

  {#if data.area === 'perfil' && data.profile}
    <div class="profile-layout-grid">
      <!-- Left Column: Identity, Level Progression & Stats -->
      <section class="profile-card profile-card-left">
        <div class="profile-avatar-interactive">
          <div class="avatar-frame">
            {#if previewAvatar}
              <img
                src={previewAvatar}
                alt="Prévia do seu avatar"
                class="avatar-large-img"
              />
            {:else if data.profile.avatar_id}
              <img
                src="/media/{data.profile.avatar_id}"
                alt="Seu avatar"
                class="avatar-large-img"
              />
            {:else}
              <span class="avatar-large-fallback">
                {(data.profile.display_name[0] || 'N').toUpperCase()}
              </span>
            {/if}
            <div class="avatar-glow-ring"></div>
          </div>

          <label class="avatar-upload-badge" title="Alterar foto do perfil">
            <Camera size={14} />
            <span>{busy ? 'Enviando…' : 'Alterar foto'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onchange={avatar}
              class="hidden-file-input"
            />
          </label>
        </div>

        <div class="profile-hero-meta">
          <div class="profile-title-chip-row">
            {#if rank.badgeSvg}
              <img src={rank.badgeSvg} alt={rank.badge} width="24" height="24" class="profile-badge-vector" />
            {:else if rank.badgeIcon}
              <span class="profile-badge-glyph tier-{rank.badgeTier}" title="Insígnia equipada">{rank.badgeIcon}</span>
            {/if}
            <span class="honorific-badge">{rank.title}</span>
          </div>
          <h2 class="profile-user-display">{data.profile.display_name}</h2>
          <p class="profile-user-sub">
            @{data.profile.username} · Na Nox desde {date(data.profile.created_at)}
          </p>
          <a class="public-profile-link" href="/u/{data.profile.username}">
            <span>Ver perfil público</span>
            <ExternalLink size={12} />
          </a>
        </div>

        <!-- Stats Grid -->
        <div class="profile-stats-grid">
          <div class="profile-stat-item">
            <span class="stat-number highlight-purple">{progress.currentLevel}</span>
            <span class="stat-name">Nível</span>
          </div>
          <div class="profile-stat-item">
            <span class="stat-number highlight-gold">{data.profile.xp}</span>
            <span class="stat-name">XP</span>
          </div>
          <div class="profile-stat-item">
            <span class="stat-number">{data.completed}</span>
            <span class="stat-name">Capítulos</span>
          </div>
          <div class="profile-stat-item">
            <span class="stat-number">{data.libraryTotal}</span>
            <span class="stat-name">Na biblioteca</span>
          </div>
          <div class="profile-stat-item">
            <span class="stat-number">{data.completedWorks}</span>
            <span class="stat-name">Concluídas</span>
          </div>
        </div>

        <!-- Glowing XP Progress Track -->
        <div class="profile-xp-section">
          <div class="xp-bar-header">
            <span class="xp-bar-label">Progresso do Nível {progress.currentLevel}</span>
            <span class="xp-bar-percent">{progress.progressPercent}%</span>
          </div>
          <div class="profile-xp-track">
            <div
              class="profile-xp-fill"
              style="width: {progress.progressPercent}%"
            ></div>
          </div>
          <p class="profile-xp-caption">
            {#if progress.isMaxLevel}
              <strong>Nível Máximo Alcançado (100)</strong>
            {:else}
              Faltam <strong>{progress.xpNeededForNext} XP</strong> para o nível {progress.nextLevel}
            {/if}
          </p>
        </div>

        <!-- Coleção de Insígnias & Badges -->
        <div class="profile-collection-card">
          <div class="collection-header">
            <div>
              <h3 class="collection-title">Insígnias Colecionáveis</h3>
              <span class="collection-sub">{unlockedBadges.length} de {NOX_BADGES.length} desbloqueadas</span>
            </div>
          </div>
          <div class="badges-scroll-grid">
            {#each NOX_BADGES as b (b.id)}
              {@const isUnlocked = progress.currentLevel >= b.minLevel}
              {@const isEquipped = (data.profile.equipped_badge_id || 'marca-inicial') === b.id}
              <div class="badge-tile" class:locked={!isUnlocked} class:equipped={isEquipped}>
                <div class="badge-tile-icon tier-{b.tier}">
                  {#if b.svgUrl}
                    <img src={b.svgUrl} alt={b.name} width="32" height="32" class="badge-svg-img" />
                  {:else}
                    <span>{b.icon}</span>
                  {/if}
                </div>
                <div class="badge-tile-meta">
                  <div class="badge-tile-header">
                    <strong class="badge-tile-name">{b.name}</strong>
                    <span class="badge-tile-tier tier-{b.tier}">{b.tier}</span>
                  </div>
                  <p class="badge-tile-desc">{b.description}</p>
                  <div class="badge-tile-action">
                    {#if isEquipped}
                      <span class="badge-state-pill active">✦ Equipada</span>
                    {:else if isUnlocked}
                      <button
                        type="button"
                        class="btn-tile-equip"
                        disabled={busy}
                        onclick={() => equipBadge(b.id)}
                      >
                        Equipar
                      </button>
                    {:else}
                      <span class="badge-state-pill locked">Nv. {b.minLevel}</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Coleção de Títulos Honoríficos -->
        <div class="profile-collection-card" style="margin-top: 14px;">
          <div class="collection-header">
            <div>
              <h3 class="collection-title">Títulos Honoríficos</h3>
              <span class="collection-sub">{unlockedTitles.length} de {NOX_TITLES.length} desbloqueados</span>
            </div>
          </div>
          <div class="titles-scroll-list">
            {#each NOX_TITLES as t (t.id)}
              {@const isUnlocked = progress.currentLevel >= t.minLevel}
              {@const isEquipped = (data.profile.equipped_title_id || 'nox-reader') === t.id}
              <div class="title-row-item" class:locked={!isUnlocked} class:equipped={isEquipped}>
                <div class="title-info">
                  <strong class="title-name">{t.name}</strong>
                  <span class="title-desc">{t.description}</span>
                </div>
                <div class="title-action-wrap">
                  {#if isEquipped}
                    <span class="title-pill active">Equipado</span>
                  {:else if isUnlocked}
                    <button
                      type="button"
                      class="btn-title-equip"
                      disabled={busy}
                      onclick={() => equipTitle(t.id)}
                    >
                      Equipar
                    </button>
                  {:else}
                    <span class="title-pill locked">Nv. {t.minLevel}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>

        <form method="POST" action="/auth/sair" class="logout-form">
          <button class="logout-btn">
            <LogOut size={14} />
            <span>Sair da conta</span>
          </button>
        </form>
      </section>

      <!-- Right Column: Edit Profile Form -->
      <form class="profile-card profile-card-right" onsubmit={save}>
        <h3 class="edit-card-title">Editar Perfil</h3>
        <p class="edit-card-sub">Atualize sua identidade e bio na plataforma.</p>

        <label class="field-label">
          <span>Nome de exibição</span>
          <input
            name="display_name"
            class="field-input"
            value={data.profile.display_name}
            required
            maxlength="60"
            placeholder="Como você quer ser chamado"
          />
        </label>

        <label class="field-label">
          <span>Nome de usuário</span>
          <div class="username-input-wrap">
            <span class="prefix">@</span>
            <input
              name="username"
              class="field-input username-field"
              value={data.profile.username}
              required
              minlength="3"
              maxlength="30"
              pattern="[a-z0-9_]+"
              placeholder="seu_usuario"
            />
          </div>
          <small class="field-hint">Apenas letras minúsculas, números e sublinhado (_).</small>
        </label>

        <label class="field-label">
          <span>Sobre você</span>
          <textarea
            name="bio"
            class="field-textarea"
            rows="4"
            maxlength="500"
            placeholder="Conte um pouco sobre suas leituras e gêneros favoritos..."
          >{data.profile.bio || ''}</textarea>
        </label>

        <div class="form-actions">
          <button class="save-profile-btn" disabled={busy}>
            {#if busy}
              <span>Salvando alterações…</span>
            {:else}
              <Check size={16} />
              <span>Salvar alterações</span>
            {/if}
          </button>
        </div>
      </form>

      <!-- Preferences: Conteúdo Adulto (+18) -->
      <form class="profile-card profile-card-right" style="margin-top:20px" onsubmit={savePreferences}>
        <h3 class="edit-card-title">Conteúdo Adulto (+18)</h3>
        <p class="edit-card-sub">Configure a visualização e restrição de obras para maiores de 18 anos.</p>

        <label class="field-label">
          <span>Confirmação de maioridade</span>
          <select name="age_status" class="field-input" value={data.profile.age_status || 'UNKNOWN'}>
            <option value="UNKNOWN">Não especificado (perguntar na visita)</option>
            <option value="ADULT">Sim, tenho 18 anos ou mais</option>
            <option value="MINOR">Não, sou menor de 18 anos (bloquear obras +18)</option>
          </select>
        </label>

        <label class="field-label" style="flex-direction:row;align-items:center;gap:12px;margin-top:16px;cursor:pointer">
          <input
            type="checkbox"
            name="blur_nsfw"
            checked={data.profile.blur_nsfw}
            disabled={data.profile.age_status === 'MINOR'}
            style="width:18px;height:18px;accent-color:var(--purple,#a78bfa)"
          />
          <div>
            <span style="font-weight:600;display:block">Borrar capas de obras adultas (+18)</span>
            <small class="field-hint" style="margin-top:2px;display:block">
              {data.profile.age_status === 'MINOR' ? 'Obrigatório para menores de 18 anos.' : 'Oculta as ilustrações com desfoque estético suave.'}
            </small>
          </div>
        </label>

        <div class="form-actions">
          <button class="save-profile-btn" disabled={busy}>
            <Check size={16} />
            <span>Salvar preferências</span>
          </button>
        </div>
      </form>

      <!-- Mihon Integration Token -->
      <div class="profile-card profile-card-right" style="margin-top:20px">
        <h3 class="edit-card-title">Integração Mihon (Leitura Externa)</h3>
        <p class="edit-card-sub">
          Gere um token de acesso para sincronizar seu progresso, catálogo e XP diretamente pelo app Mihon no Android.
        </p>

        {#if generatedMihonToken}
          <div class="mihon-token-box">
            <span class="mihon-token-warning">⚠️ Copie este token agora. Por segurança, ele não será exibido novamente:</span>
            <div class="mihon-token-input-wrap">
              <input type="text" readonly value={generatedMihonToken} class="field-input monospace-input" />
              <button
                type="button"
                class="copy-btn"
                onclick={() => {
                  navigator.clipboard.writeText(generatedMihonToken);
                  copiedToken = true;
                  setTimeout(() => (copiedToken = false), 3000);
                }}
              >
                {copiedToken ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        {/if}

        <div class="form-actions" style="margin-top:16px">
          <button
            type="button"
            class="save-profile-btn"
            disabled={busyMihon}
            onclick={createMihonToken}
          >
            <Smartphone size={16} />
            <span>{generatedMihonToken ? 'Gerar Novo Token' : 'Gerar Token Mihon'}</span>
          </button>
        </div>
      </div>
    </div>
  {:else if data.area === 'notificacoes'}
    <div class="chips" style="margin-bottom:24px">
      <a class="chip" aria-current={!data.filter ? 'page' : undefined} href="/notificacoes">Todas</a>
      <a class="chip" aria-current={data.filter ? 'page' : undefined} href="/notificacoes?filtro=nao-lidas">
        Não lidas{data.unread ? ` (${data.unread})` : ''}
      </a>
    </div>
    {#if data.notifications.length}
      <div class="notif-header-row">
        <p class="small">{data.total} {data.total === 1 ? 'notificação' : 'notificações'}</p>
        <button class="button secondary compact" onclick={read} disabled={busy || !data.unread}>
          {busy ? 'Marcando…' : 'Marcar todas como lidas'}
        </button>
      </div>
      <div class="stack">
        {#each data.notifications as item (item.id)}
          <a
            class="panel"
            style="border-color:{item.read_at ? 'rgba(255,255,255,0.06)' : 'rgba(181,154,245,0.4)'};display:flex;align-items:flex-start;gap:16px;text-decoration:none"
            href={item.href}
          >
            <div style="color:{item.read_at ? 'var(--muted)' : 'var(--gold)'};margin-top:2px;flex-shrink:0">
              {#if item.kind === 'chapter'}
                <BookOpen size={20} />
              {:else if item.kind === 'reply'}
                <MessageSquare size={20} />
              {:else if item.kind === 'achievement'}
                <Trophy size={20} />
              {:else if item.kind === 'editorial'}
                <Shield size={20} />
              {:else}
                <Bell size={20} />
              {/if}
            </div>
            <div style="flex:1">
              <span class="eyebrow">{date(item.created_at)}</span>
              <p style="color:#ddd7e5;margin-bottom:0">{item.body}</p>
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <Empty
        title="Tudo em dia por aqui."
        text="Novos capítulos das obras acompanhadas, respostas e conquistas aparecerão aqui."
        href={data.filter ? '/notificacoes' : undefined}
        label={data.filter ? 'Ver todas as notificações' : undefined}
      />
    {/if}
  {:else if data.area === 'historico'}
    {#if data.history.length}
      <div class="row between" style="margin-bottom:16px">
        <p class="small muted" style="margin:0">
          {data.total}
          {data.total === 1 ? 'capítulo no histórico' : 'capítulos no histórico'}
        </p>
        <button class="button secondary compact" onclick={clearHistory} disabled={busy}>
          Limpar histórico
        </button>
      </div>
      <div class="continue-grid">
        {#each data.history as item (item.chapter_id)}
          {#if item.chapters}
            <a class="continue-card" href="/ler/{item.chapter_id}">
              <div>
                <strong>{item.chapters.works?.title || 'Obra indisponível'}</strong>
                <p>
                  Capítulo {item.chapters.number} · Página {item.page}
                  {item.completed_at ? '· Concluído' : ''}
                </p>
                <p>{date(item.updated_at)}</p>
              </div>
              <span style="margin-left:auto">→</span>
            </a>
          {/if}
        {/each}
      </div>
    {:else}
      <Empty
        title="Sua jornada começa com uma página."
        text="Ao abrir um capítulo, seu progresso fica salvo aqui."
        href="/catalogo"
        label="Explorar histórias"
      />
    {/if}
  {:else}
    {#if data.area === 'biblioteca'}
      <div class="chips" style="margin-bottom:28px">
        {#each [['', 'Todas'], ['READING', 'Lendo'], ['PLANNED', 'Quero ler'], ['COMPLETED', 'Concluído']] as [value, label] (value)}
          <a
            class="chip"
            aria-current={data.tab === value ? 'page' : undefined}
            style="opacity:{data.tab === value ? 1 : 0.6}"
            href="/biblioteca?status={value}"
          >{label}</a>
        {/each}
      </div>
    {/if}
    {#if data.library.length}
      <p class="small muted">
        {data.total}
        {data.total === 1 ? 'obra' : 'obras'}{data.tab ? ` · ${statusLabels[data.tab]}` : ''}
      </p>
      <div class="work-grid">
        {#each data.library as item (item.work_id)}
          {#if item.works}
            <div>
              <WorkCard work={item.works} />
              <p class="small muted" style="margin-top:10px">
                {statusLabels[item.status]}{item.favorite ? ' · Favorito' : ''}
              </p>
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <Empty
        title={data.tab
          ? 'Nenhuma obra nesta lista.'
          : data.area === 'favoritos'
            ? 'Guarde as histórias que marcaram você.'
            : 'Uma biblioteca com a sua cara.'}
        text={data.tab
          ? 'Veja as outras listas ou organize uma obra pela página dela.'
          : 'Abra uma obra e adicione à sua biblioteca para acompanhar a leitura.'}
        href={data.tab ? '/biblioteca' : '/catalogo'}
        label={data.tab ? 'Ver toda a biblioteca' : 'Explorar o catálogo'}
      />
    {/if}
  {/if}

  {#if data.area !== 'perfil'}
    <Pagination
      page={data.page}
      total={data.total}
      pageSize={data.pageSize}
      href={pageHref}
    />
  {/if}
</div>

<style>
  .badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #c9aa73;
    margin-bottom: 8px;
  }

  .page-title {
    font-size: clamp(32px, 4vw, 44px);
    font-weight: 800;
    margin: 0 0 28px;
    color: #ffffff;
  }

  /* Member Tabs Bar */
  .member-tabs-bar {
    margin-bottom: 32px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    position: relative;
  }

  .member-tabs-scroll {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 12px;
  }

  .member-tabs-scroll::-webkit-scrollbar {
    display: none;
  }

  .member-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    color: #9d99ab;
    text-decoration: none;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .member-tab-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .member-tab-btn.active {
    color: #ffffff;
    background: rgba(181, 154, 245, 0.15);
    border-color: rgba(181, 154, 245, 0.45);
    box-shadow: 0 0 16px -2px rgba(181, 154, 245, 0.25);
  }

  .tab-unread-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #c9aa73;
    color: #0d0f18;
    font-size: 10px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 999px;
    line-height: 1;
  }

  /* Notice Banner */
  .member-notice-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 24px;
    background: rgba(181, 154, 245, 0.1);
    border: 1px solid rgba(181, 154, 245, 0.3);
    color: #ffffff;
  }

  .member-notice-banner.is-success {
    background: rgba(46, 204, 113, 0.12);
    border-color: rgba(46, 204, 113, 0.4);
    color: #2ecc71;
  }

  .member-notice-banner.is-error {
    background: rgba(231, 76, 60, 0.12);
    border-color: rgba(231, 76, 60, 0.4);
    color: #e74c3c;
  }

  /* Profile Grid */
  .profile-layout-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
    align-items: start;
  }

  .profile-card {
    border-radius: 20px;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
    padding: 32px 28px;
  }

  /* Left Column */
  .profile-card-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .profile-avatar-interactive {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 18px;
  }

  .avatar-frame {
    position: relative;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    overflow: hidden;
    border: 2.5px solid #b59af5;
    background: #1a1d33;
    display: grid;
    place-items: center;
    box-shadow: 0 0 24px rgba(181, 154, 245, 0.3);
  }

  .avatar-large-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-large-fallback {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: #1a1d33;
    color: #b59af5;
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    user-select: none;
  }

  .avatar-upload-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: #ffffff;
    background: rgba(181, 154, 245, 0.15);
    border: 1px solid rgba(181, 154, 245, 0.35);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .avatar-upload-badge:hover {
    background: rgba(181, 154, 245, 0.28);
    border-color: rgba(181, 154, 245, 0.6);
  }

  .hidden-file-input {
    display: none;
  }

  .profile-hero-meta {
    margin-bottom: 24px;
  }

  .profile-title-chip-row {
    margin-bottom: 6px;
  }

  .honorific-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #c9aa73;
    padding: 3px 12px;
    border-radius: 999px;
    background: rgba(201, 170, 115, 0.12);
    border: 1px solid rgba(201, 170, 115, 0.3);
  }

  .profile-user-display {
    font-size: 24px;
    font-weight: 800;
    color: #ffffff;
    margin: 4px 0 2px;
  }

  .profile-user-sub {
    font-size: 12px;
    color: #8c899a;
    margin: 0 0 10px;
  }

  .public-profile-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #b59af5;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .public-profile-link:hover {
    color: #d9b5ed;
  }

  /* Stats Grid */
  .profile-stats-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    width: 100%;
    margin-bottom: 24px;
  }

  .profile-stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 4px;
    border-radius: 12px;
    background: rgba(18, 22, 36, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .stat-number {
    font-size: 17px;
    font-weight: 800;
    color: #ffffff;
  }

  .stat-number.highlight-purple { color: #b59af5; }
  .stat-number.highlight-gold { color: #c9aa73; }

  .stat-name {
    font-size: 10px;
    color: #7b788a;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 2px;
  }

  /* XP Progress */
  .profile-xp-section {
    width: 100%;
    margin-bottom: 24px;
  }

  .xp-bar-header {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #9d99ab;
    margin-bottom: 6px;
  }

  .xp-bar-percent {
    font-weight: 700;
    color: #c9aa73;
  }

  .profile-xp-track {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
    margin-bottom: 6px;
  }

  .profile-xp-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #c9aa73);
    border-radius: 999px;
    box-shadow: 0 0 10px rgba(181, 154, 245, 0.5);
    transition: width 0.4s ease;
  }

  .profile-xp-caption {
    font-size: 11px;
    color: #7b788a;
    margin: 0;
  }

  .profile-xp-caption strong {
    color: #c9aa73;
  }

  /* Badges */
  .profile-badges-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 24px;
  }

  .badge-tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #d1cde0;
  }

  .badge-tag-pill.gold {
    color: #c9aa73;
    border-color: rgba(201, 170, 115, 0.3);
    background: rgba(201, 170, 115, 0.08);
  }

  .profile-badge-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-size: 13px;
    line-height: 1;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    vertical-align: middle;
    margin-right: 6px;
  }

  /* Collections Showcase */
  .profile-collection-card {
    width: 100%;
    border-radius: 14px;
    background: rgba(14, 17, 27, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 14px;
    text-align: left;
    margin-bottom: 8px;
  }

  .collection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .collection-title {
    font-size: 13px;
    font-weight: 750;
    color: #ffffff;
    margin: 0;
  }

  .collection-sub {
    font-size: 11px;
    color: #7b788a;
  }

  .badges-scroll-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    max-height: 260px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .badge-tile {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.2s ease;
  }

  .badge-tile.equipped {
    background: rgba(223, 194, 141, 0.06);
    border-color: rgba(223, 194, 141, 0.35);
  }

  .badge-tile.locked {
    opacity: 0.55;
    filter: grayscale(0.6);
  }

  .badge-tile-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: rgba(181, 154, 245, 0.1);
    border: 1px solid rgba(181, 154, 245, 0.25);
    color: #dfc28d;
    font-size: 16px;
    flex-shrink: 0;
  }

  .badge-tile-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .badge-tile-header {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
  }

  .badge-tile-name {
    font-size: 12px;
    font-weight: 700;
    color: #ffffff;
  }

  .badge-tile-tier {
    font-size: 9px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    color: #b59af5;
  }

  .badge-tile-desc {
    font-size: 11px;
    color: #8c899a;
    line-height: 1.35;
    margin: 2px 0 6px;
  }

  .badge-tile-action {
    display: flex;
    align-items: center;
  }

  .badge-state-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
  }

  .badge-state-pill.active {
    background: rgba(223, 194, 141, 0.2);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.4);
  }

  .badge-state-pill.locked {
    background: rgba(255, 255, 255, 0.05);
    color: #7b788a;
  }

  .btn-tile-equip,
  .btn-title-equip {
    background: rgba(181, 154, 245, 0.15);
    border: 1px solid rgba(181, 154, 245, 0.4);
    color: #ffffff;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-tile-equip:hover,
  .btn-title-equip:hover {
    background: rgba(181, 154, 245, 0.35);
    border-color: rgba(181, 154, 245, 0.7);
  }

  .titles-scroll-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 240px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .title-row-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    gap: 8px;
  }

  .title-row-item.equipped {
    background: rgba(223, 194, 141, 0.06);
    border-color: rgba(223, 194, 141, 0.35);
  }

  .title-row-item.locked {
    opacity: 0.55;
  }

  .title-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
  }

  .title-name {
    font-size: 12px;
    color: #ffffff;
    font-weight: 700;
  }

  .title-desc {
    font-size: 10.5px;
    color: #7b788a;
  }

  .title-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
  }

  .title-pill.active {
    background: rgba(223, 194, 141, 0.2);
    color: #dfc28d;
    border: 1px solid rgba(223, 194, 141, 0.4);
  }

  .title-pill.locked {
    background: rgba(255, 255, 255, 0.05);
    color: #7b788a;
  }

  .logout-form {
    margin-top: 8px;
  }

  .logout-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #8c899a;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .logout-btn:hover {
    color: #e74c3c;
    border-color: rgba(231, 76, 60, 0.35);
    background: rgba(231, 76, 60, 0.05);
  }

  /* Right Column (Edit form) */
  .profile-card-right {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .edit-card-title {
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 2px;
  }

  .edit-card-sub {
    font-size: 13px;
    color: #8c899a;
    margin: 0 0 8px;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #d1cde0;
  }

  .field-input,
  .field-textarea {
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(8, 10, 18, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    font-size: 14px;
    font-family: inherit;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    box-sizing: border-box;
  }

  .field-input:focus,
  .field-textarea:focus {
    outline: none;
    border-color: #b59af5;
    box-shadow: 0 0 10px rgba(181, 154, 245, 0.25);
  }

  .username-input-wrap {
    display: flex;
    align-items: center;
    border-radius: 10px;
    background: rgba(8, 10, 18, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .username-input-wrap .prefix {
    padding: 10px 0 10px 14px;
    color: #7b788a;
    font-weight: 600;
  }

  .username-field {
    border: none !important;
    background: transparent !important;
    padding-left: 4px !important;
    box-shadow: none !important;
  }

  .field-hint {
    font-size: 11px;
    color: #7b788a;
    font-weight: 400;
  }

  .field-textarea {
    resize: vertical;
    min-height: 90px;
  }

  .form-actions {
    margin-top: 8px;
  }

  .save-profile-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    border: 1px solid rgba(181, 154, 245, 0.4);
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
    transition: all 0.2s ease;
  }

  .save-profile-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(124, 58, 237, 0.45);
  }

  .save-profile-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .mihon-token-box {
    margin-top: 14px;
    padding: 14px;
    border-radius: 12px;
    background: rgba(181, 154, 245, 0.06);
    border: 1px solid rgba(181, 154, 245, 0.25);
  }

  .mihon-token-warning {
    display: block;
    font-size: 12px;
    font-weight: 650;
    color: #fbbf24;
    margin-bottom: 8px;
  }

  .mihon-token-input-wrap {
    display: flex;
    gap: 8px;
  }

  .copy-btn {
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(181, 154, 245, 0.2);
    border: 1px solid rgba(181, 154, 245, 0.4);
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .copy-btn:hover {
    background: rgba(181, 154, 245, 0.35);
  }

  @media (max-width: 820px) {
    .profile-layout-grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .profile-stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .notif-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  @media (max-width: 480px) {
    .notif-header-row {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }

    .notif-header-row :global(.button) {
      width: 100%;
      text-align: center;
      justify-content: center;
    }
  }
</style>
