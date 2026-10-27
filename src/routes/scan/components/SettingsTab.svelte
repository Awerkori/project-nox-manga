<script lang="ts">
  import {
    ShieldAlert,
    Flame,
    Globe,
    Webhook,
    Download,
    LogOut,
    AlertTriangle,
    Plus,
    Trash2,
    Image,
    Upload,
    Palette,
    Check,
    X,
    CheckCircle2,
    Crop
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

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

  let pauseUploads = $state(!!currentScan?.pause_uploads);
  let pauseRecruitment = $state(!!currentScan?.pause_recruitment);
  let emergencyMode = $state(!!currentScan?.emergency_mode);
  let emergencyReason = $state(currentScan?.emergency_reason || '');

  // Branding & Profile state
  let scanName = $state(currentScan?.name || '');
  let scanDescription = $state(currentScan?.description || '');
  let scanBio = $state(currentScan?.bio || '');
  let scanWebsite = $state(currentScan?.website || '');
  let scanDiscord = $state(currentScan?.discord || '');
  let scanFluxer = $state(currentScan?.fluxer || '');
  let scanDisplayPrep = $state(currentScan?.display_preposition || 'de');
  let logoId = $state(currentScan?.logo_id || '');
  let bannerId = $state(currentScan?.banner_id || '');
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
  let bannerCropX = $state(50);
  let bannerCropY = $state(50);
  let bannerCropZoom = $state(1);
  let bannerViewMode = $state<'cover' | 'contain'>('cover');
  let bannerCropMode = $state<'preserve_original' | 'custom_crop'>('preserve_original');

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
      const uploadedLogoId = data.id;

      // Persist directly in DB
      const form = new FormData();
      form.append('scan_id', currentScan.id);
      form.append('logo_id', uploadedLogoId);
      form.append('banner_id', bannerId || '');
      form.append('name', scanName);
      form.append('description', scanDescription);
      form.append('bio', scanBio);
      form.append('website', scanWebsite);
      form.append('discord', scanDiscord);
      form.append('fluxer', scanFluxer);
      form.append('display_preposition', scanDisplayPrep);
      const persist = await fetch('?/updateScanBranding', { method: 'POST', body: form });
      const persistBody = await persist.json().catch(() => null);
      if (!persist.ok || persistBody?.type === 'failure' || persistBody?.data?.message) {
        throw new Error(persistBody?.data?.message || 'Não foi possível confirmar o logo no banco.');
      }

      cancelLogoPreview();
      logoId = uploadedLogoId;
      await invalidateAll();
      logoSuccess = 'Logo atualizado e salvo com sucesso!';
      setTimeout(() => (logoSuccess = ''), 4000);
    } catch (err: any) {
      logoError = err.message || 'Erro ao salvar logo';
    } finally {
      isSavingLogo = false;
    }
  }

  async function generateCroppedBannerBlob(file: File, x: number, y: number, zoom: number): Promise<Blob> {
    if (file.type === 'image/gif') return file;
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const targetWidth = 1600;
        const targetHeight = 500;
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        const targetRatio = targetWidth / targetHeight; // 3.2
        const imgRatio = img.width / img.height;

        let sWidth: number;
        let sHeight: number;

        if (imgRatio > targetRatio) {
          sHeight = img.height / zoom;
          sWidth = sHeight * targetRatio;
        } else {
          sWidth = img.width / zoom;
          sHeight = sWidth / targetRatio;
        }

        const maxSX = Math.max(0, img.width - sWidth);
        const maxSY = Math.max(0, img.height - sHeight);

        const sX = maxSX * (x / 100);
        const sY = maxSY * (y / 100);

        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sX, sY, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(file);
          },
          file.type === 'image/png' ? 'image/png' : 'image/webp',
          0.95
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
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
    bannerCropX = 50;
    bannerCropY = 50;
    bannerCropZoom = 1;
    bannerViewMode = 'cover';
    bannerCropMode = 'preserve_original';
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
    bannerCropX = 50;
    bannerCropY = 50;
    bannerCropZoom = 1;
    bannerViewMode = 'cover';
    bannerCropMode = 'preserve_original';
  }

  async function confirmSaveBanner() {
    if (!pendingBannerFile) return;
    bannerError = '';
    isSavingBanner = true;
    try {
      const uploadPayload = (bannerCropMode === 'custom_crop') && pendingBannerFile.type !== 'image/gif'
        ? await generateCroppedBannerBlob(pendingBannerFile, bannerCropX, bannerCropY, bannerCropZoom)
        : pendingBannerFile;

      const res = await fetch(`/api/upload?purpose=scan_banner&scan_id=${currentScan.id}`, {
        method: 'POST',
        body: uploadPayload,
        headers: {
          'x-scan-id': currentScan.id,
          'x-media-purpose': 'scan_banner'
        }
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Falha no envio do banner');
      }
      const uploadedBannerId = data.id;

      // Persist directly in DB
      const form = new FormData();
      form.append('scan_id', currentScan.id);
      form.append('logo_id', logoId || '');
      form.append('banner_id', uploadedBannerId);
      form.append('name', scanName);
      form.append('description', scanDescription);
      form.append('bio', scanBio);
      form.append('website', scanWebsite);
      form.append('discord', scanDiscord);
      form.append('fluxer', scanFluxer);
      form.append('display_preposition', scanDisplayPrep);
      const persist = await fetch('?/updateScanBranding', { method: 'POST', body: form });
      const persistBody = await persist.json().catch(() => null);
      if (!persist.ok || persistBody?.type === 'failure' || persistBody?.data?.message) {
        throw new Error(persistBody?.data?.message || 'Não foi possível confirmar o banner no banco.');
      }

      cancelBannerPreview();
      bannerId = uploadedBannerId;
      await invalidateAll();
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
          created_at: currentScan.created_at
        },
        team: team.map((m: any) => ({
          username: m.username,
          display_name: m.display_name,
          role: m.role,
          created_at: m.created_at
        })),
        works: works.map((w: any) => ({
          title: w.title,
          slug: w.slug,
          status: w.project_status,
          views_total: w.views_total
        })),
        chapters: chapters.map((c: any) => ({
          work_title: c.works?.title,
          number: c.number,
          title: c.title,
          published_at: c.published_at,
          views: c.views_total
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
        ['SCAN', currentScan.slug, currentScan.name, currentScan.website || '', currentScan.created_at],
        ...team.map((m: any) => ['MEMBRO', m.username, m.display_name || '', m.role, m.created_at]),
        ...works.map((w: any) => ['OBRA', w.slug, w.title, w.project_status, '']),
        ...chapters.map((c: any) => ['CAPITULO', `${c.works?.title} #${c.number}`, c.title || '', `${c.views_total} views`, c.published_at || ''])
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

        <div class="branding-media-layout">
          <!-- Logo Card: Compacto e não toma a largura do banner -->
          <div class="media-upload-card logo-upload-card">
            <div class="media-card-title-row">
              <span class="media-card-title">Logo da Scan</span>
              <span class="media-type-pill">GIF / PNG / WEBP · ATÉ 5MB</span>
            </div>
            
            <div class="logo-card-body">
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

              <div class="logo-actions-col">
                <p class="media-card-hint">
                  Exibido na vitrine, perfil público e cabeçalhos oficiais. Preserva transparência e animação GIF.
                </p>

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
                      <span>{logoId ? 'Alterar Logo' : 'Enviar Logo'}</span>
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
            </div>
          </div>

          <!-- Banner Card com Área Ampla, Preview Grande e Enquadrador -->
          <div class="media-upload-card banner-media-card banner-master-card">
            <div class="media-card-title-row banner-card-head">
              <div class="banner-title-group">
                <span class="media-card-title">Banner Panorâmico da Scan</span>
                <span class="media-type-pill">GIF / JPG / WEBP · ÁREA AMPLA</span>
              </div>

              <!-- Alternador de Visão de Pré-visualização -->
              <div class="banner-view-toggle">
                <button
                  type="button"
                  class="view-toggle-btn"
                  class:is-active={bannerViewMode === 'cover'}
                  onclick={() => (bannerViewMode = 'cover')}
                  title="Visualizar enquadramento panorâmico widescreen"
                >
                  Enquadramento Widescreen
                </button>
                <button
                  type="button"
                  class="view-toggle-btn"
                  class:is-active={bannerViewMode === 'contain'}
                  onclick={() => (bannerViewMode = 'contain')}
                  title="Visualizar a imagem inteira sem nenhum corte"
                >
                  Ver Arte Completa
                </button>
              </div>
            </div>

            <p class="media-card-hint">
              Exibido no topo do perfil público e na vitrine de scans. Suba imagens em alta resolução até 10MB.
            </p>

            <!-- Grande Palco de Pré-visualização do Banner (280px altura desktop, 180px mobile) -->
            <div class="banner-preview-box large-stage" class:is-contain-mode={bannerViewMode === 'contain'}>
              {#if pendingBannerPreviewUrl}
                <div class="banner-crop-viewport">
                  <img
                    src={pendingBannerPreviewUrl}
                    alt="Prévia do novo banner"
                    class="banner-preview-img is-pending-preview"
                    class:img-contain={bannerViewMode === 'contain'}
                    style={bannerViewMode === 'cover' ? `object-position: ${bannerCropX}% ${bannerCropY}%; transform: scale(${bannerCropZoom}); transform-origin: center center;` : ''}
                  />
                  {#if bannerViewMode === 'cover'}
                    <div class="crop-guides-overlay">
                      <span class="aspect-pill">ENQUADRAMENTO PANORÂMICO</span>
                    </div>
                  {/if}
                </div>
                <span class="preview-badge-pill">PRÉVIA EM EDIÇÃO</span>
              {:else if bannerId}
                <img
                  src="/media/{bannerId}"
                  alt="Banner da {currentScan?.name}"
                  class="banner-preview-img"
                  class:img-contain={bannerViewMode === 'contain'}
                />
              {:else}
                <div class="banner-placeholder">
                  <Image size={44} />
                  <span>Nenhum banner personalizado configurado</span>
                </div>
              {/if}
            </div>

            <!-- Controles e Modo de Envio (Quando há arquivo staged) -->
            {#if pendingBannerFile}
              <div class="banner-edit-dashboard">
                <div class="banner-mode-selector">
                  <span class="mode-select-label">Modo de Processamento do Banner:</span>
                  <div class="mode-pills-row">
                    <button
                      type="button"
                      class="mode-pill-btn"
                      class:is-selected={bannerCropMode === 'preserve_original'}
                      onclick={() => (bannerCropMode = 'preserve_original')}
                    >
                      <CheckCircle2 size={15} />
                      <span>Preservar Imagem Completa (Sem perda de resolução)</span>
                    </button>
                    <button
                      type="button"
                      class="mode-pill-btn"
                      class:is-selected={bannerCropMode === 'custom_crop'}
                      onclick={() => (bannerCropMode = 'custom_crop')}
                    >
                      <Crop size={15} />
                      <span>Recorte & Enquadramento Manual</span>
                    </button>
                  </div>
                </div>

                {#if bannerCropMode === 'custom_crop'}
                  <div class="banner-crop-controls-card">
                    <div class="crop-controls-top">
                      <span class="crop-controls-title">Ajuste Manual de Enquadramento:</span>
                      <div class="crop-presets-row">
                        <button type="button" class="preset-btn" onclick={() => { bannerCropY = 15; }}>Topo</button>
                        <button type="button" class="preset-btn" onclick={() => { bannerCropY = 50; }}>Centro</button>
                        <button type="button" class="preset-btn" onclick={() => { bannerCropY = 85; }}>Base</button>
                        <button type="button" class="preset-btn" onclick={() => { bannerCropX = 50; bannerCropY = 50; bannerCropZoom = 1; }}>Resetar</button>
                      </div>
                    </div>

                    <div class="crop-sliders-grid">
                      <div class="crop-slider-group">
                        <div class="slider-label-line">
                          <span>Posição Vertical</span>
                          <span class="val-pill">{bannerCropY}%</span>
                        </div>
                        <input type="range" min="0" max="100" step="1" bind:value={bannerCropY} class="range-slider" />
                      </div>

                      <div class="crop-slider-group">
                        <div class="slider-label-line">
                          <span>Posição Horizontal</span>
                          <span class="val-pill">{bannerCropX}%</span>
                        </div>
                        <input type="range" min="0" max="100" step="1" bind:value={bannerCropX} class="range-slider" />
                      </div>

                      <div class="crop-slider-group">
                        <div class="slider-label-line">
                          <span>Zoom</span>
                          <span class="val-pill">{bannerCropZoom.toFixed(2)}x</span>
                        </div>
                        <input type="range" min="1" max="2.5" step="0.05" bind:value={bannerCropZoom} class="range-slider" />
                      </div>
                    </div>
                  </div>
                {:else}
                  <div class="preserve-original-note">
                    <span>✓ O arquivo original será preservado em alta resolução sem nenhum corte permanente. A centralização responsiva automática será utilizada na exibição pública.</span>
                  </div>
                {/if}
              </div>
            {/if}

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
                  <span>{bannerId ? 'Alterar Banner (GIF/PNG/JPG)' : 'Enviar Banner (GIF/PNG/JPG)'}</span>
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
          <span class="slug-prefix">manga.project-nox-awerkori.workers.dev/scans/</span>
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
          {#each integrations as webhook (webhook.id)}
            <div class="webhook-item">
              <div class="wh-meta">
                <span class="wh-platform {webhook.platform.toLowerCase()}">{webhook.platform}</span>
                <span class="wh-name">{webhook.name}</span>
                <span class="wh-url">{webhook.webhook_url.substring(0, 32)}...</span>
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

  /* Branding Media Layout: Logo compacto + Banner Master Card de Largura Total */
  .branding-media-layout {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
  }

  .media-upload-card {
    background: rgba(15, 23, 42, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  /* 1. Logo Card: Compacto e Objetivo */
  .logo-upload-card {
    max-width: 620px;
  }

  .logo-card-body {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .logo-actions-col {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  /* 2. Banner Master Card: Área Ampla (100% largura), Preview Grande e Enquadrador */
  .banner-master-card {
    width: 100%;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 1.15rem;
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4);
    padding: 1.5rem;
  }

  .banner-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .banner-title-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .banner-view-toggle {
    display: inline-flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0.2rem;
    gap: 0.25rem;
  }

  .view-toggle-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0.35rem 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-toggle-btn:hover {
    color: #ffffff;
  }

  .view-toggle-btn.is-active {
    background: rgba(168, 85, 247, 0.3);
    color: #f3e8ff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }

  .media-card-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f1f5f9;
  }

  .media-card-hint {
    font-size: 0.78rem;
    color: #94a3b8;
    margin: 0;
  }

  .logo-preview-box {
    width: 96px;
    height: 96px;
    border-radius: 1rem;
    background: rgba(0, 0, 0, 0.5);
    border: 1px dashed rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    position: relative;
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
    gap: 0.4rem;
    color: #64748b;
    font-size: 0.75rem;
    text-align: center;
  }

  /* Palco de Pré-visualização do Banner - Amplo, Alto e Confortável */
  .banner-preview-box.large-stage {
    width: 100%;
    height: 290px;
    border-radius: 1rem;
    background: #060810;
    border: 1px dashed rgba(255, 255, 255, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin: 0.35rem 0;
    position: relative;
    box-shadow: inset 0 2px 14px rgba(0, 0, 0, 0.7);
  }

  .banner-preview-box.large-stage.is-contain-mode {
    background: #000000;
  }

  .banner-crop-viewport {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  .banner-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.1s ease, object-position 0.1s ease;
  }

  .banner-preview-img.img-contain {
    object-fit: contain !important;
    transform: none !important;
  }

  .crop-guides-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border: 1px dashed rgba(168, 85, 247, 0.45);
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 0.65rem;
  }

  /* Painel de Configuração e Modo de Envio */
  .banner-edit-dashboard {
    background: rgba(10, 14, 26, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .banner-mode-selector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .mode-select-label {
    font-size: 0.78rem;
    font-weight: 700;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .mode-pills-row {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .mode-pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 0.5rem 0.95rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-pill-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .mode-pill-btn.is-selected {
    background: rgba(16, 185, 129, 0.16);
    border-color: rgba(16, 185, 129, 0.5);
    color: #34d399;
  }

  .preserve-original-note {
    font-size: 0.82rem;
    color: #a7f3d0;
    margin: 0;
    padding: 0.6rem 0.85rem;
    background: rgba(16, 185, 129, 0.08);
    border-radius: 8px;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .aspect-pill {
    background: rgba(0, 0, 0, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    padding: 0.15rem 0.45rem;
    font-size: 0.65rem;
    font-weight: 800;
    color: #c4b5fd;
    backdrop-filter: blur(6px);
  }

  /* Banner Crop Controls */
  .banner-crop-controls-card {
    background: rgba(13, 17, 30, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1rem;
    margin: 0.75rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .crop-controls-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .crop-controls-title {
    font-size: 0.78rem;
    font-weight: 800;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .crop-presets-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .preset-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 0.2rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #ffffff;
  }

  .crop-sliders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.85rem;
  }

  .crop-slider-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .slider-label-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.72rem;
    font-weight: 700;
    color: #94a3b8;
  }

  .val-pill {
    color: #a78bfa;
    font-family: monospace;
  }

  .range-slider {
    width: 100%;
    accent-color: #8b5cf6;
    cursor: pointer;
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
