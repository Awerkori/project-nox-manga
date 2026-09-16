<script lang="ts">
  import {
    ShieldAlert,
    PauseCircle,
    UserX,
    Flame,
    Globe,
    Webhook,
    Download,
    LogOut,
    AlertTriangle,
    CheckCircle2,
    Plus,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Image,
    Upload,
    Palette,
    Sparkles,
    Check,
    X
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';

  let {
    currentScan,
    integrations = [],
    team = [],
    works = [],
    chapters = [],
    currentUserId = '',
    userRole = 'MEMBER',
    isOwner = false,
    isOwnerOrAdmin = false
  } = $props();

  let pauseUploads = $state(!!currentScan?.pauseUploads);
  let pauseRecruitment = $state(!!currentScan?.pauseRecruitment);
  let emergencyMode = $state(!!currentScan?.emergencyMode);
  let emergencyReason = $state(currentScan?.emergencyReason || '');

  // Branding & Profile state
  let scanName = $state(currentScan?.name || '');
  let scanDescription = $state(currentScan?.description || '');
  let scanBio = $state(currentScan?.bio || '');
  let scanWebsite = $state(currentScan?.website || '');
  let scanDiscord = $state(currentScan?.discord || '');
  let scanFluxer = $state(currentScan?.fluxer || '');
  let scanDisplayPrep = $state(currentScan?.displayPreposition || 'de');
  let logoId = $state(currentScan?.logoId || '');
  let bannerId = $state(currentScan?.bannerId || '');
  let isUploadingLogo = $state(false);
  let isUploadingBanner = $state(false);
  let logoError = $state('');
  let bannerError = $state('');
  let logoSuccess = $state('');
  let bannerSuccess = $state('');

  // Staged Preview state for Logo & Banner
  let pendingLogoFile = $state<File | null>(null);
  let pendingLogoPreviewUrl = $state<string | null>(null);
  let isSavingLogo = $state(false);

  let pendingBannerFile = $state<File | null>(null);
  let pendingBannerPreviewUrl = $state<string | null>(null);
  let isSavingBanner = $state(false);

  function handleLogoUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      logoError = 'Selecione uma imagem válida (PNG, JPG, WEBP ou GIF animado).';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      logoError = 'A imagem do logo deve ter no máximo 5MB.';
      return;
    }

    logoError = '';
    logoSuccess = '';
    if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
    pendingLogoPreviewUrl = URL.createObjectURL(file);
    pendingLogoFile = file;
    input.value = '';
  }

  function cancelLogoPreview() {
    if (pendingLogoPreviewUrl) {
      URL.revokeObjectURL(pendingLogoPreviewUrl);
      pendingLogoPreviewUrl = null;
    }
    pendingLogoFile = null;
    logoError = '';
  }

  async function confirmSaveLogo() {
    if (!pendingLogoFile) return;
    logoError = '';
    isSavingLogo = true;
    try {
      const res = await fetch(`/api/upload?purpose=scan_logo&scan_id=${currentScan.id}`, {
        method: 'POST',
        body: pendingLogoFile,
        headers: {
          'x-scan-id': currentScan.id,
          'x-media-purpose': 'scan_logo'
        }
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Falha no envio da imagem do logo');
      }
      logoId = data.id;

      // Persist directly in DB
      const form = new FormData();
      form.append('scan_id', currentScan.id);
      form.append('logo_id', data.id);
      form.append('banner_id', bannerId || '');
      form.append('name', scanName);
      form.append('description', scanDescription);
      form.append('bio', scanBio);
      form.append('website', scanWebsite);
      form.append('discord', scanDiscord);
      form.append('fluxer', scanFluxer);
      form.append('display_preposition', scanDisplayPrep);
      await fetch('?/updateScanBranding', { method: 'POST', body: form });

      cancelLogoPreview();
      logoSuccess = 'Logo atualizado e salvo com sucesso!';
      setTimeout(() => (logoSuccess = ''), 4000);
    } catch (err: any) {
      logoError = err.message || 'Erro ao salvar logo';
    } finally {
      isSavingLogo = false;
    }
  }

  function handleBannerUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      bannerError = 'Selecione uma imagem válida (PNG, JPG, WEBP ou GIF animado).';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      bannerError = 'O banner deve ter no máximo 10MB.';
      return;
    }

    bannerError = '';
    bannerSuccess = '';
    if (pendingBannerPreviewUrl) URL.revokeObjectURL(pendingBannerPreviewUrl);
    pendingBannerPreviewUrl = URL.createObjectURL(file);
    pendingBannerFile = file;
    input.value = '';
  }

  function cancelBannerPreview() {
    if (pendingBannerPreviewUrl) {
      URL.revokeObjectURL(pendingBannerPreviewUrl);
      pendingBannerPreviewUrl = null;
    }
    pendingBannerFile = null;
    bannerError = '';
  }

  async function confirmSaveBanner() {
    if (!pendingBannerFile) return;
    bannerError = '';
    isSavingBanner = true;
    try {
      const res = await fetch(`/api/upload?purpose=scan_banner&scan_id=${currentScan.id}`, {
        method: 'POST',
        body: pendingBannerFile,
        headers: {
          'x-scan-id': currentScan.id,
          'x-media-purpose': 'scan_banner'
        }
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Falha no envio do banner');
      }
      bannerId = data.id;

      // Persist directly in DB
      const form = new FormData();
      form.append('scan_id', currentScan.id);
      form.append('logo_id', logoId || '');
      form.append('banner_id', data.id);
      form.append('name', scanName);
      form.append('description', scanDescription);
      form.append('bio', scanBio);
      form.append('website', scanWebsite);
      form.append('discord', scanDiscord);
      form.append('fluxer', scanFluxer);
      form.append('display_preposition', scanDisplayPrep);
      await fetch('?/updateScanBranding', { method: 'POST', body: form });

      cancelBannerPreview();
      bannerSuccess = 'Banner atualizado e salvo com sucesso!';
      setTimeout(() => (bannerSuccess = ''), 4000);
    } catch (err: any) {
      bannerError = err.message || 'Erro ao salvar banner';
    } finally {
      isSavingBanner = false;
    }
  }

  let newSlug = $state(currentScan?.slug || '');
  let showWebhookModal = $state(false);
  let webhookPlatform = $state<'DISCORD' | 'FLUXER'>('DISCORD');
  let webhookName = $state('');
  let webhookUrl = $state('');

  let otherOwnersCount = $derived(
    team.filter((m: any) => m.role === 'OWNER' && m.id !== currentUserId).length
  );

  function exportData(format: 'json' | 'csv') {
    if (format === 'json') {
      const data = {
        scan: {
          id: currentScan.id,
          name: currentScan.name,
          slug: currentScan.slug,
          description: currentScan.description,
          discord: currentScan.discord,
          website: currentScan.website,
          created_at: currentScan.createdAt
        },
        team: team.map((m: any) => ({
          username: m.username,
          display_name: m.displayName,
          role: m.role,
          created_at: m.createdAt
        })),
        works: works.map((w: any) => ({
          title: w.title,
          slug: w.slug,
          status: w.project_status,
          views_total: w.viewsTotal
        })),
        chapters: chapters.map((c: any) => ({
          work_title: c.works?.title,
          number: c.number,
          title: c.title,
          published_at: c.publishedAt,
          views: c.viewsTotal
        }))
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentScan.slug}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV
      const rows = [
        ['Tipo', 'Identificador', 'Nome/Título', 'Info Extra', 'Data'],
        ['SCAN', currentScan.slug, currentScan.name, currentScan.website || '', currentScan.createdAt],
        ...team.map((m: any) => ['MEMBRO', m.username, m.displayName || '', m.role, m.createdAt]),
        ...works.map((w: any) => ['OBRA', w.slug, w.title, w.project_status, '']),
        ...chapters.map((c: any) => ['CAPITULO', `${c.works?.title} #${c.number}`, c.title || '', `${c.viewsTotal} views`, c.publishedAt || ''])
      ];

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const a = document.createElement('a');
      a.href = encodedUri;
      a.download = `${currentScan.slug}-export.csv`;
      a.click();
    }
  }
</script>

<div class="settings-tab">
  <div class="tab-header">
    <div>
      <h2 class="title">Configurações & Modos da Scan</h2>
      <p class="subtitle">Controle de manutenção, integrações e dados de equipe da {currentScan?.name}.</p>
    </div>
  </div>

  <!-- Visual Identity & Branding Section -->
  {#if isOwnerOrAdmin}
    <div class="settings-section">
      <div class="section-title-row">
        <Palette size={20} class="section-icon purple" />
        <div>
          <h3>Identidade Visual & Branding da Scan</h3>
          <p>Personalize o logo, banner e informações públicas da {currentScan?.name}. As imagens são armazenadas de forma dedicada no pool SCAN_MEDIA.</p>
        </div>
      </div>

      <form
        method="POST"
        action="?/updateScanBranding"
        use:enhance
        class="branding-form"
      >
        <input type="hidden" name="scan_id" value={currentScan?.id} />
        <input type="hidden" name="logo_id" value={logoId} />
        <input type="hidden" name="banner_id" value={bannerId} />

        <div class="media-upload-grid">
          <!-- Logo Card -->
          <div class="media-upload-card">
            <div class="media-card-title-row">
              <span class="media-card-title">Logo da Scan</span>
              <span class="media-type-pill">GIF / PNG / WEBP</span>
            </div>
            <p class="media-card-hint">Suporta GIF animado (preserva animação) ou imagem estática até 5MB.</p>
            
            <div class="logo-preview-box">
              {#if pendingLogoPreviewUrl}
                <img src={pendingLogoPreviewUrl} alt="Prévia do novo logo" class="logo-preview-img is-pending-preview" />
                <span class="preview-badge-pill">PRÉVIA</span>
              {:else if logoId}
                <img src="/media/{logoId}" alt="Logo da {currentScan?.name}" class="logo-preview-img" />
              {:else}
                <div class="logo-placeholder">
                  <Image size={32} />
                  <span>Sem logo</span>
                </div>
              {/if}
            </div>

            {#if logoError}
              <span class="upload-err-msg">{logoError}</span>
            {/if}
            {#if logoSuccess}
              <span class="upload-success-msg">{logoSuccess}</span>
            {/if}

            <div class="media-actions-row">
              {#if pendingLogoFile}
                <button
                  type="button"
                  class="btn-save-staged"
                  onclick={confirmSaveLogo}
                  disabled={isSavingLogo}
                  title="Confirmar e salvar novo logo"
                >
                  <Check size={14} />
                  <span>{isSavingLogo ? 'Salvando...' : 'Salvar Logo'}</span>
                </button>
                <button
                  type="button"
                  class="btn-cancel-staged"
                  onclick={cancelLogoPreview}
                  disabled={isSavingLogo}
                  title="Descartar prévia"
                >
                  <X size={14} />
                  <span>Cancelar</span>
                </button>
              {:else}
                <label class="btn-secondary sm cursor-pointer" class:disabled={isSavingLogo}>
                  <Upload size={14} />
                  <span>{logoId ? 'Alterar Logo (GIF/PNG)' : 'Enviar Logo (GIF/PNG)'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    class="hidden-file-input"
                    onchange={handleLogoUpload}
                    disabled={isSavingLogo}
                  />
                </label>

                {#if logoId}
                  <button
                    type="button"
                    class="btn-danger-xs"
                    onclick={() => (logoId = '')}
                    title="Remover logo atual"
                  >
                    <Trash2 size={13} />
                    <span>Remover</span>
                  </button>
                {/if}
              {/if}
            </div>
          </div>

          <!-- Banner Card -->
          <div class="media-upload-card">
            <div class="media-card-title-row">
              <span class="media-card-title">Banner da Scan</span>
              <span class="media-type-pill">GIF / JPG / WEBP</span>
            </div>
            <p class="media-card-hint">Suporta GIF animado panorâmico ou imagem estática até 10MB.</p>

            <div class="banner-preview-box">
              {#if pendingBannerPreviewUrl}
                <img src={pendingBannerPreviewUrl} alt="Prévia do novo banner" class="banner-preview-img is-pending-preview" />
                <span class="preview-badge-pill">PRÉVIA</span>
              {:else if bannerId}
                <img src="/media/{bannerId}" alt="Banner da {currentScan?.name}" class="banner-preview-img" />
              {:else}
                <div class="banner-placeholder">
                  <Image size={36} />
                  <span>Sem banner personalizado</span>
                </div>
              {/if}
            </div>

            {#if bannerError}
              <span class="upload-err-msg">{bannerError}</span>
            {/if}
            {#if bannerSuccess}
              <span class="upload-success-msg">{bannerSuccess}</span>
            {/if}

            <div class="media-actions-row">
              {#if pendingBannerFile}
                <button
                  type="button"
                  class="btn-save-staged"
                  onclick={confirmSaveBanner}
                  disabled={isSavingBanner}
                  title="Confirmar e salvar novo banner"
                >
                  <Check size={14} />
                  <span>{isSavingBanner ? 'Salvando...' : 'Salvar Banner'}</span>
                </button>
                <button
                  type="button"
                  class="btn-cancel-staged"
                  onclick={cancelBannerPreview}
                  disabled={isSavingBanner}
                  title="Descartar prévia"
                >
                  <X size={14} />
                  <span>Cancelar</span>
                </button>
              {:else}
                <label class="btn-secondary sm cursor-pointer" class:disabled={isSavingBanner}>
                  <Upload size={14} />
                  <span>{bannerId ? 'Alterar Banner (GIF/PNG)' : 'Enviar Banner (GIF/PNG)'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    class="hidden-file-input"
                    onchange={handleBannerUpload}
                    disabled={isSavingBanner}
                  />
                </label>

                {#if bannerId}
                  <button
                    type="button"
                    class="btn-danger-xs"
                    onclick={() => (bannerId = '')}
                    title="Remover banner atual"
                  >
                    <Trash2 size={13} />
                    <span>Remover</span>
                  </button>
                {/if}
              {/if}
            </div>
          </div>
        </div>

        <!-- Metadata fields -->
        <div class="form-grid-2">
          <div class="form-group">
            <label for="sc-name" class="form-label">Nome da Scan</label>
            <input id="sc-name" type="text" name="name" bind:value={scanName} class="form-input" required />
          </div>

          <div class="form-group">
            <label for="sc-prep" class="form-label">Preposição de Exibição</label>
            <select id="sc-prep" name="display_preposition" bind:value={scanDisplayPrep} class="form-select">
              <option value="de">de (Ex: Projeto de {scanName || 'Nox'})</option>
              <option value="da">da (Ex: Projeto da {scanName || 'Nox'})</option>
              <option value="do">do (Ex: Projeto do {scanName || 'Nox'})</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="sc-bio" class="form-label">Bio Curta (Slogan / Destaque)</label>
          <input
            id="sc-bio"
            type="text"
            name="bio"
            bind:value={scanBio}
            placeholder="Ex: Traduzindo com amor e velocidade os melhores webtoons."
            class="form-input"
            maxlength={500}
          />
        </div>

        <div class="form-group">
          <label for="sc-desc" class="form-label">Descrição Institucional</label>
          <textarea
            id="sc-desc"
            name="description"
            rows={4}
            bind:value={scanDescription}
            placeholder="Conte a história da sua scan, gêneros favoritos e projetos..."
            class="form-textarea"
            maxlength={2000}
          ></textarea>
        </div>

        <div class="form-grid-3">
          <div class="form-group">
            <label for="sc-web" class="form-label">Website Oficial</label>
            <input id="sc-web" type="url" name="website" bind:value={scanWebsite} placeholder="https://..." class="form-input" />
          </div>

          <div class="form-group">
            <label for="sc-disc" class="form-label">Link do Discord</label>
            <input id="sc-disc" type="url" name="discord" bind:value={scanDiscord} placeholder="https://discord.gg/..." class="form-input" />
          </div>

          <div class="form-group">
            <label for="sc-flux" class="form-label">Canal Fluxer / Outro</label>
            <input id="sc-flux" type="text" name="fluxer" bind:value={scanFluxer} placeholder="@canal..." class="form-input" />
          </div>
        </div>

        <div class="form-btn-row">
          <button type="submit" class="btn-primary" disabled={isUploadingLogo || isUploadingBanner}>
            Salvar Identidade Visual & Perfil
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Maintenance Controls -->
  {#if isOwnerOrAdmin}
    <div class="settings-section">
      <div class="section-title-row">
        <ShieldAlert size={20} class="section-icon warning" />
        <div>
          <h3>Modos de Manutenção & Operação</h3>
          <p>Pause fluxos ou ative modo de emergência quando a scan precisar de um hiato ou contenção.</p>
        </div>
      </div>

      <form
        method="POST"
        action="?/setMaintenance"
        use:enhance
        class="maintenance-form"
      >
        <input type="hidden" name="scan_id" value={currentScan?.id} />

        <div class="toggle-card">
          <div class="toggle-info">
            <span class="toggle-title">Pausar Uploads de Capítulos</span>
            <span class="toggle-desc">Membros da equipe não poderão enviar novos capítulos até reativado.</span>
          </div>
          <label class="switch">
            <input type="checkbox" name="pause_uploads" bind:checked={pauseUploads} />
            <span class="slider"></span>
          </label>
        </div>

        <div class="toggle-card">
          <div class="toggle-info">
            <span class="toggle-title">Pausar Recrutamento & Candidaturas</span>
            <span class="toggle-desc">Oculta formulários de candidatura na página pública da scan.</span>
          </div>
          <label class="switch">
            <input type="checkbox" name="pause_recruitment" bind:checked={pauseRecruitment} />
            <span class="slider"></span>
          </label>
        </div>

        <div class="toggle-card emergency">
          <div class="toggle-info">
            <span class="toggle-title emergency-txt">
              <Flame size={16} /> Modo de Emergência
            </span>
            <span class="toggle-desc">Congela todas as operações da scan imediatamente (uploads, convites e candidaturas).</span>
            {#if emergencyMode}
              <div class="emergency-reason-box">
                <label for="em-reason">Motivo do Modo de Emergência (exibido internamente):</label>
                <input
                  id="em-reason"
                  type="text"
                  name="emergency_reason"
                  bind:value={emergencyReason}
                  placeholder="Ex: Vazamento de raws / Hiato de emergência"
                  class="reason-input"
                />
              </div>
            {/if}
          </div>
          <label class="switch danger">
            <input type="checkbox" name="emergency_mode" bind:checked={emergencyMode} />
            <span class="slider danger"></span>
          </label>
        </div>

        <div class="form-btn-row">
          <button type="submit" class="btn-primary">Salvar Modos de Manutenção</button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Slug History & URL Configuration (Owner or Global Admin only) -->
  {#if isOwner}
    <div class="settings-section">
      <div class="section-title-row">
        <Globe size={20} class="section-icon purple" />
        <div>
          <h3>Identificador & URL da Scan (Slug)</h3>
          <p>Ao alterar o slug, a URL anterior continua funcionando automaticamente com redirecionamento 301.</p>
        </div>
      </div>

      <form
        method="POST"
        action="?/changeSlug"
        use:enhance
        class="slug-form"
        onsubmit={(e) => {
          if (!confirm(`Alterar a URL da scan para /scans/${newSlug}? Links antigos serão preservados via 301.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="scan_id" value={currentScan?.id} />

        <div class="slug-input-wrapper">
          <span class="slug-prefix">projectnox.com/scans/</span>
          <input
            type="text"
            name="new_slug"
            bind:value={newSlug}
            required
            pattern="^[a-z0-9-]+$"
            class="slug-input"
          />
        </div>

        <button type="submit" class="btn-secondary" disabled={newSlug === currentScan?.slug}>
          Atualizar Slug
        </button>
      </form>
    </div>
  {/if}

  <!-- Integrations / Webhooks -->
  {#if isOwner}
    <div class="settings-section">
      <div class="section-title-row">
        <Webhook size={20} class="section-icon blue" />
        <div>
          <h3>Webhooks & Notificações Externas</h3>
          <p>Envie alertas automáticos para seus canais no Discord ou Fluxer sobre novos capítulos e membros.</p>
        </div>
      </div>

      {#if integrations.length === 0}
        <div class="empty-webhooks">
          <p>Nenhum webhook cadastrado.</p>
          <button class="btn-secondary sm" onclick={() => showWebhookModal = true}>
            <Plus size={14} /> Adicionar Webhook
          </button>
        </div>
      {:else}
        <div class="webhooks-list">
          {#each integrations as webhook}
            <div class="webhook-item">
              <div class="wh-meta">
                <span class="wh-platform {webhook.platform.toLowerCase()}">{webhook.platform}</span>
                <span class="wh-name">{webhook.name}</span>
                <span class="wh-url">{webhook.webhookUrl.substring(0, 32)}...</span>
              </div>
              <form method="POST" action="?/deleteIntegration" use:enhance>
                <input type="hidden" name="integration_id" value={webhook.id} />
                <button type="submit" class="btn-icon danger" title="Remover Webhook">
                  <Trash2 size={14} />
                </button>
              </form>
            </div>
          {/each}
          <button class="btn-secondary sm mt" onclick={() => showWebhookModal = true}>
            <Plus size={14} /> Adicionar Novo Webhook
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Data Export -->
  <div class="settings-section">
    <div class="section-title-row">
      <Download size={20} class="section-icon green" />
      <div>
        <h3>Exportação de Dados</h3>
        <p>Baixe um relatório completo de todas as obras, capítulos publicados e equipe da scan.</p>
      </div>
    </div>

    <div class="export-actions">
      <button class="btn-secondary" onclick={() => exportData('json')}>
        <Download size={16} /> Exportar JSON Completo
      </button>
      <button class="btn-secondary" onclick={() => exportData('csv')}>
        <Download size={16} /> Exportar Relatório CSV
      </button>
    </div>
  </div>

  <!-- Danger Zone -->
  <div class="settings-section danger-zone">
    <div class="section-title-row">
      <AlertTriangle size={20} class="section-icon danger" />
      <div>
        <h3 class="danger-txt">Zona de Risco</h3>
        <p>Ações de desligamento de equipe e encerramento de vínculo.</p>
      </div>
    </div>

    <div class="danger-content">
      {#if userRole === 'OWNER' && otherOwnersCount === 0}
        <div class="warning-callout">
          <AlertTriangle size={18} class="callout-icon" />
          <p>
            Você é o <strong>único Dono</strong> da {currentScan?.name}. Por segurança, você deve transferir a liderança da scan para outro membro na aba Equipe antes de poder sair.
          </p>
        </div>
      {:else}
        <div class="leave-row">
          <div>
            <span class="leave-title">Sair da Equipe da Scan</span>
            <p class="leave-desc">Você perderá o acesso a este painel administrativo interno.</p>
          </div>
          <form
            method="POST"
            action="?/leaveScan"
            use:enhance
            onsubmit={(e) => {
              if (!confirm(`Tem certeza que deseja sair da equipe da ${currentScan?.name}?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="scan_id" value={currentScan?.id} />
            <button type="submit" class="btn-danger">
              <LogOut size={16} /> Sair da Scan
            </button>
          </form>
        </div>
      {/if}
    </div>
  </div>

  <!-- Webhook Modal -->
  {#if showWebhookModal}
    <div class="modal-backdrop" onclick={() => showWebhookModal = false} role="presentation">
      <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>Adicionar Webhook de Notificações</h3>
          <button class="btn-close" onclick={() => showWebhookModal = false}>&times;</button>
        </div>

        <form
          method="POST"
          action="?/saveIntegration"
          use:enhance={() => {
            return async ({ update, result }) => {
              await update();
              if (result.type === 'success') showWebhookModal = false;
            };
          }}
          class="modal-form"
        >
          <input type="hidden" name="scan_id" value={currentScan?.id} />

          <div class="form-group">
            <label for="wh-plat">Plataforma *</label>
            <select id="wh-plat" name="platform" bind:value={webhookPlatform} class="input">
              <option value="DISCORD">Discord Webhook</option>
              <option value="FLUXER">Fluxer Webhook</option>
            </select>
          </div>

          <div class="form-group">
            <label for="wh-name">Nome Identificador *</label>
            <input
              id="wh-name"
              type="text"
              name="name"
              bind:value={webhookName}
              placeholder="Ex: Canal #novidades-lançamentos"
              required
              class="input"
            />
          </div>

          <div class="form-group">
            <label for="wh-url">URL do Webhook *</label>
            <input
              id="wh-url"
              type="url"
              name="webhook_url"
              bind:value={webhookUrl}
              placeholder="https://discord.com/api/webhooks/..."
              required
              class="input"
            />
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick={() => showWebhookModal = false}>Cancelar</button>
            <button type="submit" class="btn-primary">Salvar Webhook</button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-tab {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .tab-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .subtitle {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0.25rem 0 0;
  }

  .settings-section {
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .settings-section.danger-zone {
    border-color: rgba(239, 68, 68, 0.2);
    background: rgba(239, 68, 68, 0.03);
  }

  .section-title-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  :global(.section-icon) {
    flex-shrink: 0;
    margin-top: 0.2rem;
  }

  :global(.section-icon.warning) { color: #f59e0b; }
  :global(.section-icon.purple) { color: #a855f7; }
  :global(.section-icon.blue) { color: #38bdf8; }
  :global(.section-icon.green) { color: #10b981; }
  :global(.section-icon.danger) { color: #ef4444; }

  .section-title-row h3 {
    font-size: 1.05rem;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
  }

  .section-title-row p {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0.2rem 0 0;
  }

  .maintenance-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .toggle-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.25);
    padding: 1rem 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
    gap: 1rem;
  }

  .toggle-card.emergency {
    background: rgba(239, 68, 68, 0.06);
    border-color: rgba(239, 68, 68, 0.2);
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1;
  }

  .toggle-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .emergency-txt {
    color: #f87171;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .toggle-desc {
    font-size: 0.8125rem;
    color: #94a3b8;
  }

  .emergency-reason-box {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .emergency-reason-box label {
    font-size: 0.75rem;
    color: #fca5a5;
    font-weight: 500;
  }

  .reason-input {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.375rem;
    padding: 0.5rem 0.75rem;
    color: #fef2f2;
    font-size: 0.8125rem;
  }

  /* Switch Toggle */
  .switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: rgba(255, 255, 255, 0.15);
    transition: 0.2s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: #6366f1;
  }

  input:checked + .slider.danger {
    background-color: #ef4444;
  }

  input:checked + .slider:before {
    transform: translateX(20px);
  }

  .form-btn-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .slug-form {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .slug-input-wrapper {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.5rem;
    padding: 0 0.75rem;
    flex: 1;
    min-width: 280px;
  }

  .slug-prefix {
    font-size: 0.8125rem;
    color: #64748b;
    user-select: none;
  }

  .slug-input {
    flex: 1;
    background: transparent;
    border: none;
    color: #38bdf8;
    font-family: monospace;
    font-size: 0.875rem;
    padding: 0.6rem 0.25rem;
    outline: none;
  }

  .empty-webhooks {
    background: rgba(0, 0, 0, 0.2);
    padding: 1.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
    color: #94a3b8;
  }

  .webhooks-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .webhook-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.25);
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .wh-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .wh-platform {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
  }

  .wh-platform.discord {
    background: rgba(88, 101, 242, 0.2);
    color: #5865F2;
  }

  .wh-platform.fluxer {
    background: rgba(236, 72, 153, 0.2);
    color: #ec4899;
  }

  .wh-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #f1f5f9;
  }

  .wh-url {
    font-size: 0.75rem;
    color: #64748b;
    font-family: monospace;
  }

  .export-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .danger-txt {
    color: #f87171 !important;
  }

  .warning-callout {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    padding: 1rem;
    border-radius: 0.5rem;
    color: #fcd34d;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  :global(.callout-icon) {
    flex-shrink: 0;
    margin-top: 0.15rem;
  }

  .leave-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .leave-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .leave-desc {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0.2rem 0 0;
  }

  .btn-primary {
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 0.5rem;
    padding: 0.55rem 1.1rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    padding: 0.55rem 1.1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-secondary.sm {
    padding: 0.35rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-secondary.mt {
    align-self: flex-start;
    margin-top: 0.5rem;
  }

  .btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.5rem;
    padding: 0.55rem 1.1rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-icon {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    border-radius: 0.375rem;
    padding: 0.35rem;
    cursor: pointer;
  }

  .btn-icon.danger:hover {
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.1);
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 1rem;
  }

  .modal-card {
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1rem;
    width: 100%;
    max-width: 500px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-header h3 {
    font-size: 1.125rem;
    color: #f8fafc;
    margin: 0;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 1.25rem;
    cursor: pointer;
  }

  .modal-form {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-group label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
  }

  .input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.5rem;
    color: #f1f5f9;
    font-size: 0.875rem;
    outline: none;
    box-sizing: border-box;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  /* Branding Styles */
  .branding-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .media-upload-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: 1.25rem;
  }

  .media-upload-card {
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }

  .media-card-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f1f5f9;
  }

  .media-card-hint {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
  }

  .logo-preview-box {
    width: 100px;
    height: 100px;
    border-radius: 0.75rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin: 0.5rem 0;
  }

  .logo-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .logo-placeholder,
  .banner-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    color: #64748b;
    font-size: 0.6875rem;
    text-align: center;
  }

  .banner-preview-box {
    width: 100%;
    height: 110px;
    border-radius: 0.75rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin: 0.5rem 0;
  }

  .banner-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .media-actions-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .cursor-pointer {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .cursor-pointer.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .hidden-file-input {
    display: none;
  }

  .upload-err-msg {
    font-size: 0.75rem;
    color: #f87171;
  }

  .btn-danger-xs {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.65rem;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #f87171;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-danger-xs:hover {
    background: rgba(239, 68, 68, 0.22);
  }

  .form-grid-2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 1rem;
  }

  .form-grid-3 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
    gap: 1rem;
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.5rem;
    padding: 0.6rem 0.75rem;
    color: #f1f5f9;
    font-size: 0.875rem;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.2s;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    border-color: #8b5cf6;
  }

  /* Staged media preview styles & accessibility */
  .media-card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .media-type-pill {
    font-size: 0.6875rem;
    font-weight: 700;
    color: #a78bfa;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.04em;
  }

  .preview-badge-pill {
    position: absolute;
    bottom: 6px;
    right: 6px;
    font-size: 0.625rem;
    font-weight: 800;
    color: #fbbf24;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(245, 158, 11, 0.5);
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .is-pending-preview {
    border: 2px solid #f59e0b;
    border-radius: 0.75rem;
    box-sizing: border-box;
  }

  .logo-preview-box,
  .banner-preview-box {
    position: relative;
  }

  .upload-success-msg {
    font-size: 0.75rem;
    color: #4ade80;
    font-weight: 500;
  }

  .btn-save-staged {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.8rem;
    background: #10b981;
    color: #fff;
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-save-staged:hover {
    background: #059669;
  }

  .btn-cancel-staged {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-cancel-staged:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #f1f5f9;
  }

  @media (prefers-reduced-motion: reduce) {
    .logo-preview-img,
    .banner-preview-img {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
