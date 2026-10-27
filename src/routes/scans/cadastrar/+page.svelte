<script lang="ts">
  import {
    ArrowLeft,
    Briefcase,
    ShieldCheck,
    Star,
    Sparkles,
    Image,
    Upload,
    Crop,
    CheckCircle2,
    Clock,
    AlertTriangle,
    X,
    Eye,
    Edit3,
    ArrowRight,
    Globe,
    Layers,
    BookOpen,
    Users,
    MessageSquare,
    Check,
    Send,
    HelpCircle,
    LayoutDashboard
  } from "@lucide/svelte";
  import { enhance } from "$app/forms";
  import DiscordIcon from "$lib/components/icons/DiscordIcon.svelte";
  import FluxerIcon from "$lib/components/icons/FluxerIcon.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";

  let { data, form } = $props();

  // Mode: Form Editor vs Realistic Live Preview
  let viewMode = $state<"edit" | "preview">("edit");

  // Form Fields
  let scanName = $state("");
  let scanSlug = $state("");
  let slugManual = $state(false);
  let displayPreposition = $state<"de" | "da" | "do">("de");
  let description = $state("");
  let discord = $state("");
  let fluxer = $state("");
  let website = $state("");
  let sampleLinks = $state("");
  let extraInfo = $state("");
  let adminMessage = $state("");

  // Logo Upload State
  let logoFile = $state<File | null>(null);
  let logoPreviewUrl = $state<string | null>(null);
  let logoId = $state<string | null>(null);
  let isUploadingLogo = $state(false);
  let logoError = $state("");

  // Banner Upload & Framing State (Round 10/11 Architecture)
  let bannerFile = $state<File | null>(null);
  let bannerPreviewUrl = $state<string | null>(null);
  let bannerId = $state<string | null>(null);
  let isUploadingBanner = $state(false);
  let bannerError = $state("");
  let bannerViewMode = $state<"cover" | "contain">("cover");
  let bannerCropMode = $state<"preserve_original" | "custom_crop">("preserve_original");
  let bannerCropX = $state(50);
  let bannerCropY = $state(50);
  let bannerCropZoom = $state(1);

  // Submission State
  let isSubmitting = $state(false);
  let submitError = $state("");

  // Pre-fill if editing from rejected or past request
  let isEditingResubmission = $state(false);

  // Tabs for preview
  type PreviewTab = "works" | "members" | "recruitment" | "comments";
  let previewTab = $state<PreviewTab>("works");

  // Slug auto-generator
  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
  }

  function handleNameChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    scanName = val;
    if (!slugManual) {
      scanSlug = generateSlug(val);
    }
  }

  function handleSlugChange(e: Event) {
    slugManual = true;
    scanSlug = generateSlug((e.target as HTMLInputElement).value);
  }

  // Logo Handler
  async function handleLogoSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      logoError = "Selecione uma imagem válida (PNG, JPG, WEBP ou GIF).";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      logoError = "O logo deve ter no máximo 5MB.";
      return;
    }

    logoError = "";
    logoFile = file;
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    logoPreviewUrl = URL.createObjectURL(file);
    input.value = "";
  }

  function removeLogo() {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    logoPreviewUrl = null;
    logoFile = null;
    logoId = null;
  }

  // Banner Handler
  function handleBannerSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      bannerError = "Selecione uma imagem válida (PNG, JPG, WEBP ou GIF animado).";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      bannerError = "O banner deve ter no máximo 10MB.";
      return;
    }

    bannerError = "";
    bannerCropX = 50;
    bannerCropY = 50;
    bannerCropZoom = 1;
    bannerViewMode = "cover";
    bannerCropMode = "preserve_original";
    bannerFile = file;
    if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
    bannerPreviewUrl = URL.createObjectURL(file);
    input.value = "";
  }

  function removeBanner() {
    if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
    bannerPreviewUrl = null;
    bannerFile = null;
    bannerId = null;
  }

  // Banner Cropper
  async function generateCroppedBannerBlob(file: File, x: number, y: number, zoom: number): Promise<Blob> {
    if (file.type === "image/gif") return file;
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const targetWidth = 1600;
        const targetHeight = 500;
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
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

        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sX, sY, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(file);
          },
          file.type === "image/png" ? "image/png" : "image/webp",
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

  // Upload helper for candidate media
  async function uploadCandidateMedia(file: Blob, purpose: string): Promise<string> {
    const res = await fetch(`/api/upload?purpose=${encodeURIComponent(purpose)}`, {
      method: "POST",
      body: file,
      headers: {
        "x-media-purpose": purpose
      }
    });
    const result = await res.json();
    if (!res.ok || result.error) {
      throw new Error(result.error || "Falha ao enviar arquivo de imagem.");
    }
    return result.id;
  }

  // Prepopulate form for resubmission
  function populateForResubmission(req: any) {
    scanName = req.scan_name || "";
    scanSlug = req.scan_slug || "";
    slugManual = true;
    description = req.description || "";
    discord = req.discord || "";
    fluxer = req.fluxer || "";
    website = req.website || "";
    if (req.meta) {
      logoId = req.meta.logo_id || null;
      bannerId = req.meta.banner_id || null;
      bannerCropMode = req.meta.banner_crop_mode || "preserve_original";
      bannerCropX = req.meta.banner_crop_x ?? 50;
      bannerCropY = req.meta.banner_crop_y ?? 50;
      bannerCropZoom = req.meta.banner_crop_zoom ?? 1;
      sampleLinks = req.meta.sample_links || "";
      extraInfo = req.meta.extra_info || "";
      adminMessage = req.meta.message || "";
    }
    isEditingResubmission = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

<svelte:head>
  <title>Candidatura de Scan Parceira | Project Nox</title>
  <meta
    name="description"
    content="Inscreva sua equipe de tradução no ecossistema do Project Nox. Tenha perfil oficial, autonomia editorial e sistema integrado de recrutamento."
  />
</svelte:head>

<div class="admission-page">
  <!-- Top Navigation Bar -->
  <header class="admission-top-bar">
    <div class="top-bar-inner">
      <a href="/scans" class="btn-back">
        <ArrowLeft size={16} />
        <span>Voltar a Scans & Grupos Parceiros</span>
      </a>

      <!-- View Switcher Tabs (Only when authenticated & form is accessible) -->
      {#if data.isAuthenticated && (!data.activeRequest || isEditingResubmission)}
        <div class="view-mode-toggle" role="tablist">
          <button
            type="button"
            class="toggle-tab-btn"
            class:is-active={viewMode === "edit"}
            onclick={() => (viewMode = "edit")}
            role="tab"
            aria-selected={viewMode === "edit"}
          >
            <Edit3 size={15} />
            <span>Editar Formulário</span>
          </button>
          <button
            type="button"
            class="toggle-tab-btn preview-tab-btn"
            class:is-active={viewMode === "preview"}
            onclick={() => (viewMode = "preview")}
            role="tab"
            aria-selected={viewMode === "preview"}
          >
            <Eye size={15} />
            <span>Visualizar Minha Scan</span>
          </button>
        </div>
      {/if}
    </div>
  </header>

  <!-- 1. CASO 1: VISITANTE NÃO AUTENTICADO -->
  {#if !data.isAuthenticated}
    <main class="admission-container">
      <div class="auth-gate-card">
        <div class="gate-icon-halo">
          <Briefcase size={36} class="gate-icon" />
        </div>
        <h1 class="gate-title">Conecte-se para Cadastrar sua Scan</h1>
        <p class="gate-desc">
          Para registrar sua scan parceira, submeter identidade visual e gerenciar seus lançamentos com proteção e autonomia, entre com sua conta do Project Nox.
        </p>

        <div class="gate-benefits-grid">
          <div class="benefit-item">
            <ShieldCheck size={20} class="b-icon" />
            <div>
              <strong>Perfil Oficial Verificado</strong>
              <span>Página pública com banner panorâmico, logo e links sociais.</span>
            </div>
          </div>
          <div class="benefit-item">
            <LayoutDashboard size={20} class="b-icon" />
            <div>
              <strong>Painel de Gestão Completo</strong>
              <span>Gestão de equipe, pipeline de capítulos e quadro de recrutamento.</span>
            </div>
          </div>
          <div class="benefit-item">
            <Sparkles size={20} class="b-icon" />
            <div>
              <strong>Autonomia e Visibilidade</strong>
              <span>Publicações diretas no catálogo principal para milhares de leitores.</span>
            </div>
          </div>
        </div>

        <a href="/login?redirectTo=/scans/cadastrar" class="btn-gate-login">
          <span>Fazer Login ou Criar Conta</span>
          <ArrowRight size={16} />
        </a>
      </div>
    </main>

  <!-- 2. CASO 2: CANDIDATURA ATIVA EM ANÁLISE (STATUS PENDING) -->
  {:else if data.activeRequest && !isEditingResubmission}
    <main class="admission-container">
      <div class="status-tracking-card">
        <div class="status-header">
          <div class="status-badge-pending">
            <span class="pulse-beacon amber"></span>
            <span>CANDIDATURA EM ANÁLISE</span>
          </div>
          <span class="status-date">
            Enviada em {new Date(data.activeRequest.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <h1 class="status-scan-name">{data.activeRequest.scan_name}</h1>
        <p class="status-scan-slug font-mono">projectnox.com/scans/{data.activeRequest.scan_slug}</p>

        <!-- Media Preview Card -->
        <div class="tracking-media-showcase">
          <div class="tracking-banner-frame">
            {#if data.activeRequest.meta?.banner_id}
              <img src="/media/{data.activeRequest.meta.banner_id}" alt="Banner proposto" class="tracking-banner-img" />
            {:else}
              <div class="tracking-banner-placeholder">
                <Image size={32} />
                <span>Nenhum banner anexado</span>
              </div>
            {/if}
          </div>

          <div class="tracking-identity-row">
            <div class="tracking-logo-frame">
              {#if data.activeRequest.meta?.logo_id}
                <img src="/media/{data.activeRequest.meta.logo_id}" alt="Logo proposto" class="tracking-logo-img" />
              {:else}
                <div class="tracking-logo-placeholder">
                  {data.activeRequest.scan_name.charAt(0).toUpperCase()}
                </div>
              {/if}
            </div>
            <div class="tracking-details">
              {#if data.activeRequest.description}
                <p class="tracking-desc">{data.activeRequest.description}</p>
              {/if}
              <div class="tracking-socials">
                {#if data.activeRequest.discord}
                  <span class="social-chip"><DiscordIcon size={13} /> Discord</span>
                {/if}
                {#if data.activeRequest.fluxer}
                  <span class="social-chip"><FluxerIcon size={13} /> Fluxer</span>
                {/if}
                {#if data.activeRequest.website}
                  <span class="social-chip"><Globe size={13} /> Website</span>
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Explanatory notice -->
        <div class="notice-box-info">
          <Clock size={20} class="notice-icon" />
          <div class="notice-text">
            <strong>O que acontece agora?</strong>
            <p>
              A moderação e administração do Project Nox estão avaliando as amostras e a identidade da sua scan.
              Assim que o pedido for aprovado, você receberá uma notificação no sininho e o acesso ao <strong>Painel da Scan (/scan)</strong> será liberado imediatamente.
            </p>
          </div>
        </div>

        <!-- Cancel Request Action -->
        <div class="tracking-actions">
          <form
            method="POST"
            action="?/cancelApplication"
            use:enhance={({ cancel }) => {
              if (!confirm("Tem certeza que deseja cancelar esta solicitação de parceria?")) {
                cancel();
                return;
              }
              return async ({ update }) => {
                await update();
              };
            }}
          >
            <input type="hidden" name="request_id" value={data.activeRequest.id} />
            <button type="submit" class="btn-cancel-request">
              <X size={15} />
              <span>Cancelar Solicitação</span>
            </button>
          </form>
        </div>
      </div>
    </main>

  <!-- 3. CASO 3: FORMULÁRIO DE CANDIDATURA (MODO EDIÇÃO OU PRÉVIA) -->
  {:else}
    <!-- Sub-visualização: Prévia Realista da Scan (Visualizar Minha Scan) -->
    {#if viewMode === "preview"}
      <div class="preview-stage-wrapper">
        <!-- Floating Notification Bar -->
        <aside class="preview-mode-banner">
          <div class="banner-inner">
            <div class="preview-notice-group">
              <Eye size={18} class="eye-anim" />
              <span>
                <strong>Modo de Pré-visualização ao Vivo</strong> — É exatamente assim que sua Scan será apresentada aos leitores do Project Nox.
              </span>
            </div>
            <button type="button" class="btn-return-edit" onclick={() => (viewMode = "edit")}>
              <Edit3 size={15} />
              <span>Voltar para Edição</span>
            </button>
          </div>
        </aside>

        <!-- Mock Scan Profile Matching /scans/[slug] Approved Architecture -->
        <div class="mock-scan-profile">
          <!-- 1. BANNER COMPLETO DESIMPEDIDO NO TOPO (350px desktop, 180px mobile) -->
          <section class="mock-banner-stage">
            <div class="mock-banner-container">
              {#if bannerPreviewUrl}
                <img
                  src={bannerPreviewUrl}
                  alt="Banner da Scan"
                  class="mock-banner-img"
                  style={bannerViewMode === 'cover' ? `object-position: ${bannerCropX}% ${bannerCropY}%; transform: scale(${bannerCropZoom});` : 'object-fit: contain;'}
                />
              {:else if bannerId}
                <img src="/media/{bannerId}" alt="Banner da Scan" class="mock-banner-img" />
              {:else}
                <div class="mock-banner-fallback">
                  <div class="fallback-glow"></div>
                </div>
              {/if}
              <div class="mock-glass-edge"></div>
            </div>
          </section>

          <!-- 2. IDENTIDADE DA SCAN (Logo abaixo do banner, sem sobreposição) -->
          <section class="mock-identity-section">
            <div class="mock-identity-card">
              <div class="mock-logo-frame">
                {#if logoPreviewUrl}
                  <img src={logoPreviewUrl} alt="Logo" class="mock-logo-img" />
                {:else if logoId}
                  <img src="/media/{logoId}" alt="Logo" class="mock-logo-img" />
                {:else}
                  <div class="mock-logo-fallback">
                    {(scanName || "S").charAt(0).toUpperCase()}
                  </div>
                {/if}
              </div>

              <div class="mock-identity-group">
                <div class="mock-badges-row">
                  <span class="mock-seal-partner">
                    <ShieldCheck size={12} />
                    <span>SCAN PARCEIRA VERIFICADA</span>
                  </span>
                </div>

                <h1 class="mock-title">{scanName || "Nome da Sua Scan"}</h1>

                <p class="mock-desc">
                  {description || "Grupo independente de tradução e edição parceiro da comunidade Project Nox."}
                </p>

                <!-- Socials -->
                <div class="mock-social-dock">
                  {#if discord}
                    <span class="mock-dock-btn discord"><DiscordIcon size={14} /> <span>Discord</span></span>
                  {/if}
                  {#if fluxer}
                    <span class="mock-dock-btn fluxer"><FluxerIcon size={14} /> <span>Fluxer</span></span>
                  {/if}
                  {#if website}
                    <span class="mock-dock-btn website"><Globe size={14} /> <span>Website</span></span>
                  {/if}
                  {#if !discord && !fluxer && !website}
                    <span class="mock-dock-empty">Nenhuma rede social configurada</span>
                  {/if}
                </div>
              </div>
            </div>
          </section>

          <!-- 3. MÉTRICAS DA SCAN -->
          <section class="mock-metrics-section">
            <div class="mock-metrics-dock">
              <div class="mock-metric-cell">
                <span class="m-val">0</span>
                <span class="m-lbl">Obras Ativas</span>
              </div>
              <div class="mock-metric-sep"></div>
              <div class="mock-metric-cell">
                <span class="m-val">0</span>
                <span class="m-lbl">Capítulos</span>
              </div>
              <div class="mock-metric-sep"></div>
              <div class="mock-metric-cell">
                <span class="m-val">1</span>
                <span class="m-lbl">Fundador(a)</span>
              </div>
              <div class="mock-metric-sep"></div>
              <div class="mock-metric-cell">
                <span class="m-val">100%</span>
                <span class="m-lbl">Autonomia</span>
              </div>
            </div>
          </section>

          <!-- 4. APENAS AS 4 ABAS APROVADAS (Obras, Equipe, Recrutamento, Comentários) -->
          <section class="mock-tabs-section">
            <div class="mock-tabs-nav" role="tablist">
              <button
                type="button"
                class="mock-nav-btn"
                class:is-active={previewTab === "works"}
                onclick={() => (previewTab = "works")}
              >
                <BookOpen size={16} />
                <span>Obras (0)</span>
              </button>
              <button
                type="button"
                class="mock-nav-btn"
                class:is-active={previewTab === "members"}
                onclick={() => (previewTab = "members")}
              >
                <Users size={16} />
                <span>Equipe (1)</span>
              </button>
              <button
                type="button"
                class="mock-nav-btn"
                class:is-active={previewTab === "recruitment"}
                onclick={() => (previewTab = "recruitment")}
              >
                <Briefcase size={16} />
                <span>Recrutamento (0)</span>
              </button>
              <button
                type="button"
                class="mock-nav-btn"
                class:is-active={previewTab === "comments"}
                onclick={() => (previewTab = "comments")}
              >
                <MessageSquare size={16} />
                <span>Comentários (0)</span>
              </button>
            </div>

            <div class="mock-tab-body">
              {#if previewTab === "works"}
                <div class="mock-empty-tab">
                  <BookOpen size={36} class="empty-icon" />
                  <h3>Nenhuma obra publicada ainda</h3>
                  <p>Assim que sua parceria for aprovada, você poderá cadastrar seus projetos e lançar capítulos pelo Painel da Scan.</p>
                </div>
              {:else if previewTab === "members"}
                <div class="mock-members-grid">
                  <div class="mock-member-card">
                    <UserAvatar
                      avatarId={data.user?.avatar_id}
                      displayName={data.user?.display_name || data.user?.username || "Você"}
                      size={44}
                    />
                    <div class="mock-member-info">
                      <strong class="mock-member-name">{data.user?.display_name || data.user?.username || "Você"}</strong>
                      <span class="mock-member-role">👑 Dono & Fundador</span>
                    </div>
                  </div>
                </div>
              {:else if previewTab === "recruitment"}
                <div class="mock-empty-tab">
                  <Briefcase size={36} class="empty-icon" />
                  <h3>Sem vagas abertas no momento</h3>
                  <p>Pelo Painel da Scan, você poderá criar vagas para tradutores, revisores, editores e mais cargos.</p>
                </div>
              {:else}
                <div class="mock-empty-tab">
                  <MessageSquare size={36} class="empty-icon" />
                  <h3>Mural de Comentários da Comunidade</h3>
                  <p>Espaço para os leitores interagirem com sua equipe e comentarem sobre seus lançamentos.</p>
                </div>
              {/if}
            </div>
          </section>
        </div>
      </div>

    <!-- Sub-visualização: Formulário de Edição -->
    {:else}
      <main class="admission-container">
        <!-- Hero Title -->
        <header class="admission-header">
          <div class="header-badge">
            <Sparkles size={14} />
            <span>Parceria Oficial Project Nox</span>
          </div>
          <h1 class="header-title">Cadastre sua Scan no Project Nox</h1>
          <p class="header-subtitle">
            Configure a identidade visual da sua equipe, submeta seu logotipo e banner panorâmico e tenha acesso a ferramentas editoriais completas.
          </p>
        </header>

        <!-- Past rejection notice if any -->
        {#if data.pastRequests?.some((r: any) => r.status === 'REJECTED') && !isEditingResubmission}
          {@const rejected = data.pastRequests.find((r: any) => r.status === 'REJECTED')}
          <div class="rejection-feedback-card">
            <div class="rejection-head">
              <AlertTriangle size={20} class="warn-icon" />
              <strong>Sua candidatura anterior não foi aprovada</strong>
            </div>
            {#if rejected?.rejection_reason}
              <p class="rejection-reason-text">
                <strong>Motivo da administração:</strong> {rejected.rejection_reason}
              </p>
            {/if}
            <button
              type="button"
              class="btn-resubmit-prefill"
              onclick={() => populateForResubmission(rejected)}
            >
              <Edit3 size={15} />
              <span>Ajustar Informações e Reenviar</span>
            </button>
          </div>
        {/if}

        <!-- Error Alert -->
        {#if submitError || form?.message}
          <div class="form-alert-error">
            <AlertTriangle size={18} />
            <span>{submitError || form?.message}</span>
          </div>
        {/if}

        <!-- Success Alert -->
        {#if form?.success}
          <div class="form-alert-success">
            <CheckCircle2 size={18} />
            <span>Candidatura enviada com sucesso! A moderação já está avaliando sua solicitação.</span>
          </div>
        {/if}

        <!-- Main Registration Form -->
        <form
          method="POST"
          action="?/submitApplication"
          class="admission-form"
          use:enhance={async ({ formData, cancel }) => {
            submitError = "";
            isSubmitting = true;

            try {
              // 1. Upload Logo if fresh file staged
              if (logoFile) {
                isUploadingLogo = true;
                const uploadedLogoId = await uploadCandidateMedia(logoFile, "scan_candidate_logo");
                logoId = uploadedLogoId;
                formData.set("logo_id", uploadedLogoId);
                isUploadingLogo = false;
              } else if (logoId) {
                formData.set("logo_id", logoId);
              }

              // 2. Upload Banner if fresh file staged
              if (bannerFile) {
                isUploadingBanner = true;
                const bannerBlob = (bannerCropMode === "custom_crop" && bannerFile.type !== "image/gif")
                  ? await generateCroppedBannerBlob(bannerFile, bannerCropX, bannerCropY, bannerCropZoom)
                  : bannerFile;

                const uploadedBannerId = await uploadCandidateMedia(bannerBlob, "scan_candidate_banner");
                bannerId = uploadedBannerId;
                formData.set("banner_id", uploadedBannerId);
                isUploadingBanner = false;
              } else if (bannerId) {
                formData.set("banner_id", bannerId);
              }

              // Set other form metadata
              formData.set("banner_crop_mode", bannerCropMode);
              formData.set("banner_crop_x", String(bannerCropX));
              formData.set("banner_crop_y", String(bannerCropY));
              formData.set("banner_crop_zoom", String(bannerCropZoom));
            } catch (err: any) {
              cancel();
              isSubmitting = false;
              isUploadingLogo = false;
              isUploadingBanner = false;
              submitError = err.message || "Falha ao enviar mídias da scan.";
              return;
            }

            return async ({ update }) => {
              isSubmitting = false;
              await update();
            };
          }}
        >
          <!-- Seção 1: Identidade Básica -->
          <div class="form-card">
            <div class="card-head">
              <span class="card-step-badge">1</span>
              <div>
                <h2 class="card-title">Identidade da Scan</h2>
                <p class="card-desc">Defina o nome oficial e o identificador web da sua equipe.</p>
              </div>
            </div>

            <div class="fields-grid-2">
              <div class="form-group">
                <label for="scan-name" class="form-label">
                  Nome da Scan <span class="req-star">*</span>
                </label>
                <input
                  id="scan-name"
                  name="name"
                  type="text"
                  class="form-input"
                  placeholder="Ex: Imperador Scans"
                  required
                  minlength="2"
                  maxlength="100"
                  value={scanName}
                  oninput={handleNameChange}
                />
              </div>

              <div class="form-group">
                <label for="scan-slug" class="form-label">
                  Slug do Perfil (URL) <span class="req-star">*</span>
                </label>
                <div class="slug-input-wrapper">
                  <span class="slug-prefix">projectnox.com/scans/</span>
                  <input
                    id="scan-slug"
                    name="slug"
                    type="text"
                    class="form-input slug-input"
                    placeholder="imperador-scans"
                    required
                    minlength="2"
                    maxlength="60"
                    value={scanSlug}
                    oninput={handleSlugChange}
                  />
                </div>
              </div>
            </div>

            <div class="fields-grid-2">
              <div class="form-group">
                <label for="display-preposition" class="form-label">
                  Preposição Editorial
                </label>
                <select
                  id="display-preposition"
                  name="display_preposition"
                  class="form-select"
                  bind:value={displayPreposition}
                >
                  <option value="de">Traduções de {scanName || '...'}</option>
                  <option value="da">Traduções da {scanName || '...'}</option>
                  <option value="do">Traduções do {scanName || '...'}</option>
                </select>
                <span class="field-hint">Como sua scan será citada nas páginas das obras e capítulos.</span>
              </div>
            </div>

            <div class="form-group">
              <label for="scan-description" class="form-label">
                Descrição da Scan
              </label>
              <textarea
                id="scan-description"
                name="description"
                class="form-textarea"
                rows="3"
                placeholder="Conte sobre o foco da sua scan, gêneros favoritos (manhuas, manhwas, mangás) e proposta da equipe..."
                maxlength="2000"
                bind:value={description}
              ></textarea>
              <div class="char-count">{description.length} / 2000 caracteres</div>
            </div>
          </div>

          <!-- Seção 2: Identidade Visual & Branding -->
          <div class="form-card">
            <div class="card-head">
              <span class="card-step-badge">2</span>
              <div>
                <h2 class="card-title">Identidade Visual & Branding</h2>
                <p class="card-desc">Logo oficial e banner panorâmico em alta resolução para seu perfil público.</p>
              </div>
            </div>

            <!-- Upload do Logo -->
            <div class="media-upload-section">
              <span class="media-subhead">Logo da Scan (Quadrado ou Redondo)</span>
              <div class="logo-staging-row">
                <div class="logo-preview-box">
                  {#if logoPreviewUrl}
                    <img src={logoPreviewUrl} alt="Prévia do Logo" class="staged-logo-img" />
                  {:else if logoId}
                    <img src="/media/{logoId}" alt="Logo cadastrado" class="staged-logo-img" />
                  {:else}
                    <div class="logo-placeholder">
                      <Image size={24} />
                      <span>Sem logo</span>
                    </div>
                  {/if}
                </div>

                <div class="logo-upload-controls">
                  <label class="btn-file-upload">
                    <Upload size={14} />
                    <span>{logoFile || logoId ? "Trocar Logo" : "Selecionar Logo"}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={handleLogoSelect} hidden />
                  </label>
                  {#if logoFile || logoId}
                    <button type="button" class="btn-remove-media" onclick={removeLogo}>
                      <X size={14} />
                      <span>Remover</span>
                    </button>
                  {/if}
                  <span class="media-hint">PNG, JPG, WEBP ou GIF até 5MB. Proporção 1:1 recomendada.</span>
                  {#if logoError}
                    <span class="upload-err-text">{logoError}</span>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Upload do Banner Panorâmico Widescreen (Round 10/11 Architecture) -->
            <div class="media-upload-section banner-section">
              <div class="banner-subhead-row">
                <div>
                  <span class="media-subhead">Banner Panorâmico Widescreen</span>
                  <span class="media-type-tag">16:5 · ENQUADRAMENTO CINEMATOGRÁFICO</span>
                </div>

                <!-- Toggle Cover vs Contain -->
                <div class="view-toggle-pills">
                  <button
                    type="button"
                    class="view-pill"
                    class:is-active={bannerViewMode === "cover"}
                    onclick={() => (bannerViewMode = "cover")}
                  >
                    Enquadramento Widescreen
                  </button>
                  <button
                    type="button"
                    class="view-pill"
                    class:is-active={bannerViewMode === "contain"}
                    onclick={() => (bannerViewMode = "contain")}
                  >
                    Ver Arte Completa
                  </button>
                </div>
              </div>

              <!-- Grande Palco de Prévia do Banner (280px altura desktop, 180px mobile) -->
              <div class="banner-stage-box" class:is-contain={bannerViewMode === "contain"}>
                {#if bannerPreviewUrl}
                  <div class="banner-crop-container">
                    <img
                      src={bannerPreviewUrl}
                      alt="Prévia do banner"
                      class="staged-banner-img"
                      class:img-contain={bannerViewMode === "contain"}
                      style={bannerViewMode === "cover" ? `object-position: ${bannerCropX}% ${bannerCropY}%; transform: scale(${bannerCropZoom}); transform-origin: center center;` : ""}
                    />
                    {#if bannerViewMode === "cover"}
                      <div class="crop-guides-badge">
                        <span>PALCO PANORÂMICO</span>
                      </div>
                    {/if}
                  </div>
                {:else if bannerId}
                  <img src="/media/{bannerId}" alt="Banner cadastrado" class="staged-banner-img" class:img-contain={bannerViewMode === "contain"} />
                {:else}
                  <div class="banner-stage-placeholder">
                    <Image size={38} />
                    <span>Selecione uma imagem panorâmica para seu banner</span>
                  </div>
                {/if}
              </div>

              <!-- Controles de Enquadramento Manual & Preservação -->
              {#if bannerFile}
                <div class="banner-controls-dock">
                  <div class="processing-mode-row">
                    <span class="proc-label">Processamento:</span>
                    <button
                      type="button"
                      class="proc-btn"
                      class:is-active={bannerCropMode === "preserve_original"}
                      onclick={() => (bannerCropMode = "preserve_original")}
                    >
                      <CheckCircle2 size={14} />
                      <span>Preservar Imagem Completa (Original)</span>
                    </button>
                    <button
                      type="button"
                      class="proc-btn"
                      class:is-active={bannerCropMode === "custom_crop"}
                      onclick={() => (bannerCropMode = "custom_crop")}
                    >
                      <Crop size={14} />
                      <span>Recorte & Enquadramento Manual</span>
                    </button>
                  </div>

                  {#if bannerCropMode === "custom_crop"}
                    <div class="framing-sliders-box">
                      <div class="framing-presets">
                        <span class="framing-presets-lbl">Presets Verticais:</span>
                        <button type="button" class="preset-chip" onclick={() => (bannerCropY = 15)}>Topo</button>
                        <button type="button" class="preset-chip" onclick={() => (bannerCropY = 50)}>Centro</button>
                        <button type="button" class="preset-chip" onclick={() => (bannerCropY = 85)}>Base</button>
                        <button type="button" class="preset-chip reset" onclick={() => { bannerCropX = 50; bannerCropY = 50; bannerCropZoom = 1; }}>Resetar</button>
                      </div>

                      <div class="sliders-grid">
                        <div class="slider-item">
                          <div class="slider-lbl">
                            <span>Posição Vertical</span>
                            <span class="val-tag">{bannerCropY}%</span>
                          </div>
                          <input type="range" min="0" max="100" step="1" bind:value={bannerCropY} class="range-bar" />
                        </div>

                        <div class="slider-item">
                          <div class="slider-lbl">
                            <span>Posição Horizontal</span>
                            <span class="val-tag">{bannerCropX}%</span>
                          </div>
                          <input type="range" min="0" max="100" step="1" bind:value={bannerCropX} class="range-bar" />
                        </div>

                        <div class="slider-item">
                          <div class="slider-lbl">
                            <span>Zoom</span>
                            <span class="val-tag">{bannerCropZoom.toFixed(2)}x</span>
                          </div>
                          <input type="range" min="1" max="2.5" step="0.05" bind:value={bannerCropZoom} class="range-bar" />
                        </div>
                      </div>
                    </div>
                  {:else}
                    <div class="preserve-note">
                      <span>✓ O arquivo original será salvo sem cortes destrutivos e enquadrado dinamicamente de forma responsiva.</span>
                    </div>
                  {/if}
                </div>
              {/if}

              <div class="banner-file-actions">
                <label class="btn-file-upload">
                  <Upload size={14} />
                  <span>{bannerFile || bannerId ? "Trocar Banner" : "Selecionar Banner Panorâmico"}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={handleBannerSelect} hidden />
                </label>
                {#if bannerFile || bannerId}
                  <button type="button" class="btn-remove-media" onclick={removeBanner}>
                    <X size={14} />
                    <span>Remover</span>
                  </button>
                {/if}
                {#if bannerError}
                  <span class="upload-err-text">{bannerError}</span>
                {/if}
              </div>
            </div>
          </div>

          <!-- Seção 3: Redes Oficiais & Comunidade -->
          <div class="form-card">
            <div class="card-head">
              <span class="card-step-badge">3</span>
              <div>
                <h2 class="card-title">Redes Oficiais & Comunidade</h2>
                <p class="card-desc">Conecte os leitores ao seu Discord, Fluxer ou Website (todos opcionais).</p>
              </div>
            </div>

            <div class="fields-grid-3">
              <div class="form-group">
                <label for="scan-discord" class="form-label">
                  <DiscordIcon size={14} />
                  <span>Servidor Discord</span>
                </label>
                <input
                  id="scan-discord"
                  name="discord"
                  type="url"
                  class="form-input"
                  placeholder="https://discord.gg/suascan"
                  maxlength="255"
                  bind:value={discord}
                />
              </div>

              <div class="form-group">
                <label for="scan-fluxer" class="form-label">
                  <FluxerIcon size={14} />
                  <span>Comunidade Fluxer</span>
                </label>
                <input
                  id="scan-fluxer"
                  name="fluxer"
                  type="text"
                  class="form-input"
                  placeholder="@suascan ou link"
                  maxlength="255"
                  bind:value={fluxer}
                />
              </div>

              <div class="form-group">
                <label for="scan-website" class="form-label">
                  <Globe size={14} />
                  <span>Website Oficial</span>
                </label>
                <input
                  id="scan-website"
                  name="website"
                  type="url"
                  class="form-input"
                  placeholder="https://suascan.com"
                  maxlength="255"
                  bind:value={website}
                />
              </div>
            </div>
          </div>

          <!-- Seção 4: Obras, Amostras & Equipe -->
          <div class="form-card">
            <div class="card-head">
              <span class="card-step-badge">4</span>
              <div>
                <h2 class="card-title">Amostras de Obras & Informações da Equipe</h2>
                <p class="card-desc">Ajude a moderação a conhecer suas traduções anteriores e estrutura de lançamentos.</p>
              </div>
            </div>

            <div class="form-group">
              <label for="sample-links" class="form-label">
                Amostras de Obras Traduzidas / Links de Capítulos
              </label>
              <textarea
                id="sample-links"
                name="sample_links"
                class="form-textarea"
                rows="3"
                placeholder="Insira links de capítulos já traduzidos pela equipe, leitor online, Drive ou portfólio para avaliação de qualidade..."
                maxlength="4000"
                bind:value={sampleLinks}
              ></textarea>
            </div>

            <div class="form-group">
              <label for="extra-info" class="form-label">
                Estrutura da Equipe & Periodicidade
              </label>
              <input
                id="extra-info"
                name="extra_info"
                type="text"
                class="form-input"
                placeholder="Ex: 5 membros ativos (2 tradutores, 2 editores, 1 revisor). Lançamentos semanais."
                maxlength="2000"
                bind:value={extraInfo}
              />
            </div>

            <div class="form-group">
              <label for="admin-message" class="form-label">
                Mensagem para os Administradores do Project Nox
              </label>
              <textarea
                id="admin-message"
                name="message"
                class="form-textarea"
                rows="3"
                placeholder="Apresente sua equipe, expectativas com a parceria ou observações adicionais para nossa administração..."
                maxlength="2000"
                bind:value={adminMessage}
              ></textarea>
            </div>
          </div>

          <!-- Bottom Actions Bar -->
          <div class="form-footer-actions">
            <button
              type="button"
              class="btn-footer-preview"
              onclick={() => {
                viewMode = "preview";
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <Eye size={16} />
              <span>Visualizar Prévia da Scan</span>
            </button>

            <button
              type="submit"
              class="btn-footer-submit"
              disabled={isSubmitting || isUploadingLogo || isUploadingBanner}
            >
              {#if isSubmitting || isUploadingLogo || isUploadingBanner}
                <span class="spinner-sm"></span>
                <span>Enviando Candidatura...</span>
              {:else}
                <Send size={16} />
                <span>Enviar Solicitação de Parceria</span>
              {/if}
            </button>
          </div>
        </form>
      </main>
    {/if}
  {/if}
</div>

<style>
  /* ==========================================================================
     PAGE LAYOUT & CONTAINER
     ========================================================================== */
  .admission-page {
    min-height: 100vh;
    background: #090d16;
    color: #e2e8f0;
    padding-bottom: 5rem;
  }

  .admission-top-bar {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(9, 13, 22, 0.88);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .top-bar-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0.85rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: #94a3b8;
    font-size: 0.84rem;
    font-weight: 600;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .btn-back:hover {
    color: #ffffff;
  }

  .view-mode-toggle {
    display: inline-flex;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 9999px;
    padding: 3px;
  }

  .toggle-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 1rem;
    border-radius: 9999px;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-tab-btn.is-active {
    background: #7c3aed;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
  }

  .preview-tab-btn.is-active {
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.4);
  }

  .admission-container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2.5rem 1.25rem;
  }

  /* Header */
  .admission-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(124, 58, 237, 0.15);
    border: 1px solid rgba(124, 58, 237, 0.35);
    border-radius: 9999px;
    padding: 0.35rem 0.9rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: #c4b5fd;
    margin-bottom: 1rem;
  }

  .header-title {
    font-family: "Manrope", sans-serif;
    font-size: 2.25rem;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.025em;
    margin: 0 0 0.85rem;
  }

  .header-subtitle {
    font-size: 1.05rem;
    color: #94a3b8;
    max-width: 680px;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* ==========================================================================
     AUTHENTICATION GATE CARD
     ========================================================================== */
  .auth-gate-card {
    background: linear-gradient(180deg, rgba(20, 26, 46, 0.9) 0%, rgba(13, 17, 30, 0.95) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 24px;
    padding: 3.5rem 2rem;
    text-align: center;
    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
  }

  .gate-icon-halo {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
    color: #a78bfa;
    box-shadow: 0 0 24px rgba(139, 92, 246, 0.35);
  }

  .gate-title {
    font-family: "Manrope", sans-serif;
    font-size: 1.85rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.85rem;
  }

  .gate-desc {
    font-size: 1rem;
    color: #94a3b8;
    max-width: 560px;
    margin: 0 auto 2.5rem;
    line-height: 1.6;
  }

  .gate-benefits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.25rem;
    max-width: 850px;
    margin: 0 auto 2.5rem;
    text-align: left;
  }

  .benefit-item {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem;
  }

  .benefit-item :global(.b-icon) {
    color: #38bdf8;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .benefit-item strong {
    display: block;
    font-size: 0.92rem;
    color: #ffffff;
    margin-bottom: 0.25rem;
  }

  .benefit-item span {
    font-size: 0.82rem;
    color: #94a3b8;
    line-height: 1.5;
  }

  .btn-gate-login {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    color: #ffffff;
    font-size: 0.95rem;
    font-weight: 700;
    padding: 0.85rem 2rem;
    border-radius: 14px;
    text-decoration: none;
    box-shadow: 0 10px 24px -6px rgba(124, 58, 237, 0.5);
    transition: all 0.2s ease;
  }

  .btn-gate-login:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -4px rgba(124, 58, 237, 0.65);
  }

  /* ==========================================================================
     STATUS TRACKING CARD (PENDING)
     ========================================================================== */
  .status-tracking-card {
    background: linear-gradient(180deg, rgba(20, 26, 46, 0.9) 0%, rgba(13, 17, 30, 0.95) 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 24px;
    padding: 2.5rem;
    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
  }

  .status-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .status-badge-pending {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    border-radius: 9999px;
    padding: 0.35rem 0.85rem;
    font-size: 0.78rem;
    font-weight: 800;
    color: #fbbf24;
  }

  .pulse-beacon {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .pulse-beacon.amber {
    background: #f59e0b;
    box-shadow: 0 0 8px #f59e0b;
  }

  .status-date {
    font-size: 0.84rem;
    color: #94a3b8;
  }

  .status-scan-name {
    font-family: "Manrope", sans-serif;
    font-size: 1.95rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.35rem;
  }

  .status-scan-slug {
    font-size: 0.88rem;
    color: #38bdf8;
    margin: 0 0 1.75rem;
  }

  .tracking-media-showcase {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 1.75rem;
  }

  .tracking-banner-frame {
    width: 100%;
    height: 180px;
    background: #111827;
    position: relative;
    overflow: hidden;
  }

  .tracking-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tracking-banner-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #64748b;
    font-size: 0.84rem;
  }

  .tracking-identity-row {
    padding: 1.25rem;
    display: flex;
    gap: 1.25rem;
    align-items: flex-start;
  }

  .tracking-logo-frame {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    overflow: hidden;
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }

  .tracking-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tracking-logo-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1.4rem;
    color: #a78bfa;
    background: #1e1b4b;
  }

  .tracking-desc {
    font-size: 0.88rem;
    color: #cbd5e1;
    margin: 0 0 0.85rem;
    line-height: 1.5;
  }

  .tracking-socials {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .social-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0.25rem 0.6rem;
    font-size: 0.78rem;
    color: #cbd5e1;
  }

  .notice-box-info {
    display: flex;
    gap: 1rem;
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: 14px;
    padding: 1.25rem;
    margin-bottom: 2rem;
  }

  .notice-box-info :global(.notice-icon) {
    color: #38bdf8;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .notice-text strong {
    display: block;
    font-size: 0.95rem;
    color: #38bdf8;
    margin-bottom: 0.35rem;
  }

  .notice-text p {
    font-size: 0.88rem;
    color: #cbd5e1;
    line-height: 1.6;
    margin: 0;
  }

  .tracking-actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn-cancel-request {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.65rem 1.25rem;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-cancel-request:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ffffff;
  }

  /* Rejection feedback card */
  .rejection-feedback-card {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 2rem;
  }

  .rejection-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #fca5a5;
    font-size: 0.95rem;
    margin-bottom: 0.5rem;
  }

  .rejection-reason-text {
    font-size: 0.88rem;
    color: #e2e8f0;
    line-height: 1.5;
    margin: 0 0 1rem;
  }

  .btn-resubmit-prefill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #ef4444;
    color: #ffffff;
    font-size: 0.84rem;
    font-weight: 700;
    padding: 0.55rem 1rem;
    border-radius: 10px;
    border: none;
    cursor: pointer;
  }

  /* ==========================================================================
     REGISTRATION FORM CARDS & INPUTS
     ========================================================================== */
  .admission-form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-card {
    background: linear-gradient(180deg, rgba(20, 26, 46, 0.85) 0%, rgba(13, 17, 30, 0.95) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2rem;
    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
  }

  .card-head {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.75rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .card-step-badge {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: #7c3aed;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.95rem;
    flex-shrink: 0;
  }

  .card-title {
    font-family: "Manrope", sans-serif;
    font-size: 1.35rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.25rem;
  }

  .card-desc {
    font-size: 0.86rem;
    color: #94a3b8;
    margin: 0;
  }

  .fields-grid-2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.25rem;
    margin-bottom: 1.25rem;
  }

  .fields-grid-3 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
    margin-bottom: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin-bottom: 1.25rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.84rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .req-star {
    color: #f43f5e;
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    color: #ffffff;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.2s ease;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.25);
  }

  .slug-input-wrapper {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    overflow: hidden;
  }

  .slug-prefix {
    padding: 0.75rem 0.5rem 0.75rem 1rem;
    font-size: 0.82rem;
    color: #64748b;
    font-family: monospace;
    user-select: none;
  }

  .slug-input {
    border: none;
    background: transparent;
    padding-left: 0;
    border-radius: 0;
    font-family: monospace;
    color: #38bdf8;
  }

  .field-hint {
    font-size: 0.78rem;
    color: #64748b;
  }

  .char-count {
    font-size: 0.78rem;
    color: #64748b;
    text-align: right;
  }

  /* ==========================================================================
     MEDIA UPLOADS & FRAMING TOOLS
     ========================================================================== */
  .media-upload-section {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 1.75rem;
  }

  .media-upload-section:last-child {
    margin-bottom: 0;
  }

  .media-subhead {
    display: block;
    font-size: 0.92rem;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 0.25rem;
  }

  .media-type-tag {
    font-size: 0.72rem;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.15);
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
  }

  /* Logo */
  .logo-staging-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .logo-preview-box {
    width: 90px;
    height: 90px;
    border-radius: 20px;
    overflow: hidden;
    background: #1e1b4b;
    border: 2px solid rgba(139, 92, 246, 0.4);
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.25);
    flex-shrink: 0;
  }

  .staged-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .logo-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    color: #94a3b8;
    font-size: 0.74rem;
  }

  .logo-upload-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .btn-file-upload {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 0.6rem 1.1rem;
    font-size: 0.84rem;
    font-weight: 700;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-file-upload:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .btn-remove-media {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: transparent;
    border: none;
    color: #f87171;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
  }

  .media-hint {
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .upload-err-text {
    font-size: 0.8rem;
    color: #f87171;
    font-weight: 600;
  }

  /* Banner Framing */
  .banner-subhead-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .view-toggle-pills {
    display: inline-flex;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    padding: 3px;
  }

  .view-pill {
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 0.76rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .view-pill.is-active {
    background: #3b82f6;
    color: #ffffff;
  }

  /* Grande Palco do Banner (280px altura desktop, 180px mobile) */
  .banner-stage-box {
    width: 100%;
    height: 280px;
    border-radius: 16px;
    overflow: hidden;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.6);
  }

  .banner-stage-box.is-contain {
    background: #000000;
  }

  .banner-crop-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .staged-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: object-position 0.1s ease, transform 0.1s ease;
  }

  .staged-banner-img.img-contain {
    object-fit: contain;
  }

  .crop-guides-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 0.25rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 800;
    color: #38bdf8;
    backdrop-filter: blur(8px);
  }

  .banner-stage-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    color: #64748b;
    font-size: 0.88rem;
  }

  /* Banner Framing Controls */
  .banner-controls-dock {
    margin-top: 1.25rem;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1.25rem;
  }

  .processing-mode-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .proc-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: #94a3b8;
  }

  .proc-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.9rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: #cbd5e1;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .proc-btn.is-active {
    background: rgba(139, 92, 246, 0.2);
    border-color: #8b5cf6;
    color: #c4b5fd;
  }

  .framing-presets {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .framing-presets-lbl {
    font-size: 0.78rem;
    color: #94a3b8;
    font-weight: 600;
  }

  .preset-chip {
    padding: 0.25rem 0.65rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    color: #cbd5e1;
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
  }

  .preset-chip:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
  }

  .preset-chip.reset {
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .sliders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.25rem;
  }

  .slider-lbl {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: #cbd5e1;
    font-weight: 600;
    margin-bottom: 0.35rem;
  }

  .val-tag {
    color: #38bdf8;
    font-family: monospace;
  }

  .range-bar {
    width: 100%;
    accent-color: #8b5cf6;
    cursor: pointer;
  }

  .preserve-note {
    font-size: 0.82rem;
    color: #6ee7b7;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 10px;
    padding: 0.75rem 1rem;
  }

  .banner-file-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  /* Form Alerts */
  .form-alert-error {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    color: #fca5a5;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .form-alert-success {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    color: #6ee7b7;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  /* Footer Actions */
  .form-footer-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    padding-top: 1rem;
    flex-wrap: wrap;
  }

  .btn-footer-preview {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    font-size: 0.9rem;
    font-weight: 700;
    padding: 0.85rem 1.5rem;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-footer-preview:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .btn-footer-submit {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
    color: #ffffff;
    font-size: 0.92rem;
    font-weight: 800;
    padding: 0.85rem 1.85rem;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    box-shadow: 0 10px 24px -6px rgba(124, 58, 237, 0.5);
    transition: all 0.2s ease;
  }

  .btn-footer-submit:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -4px rgba(124, 58, 237, 0.65);
  }

  .btn-footer-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ==========================================================================
     REALISTIC LIVE PREVIEW STAGE (/scans/[slug] ARCHITECTURE)
     ========================================================================== */
  .preview-stage-wrapper {
    width: 100%;
  }

  .preview-mode-banner {
    position: sticky;
    top: 61px;
    z-index: 45;
    background: linear-gradient(90deg, #0f172a 0%, #1e1b4b 100%);
    border-bottom: 1px solid rgba(56, 189, 248, 0.3);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }

  .banner-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0.75rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .preview-notice-group {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    font-size: 0.88rem;
    color: #e2e8f0;
  }

  .preview-notice-group :global(.eye-anim) {
    color: #38bdf8;
  }

  .btn-return-edit {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: #7c3aed;
    color: #ffffff;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 0.45rem 1rem;
    border-radius: 10px;
    border: none;
    cursor: pointer;
  }

  .mock-scan-profile {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem;
  }

  /* 1. Mock Banner Stage (100% Free at top) */
  .mock-banner-stage {
    width: 100%;
    margin-bottom: 1.5rem;
  }

  .mock-banner-container {
    width: 100%;
    height: 350px;
    border-radius: 20px;
    overflow: hidden;
    position: relative;
    background: #0f172a;
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6);
  }

  .mock-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .mock-banner-fallback {
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.3), transparent 70%),
      linear-gradient(180deg, #1e1b4b 0%, #090d16 100%);
    position: relative;
  }

  .mock-glass-edge {
    position: absolute;
    inset: 0;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    pointer-events: none;
  }

  /* 2. Mock Identity Section */
  .mock-identity-section {
    margin-bottom: 1.5rem;
  }

  .mock-identity-card {
    background: linear-gradient(180deg, rgba(20, 26, 46, 0.9) 0%, rgba(13, 17, 30, 0.95) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 1.75rem 2rem;
    display: flex;
    align-items: flex-start;
    gap: 1.75rem;
  }

  .mock-logo-frame {
    width: 110px;
    height: 110px;
    border-radius: 22px;
    overflow: hidden;
    background: #1e1b4b;
    border: 2px solid rgba(139, 92, 246, 0.4);
    box-shadow: 0 0 24px rgba(124, 58, 237, 0.3);
    flex-shrink: 0;
  }

  .mock-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .mock-logo-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.75rem;
    font-weight: 800;
    color: #c4b5fd;
  }

  .mock-identity-group {
    flex: 1;
  }

  .mock-badges-row {
    margin-bottom: 0.5rem;
  }

  .mock-seal-partner {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(6, 182, 212, 0.12);
    border: 1px solid rgba(6, 182, 212, 0.35);
    border-radius: 9999px;
    padding: 0.25rem 0.65rem;
    font-size: 0.72rem;
    font-weight: 800;
    color: #38bdf8;
    letter-spacing: 0.04em;
  }

  .mock-title {
    font-family: "Manrope", sans-serif;
    font-size: 1.85rem;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 0.5rem;
  }

  .mock-desc {
    font-size: 0.92rem;
    color: #94a3b8;
    line-height: 1.6;
    margin: 0 0 1.25rem;
    max-width: 800px;
  }

  .mock-social-dock {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .mock-dock-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.85rem;
    border-radius: 10px;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .mock-dock-btn.discord {
    background: rgba(88, 101, 242, 0.15);
    border: 1px solid rgba(88, 101, 242, 0.35);
    color: #818cf8;
  }

  .mock-dock-btn.fluxer {
    background: rgba(244, 63, 94, 0.15);
    border: 1px solid rgba(244, 63, 94, 0.35);
    color: #fb7185;
  }

  .mock-dock-btn.website {
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.35);
    color: #38bdf8;
  }

  .mock-dock-empty {
    font-size: 0.82rem;
    color: #64748b;
    font-style: italic;
  }

  /* 3. Mock Metrics Dock */
  .mock-metrics-section {
    margin-bottom: 2rem;
  }

  .mock-metrics-dock {
    background: rgba(13, 17, 30, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-around;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .mock-metric-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .mock-metric-cell .m-val {
    font-family: "Manrope", sans-serif;
    font-size: 1.45rem;
    font-weight: 800;
    color: #ffffff;
  }

  .mock-metric-cell .m-lbl {
    font-size: 0.78rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 2px;
  }

  .mock-metric-sep {
    width: 1px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
  }

  /* 4. Mock Tabs (Only 4 approved tabs) */
  .mock-tabs-section {
    background: linear-gradient(180deg, rgba(20, 26, 46, 0.7) 0%, rgba(13, 17, 30, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 1.75rem;
  }

  .mock-tabs-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 1rem;
    margin-bottom: 1.75rem;
    overflow-x: auto;
  }

  .mock-nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.15rem;
    border-radius: 12px;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .mock-nav-btn.is-active {
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .mock-empty-tab {
    text-align: center;
    padding: 3rem 1.5rem;
    color: #64748b;
  }

  .mock-empty-tab :global(.empty-icon) {
    margin: 0 auto 1rem;
    color: #475569;
  }

  .mock-empty-tab h3 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #cbd5e1;
    margin: 0 0 0.4rem;
  }

  .mock-empty-tab p {
    font-size: 0.86rem;
    color: #94a3b8;
    max-width: 480px;
    margin: 0 auto;
    line-height: 1.6;
  }

  .mock-members-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
  }

  .mock-member-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1rem;
  }

  .mock-member-name {
    display: block;
    font-size: 0.95rem;
    color: #ffffff;
  }

  .mock-member-role {
    font-size: 0.78rem;
    color: #f59e0b;
    font-weight: 700;
  }

  /* ==========================================================================
     RESPONSIVE MEDIA QUERIES (DESKTOP & MOBILE)
     ========================================================================== */
  @media (max-width: 768px) {
    .header-title {
      font-size: 1.75rem;
    }

    .form-card {
      padding: 1.5rem;
    }

    .banner-stage-box {
      height: 180px;
    }

    .mock-banner-container {
      height: 180px;
    }

    .mock-identity-card {
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 1.5rem;
      gap: 1.25rem;
    }

    .mock-logo-frame {
      width: 90px;
      height: 90px;
    }

    .mock-title {
      font-size: 1.5rem;
    }

    .mock-social-dock {
      justify-content: center;
    }

    .mock-metric-sep {
      display: none;
    }

    .mock-metrics-dock {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      padding: 1.25rem;
    }

    .form-footer-actions {
      flex-direction: column;
      width: 100%;
    }

    .btn-footer-preview,
    .btn-footer-submit {
      width: 100%;
      justify-content: center;
    }
  }
</style>
