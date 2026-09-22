<script lang="ts">
  import { untrack } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { action } from '$lib/actions';
  import { kindLabels, statusLabels, slugify } from '$lib/types';
  import BatchChapterModal from '$lib/components/BatchChapterModal.svelte';
  import {
    ArrowLeft,
    ExternalLink,
    UploadCloud,
    Plus,
    CheckCircle2,
    AlertCircle,
    Archive,
    Save,
    ArrowRight,
    BookOpen,
    Clock,
    FolderArchive,
    Flame,
    Users,
    Zap,
    Shield,
    Trash2,
    AlertTriangle
  } from '@lucide/svelte';

  let { data } = $props();
  const initial = untrack(() => data);

  let title = $state(initial.work?.title || '');
  let slug = $state(initial.work?.slug || '');
  let cover = $state(initial.work?.coverId || '');
  let notice = $state('');
  let noticeType = $state<'info' | 'success' | 'error'>('info');
  let busy = $state(false);
  let uploading = $state(false);
  let showBatchModal = $state(false);
  let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let selected = $state<string[]>(initial.selected);
  let prioritizing = $state(false);

  let selectedScanIds = $state<string[]>((initial.workScans || []).map((ws: any) => ws.scanId));
  let primaryScanId = $state<string>(
    initial.workScans?.find((ws: any) => ws.isPrimary)?.scanId || selectedScanIds[0] || ''
  );
  let applyToExistingChapters = $state(false);
  let applyingScans = $state(false);

  // Danger zone & deletion state (Admin only)
  let showDeleteModal = $state(false);
  let deleteConfirmationText = $state('');
  let preventRecreateWork = $state(Boolean(initial.importerMapping));
  let isDeleting = $state(false);
  let deleteError = $state('');

  function openDeleteModal() {
    deleteConfirmationText = '';
    deleteError = '';
    preventRecreateWork = Boolean(data.importerMapping);
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    if (isDeleting) return;
    showDeleteModal = false;
    deleteConfirmationText = '';
    deleteError = '';
  }

  async function handleDeleteWork() {
    if (!data.work?.id || deleteConfirmationText !== 'EXCLUIR' || isDeleting) return;
    isDeleting = true;
    deleteError = '';
    try {
      const res = await fetch(`/api/admin/works/${data.work.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: deleteConfirmationText,
          preventRecreate: preventRecreateWork
        })
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Falha ao processar exclusão da obra.');
      }
      showDeleteModal = false;
      await goto('/admin/obras?deleted=1', { invalidateAll: true });
    } catch (err: any) {
      deleteError = err.message || 'Erro ao processar exclusão.';
    } finally {
      isDeleting = false;
    }
  }

  async function applyScansToChapters() {
    if (!data.work?.id) return;
    if (!selectedScanIds.length) {
      alert('Selecione pelo menos uma scan antes de aplicar aos capítulos.');
      return;
    }
    const ok = confirm(
      'Deseja replicar as scans selecionadas para TODOS os capítulos existentes desta obra?'
    );
    if (!ok) return;

    applyingScans = true;
    notice = '';
    try {
      // First save the work's scans
      const scansPayload = selectedScanIds.map((sid) => ({
        scanId: sid,
        isPrimary: sid === primaryScanId
      }));
      await action('editor', 'work', {
        id: data.work.id,
        title: title,
        slug: slug,
        scans: scansPayload,
        apply_to_chapters: true
      });
      await invalidateAll();
      noticeType = 'success';
      notice = 'Scans aplicadas com sucesso a todos os capítulos da obra!';
    } catch (e: any) {
      noticeType = 'error';
      notice = (e as any).message || 'Erro ao replicar scans aos capítulos.';
    } finally {
      applyingScans = false;
    }
  }

  async function prioritizeWork() {
    if (!data.work?.id || prioritizing) return;
    prioritizing = true;
    notice = '';
    try {
      const formData = new FormData();
      formData.append('work_id', data.work.id);
      formData.append('reason', 'Priorizado via Ficha da Obra');
      const res = await fetch('/admin/importer?/prioritize', {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      if (!res.ok) throw new Error((result as any).message || 'Erro ao priorizar obra.');
      noticeType = 'success';
      notice = 'Obra priorizada no Importer com sucesso! O worker processar seus capítulos prioritariamente.';
    } catch (e) {
      noticeType = 'error';
      notice = (e as Error).message;
    } finally {
      prioritizing = false;
    }
  }

  async function upload(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    uploading = true;
    notice = '';
    saveState = 'idle';
    try {
      const { normalizeCover } = await import('$lib/uploads');
      const image = await normalizeCover(file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': image.type },
        body: image
      });
      const result = await response.json();
      if (!response.ok) throw new Error((result as any).message || 'Erro ao enviar capa.');
      cover = result.id;
      notice = 'Capa atualizada com sucesso.';
      noticeType = 'success';
    } catch (e) {
      notice = (e as Error).message;
      noticeType = 'error';
    } finally {
      uploading = false;
    }
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    saveState = 'saving';
    notice = '';
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement));
      const result = await action('editor', 'work', {
        ...fields,
        id: data.work?.id,
        aliases: String(fields.aliases)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        tags: selected,
        coverId: cover,
        cover_id: cover,
        scans: selectedScanIds.map((sid) => ({
          scanId: sid,
          scan_id: sid,
          isPrimary: sid === primaryScanId,
          is_primary: sid === primaryScanId
        })),
        apply_to_chapters: applyToExistingChapters,
        applyToChapters: applyToExistingChapters
      });

      if (!data.work) {
        goto(`/admin/obras/${result.id}`);
      } else {
        notice = 'Obra salva com sucesso.';
        noticeType = 'success';
        saveState = 'saved';
        await invalidateAll();
        setTimeout(() => {
          if (saveState === 'saved') saveState = 'idle';
        }, 3000);
      }
    } catch (e) {
      notice = (e as Error).message;
      noticeType = 'error';
      saveState = 'error';
    } finally {
      busy = false;
    }
  }

  async function archive() {
    if (!confirm('Deseja realmente arquivar esta obra? Ela deixará de aparecerá publicamente no catálogo.')) return;
    busy = true;
    notice = '';
    try {
      await action('editor', 'archive', { id: data.work?.id });
      await invalidateAll();
      notice = 'Obra arquivada. Ela no  mais exibida publicamente aos leitores.';
      noticeType = 'info';
    } catch (e) {
      notice = (e as Error).message;
      noticeType = 'error';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>{data.work ? 'Editar ' + data.work.title : 'Nova Obra'} — Nox Editorial</title>
</svelte:head>

<div class="work-editor-shell">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb-bar" aria-label="Navegação">
    <a href="/admin/obras" class="breadcrumb-link">
      <ArrowLeft size={14} />
      <span>Voltar para Obras</span>
    </a>
    <span class="breadcrumb-sep">/</span>
    <span class="breadcrumb-current">{data.work?.title || 'Cadastrar Nova Obra'}</span>
  </nav>

  <!-- Page Header -->
  <header class="page-header">
    <div class="header-titles">
      <span class="eyebrow">FICHA DA OBRA</span>
      <h1 class="page-title">{data.work ? data.work.title : 'Cadastrar Nova Obra'}</h1>
      {#if data.work}
        <span class="slug-preview">/obra/{data.work.slug}</span>
      {/if}
    </div>

    {#if data.work}
      <div class="header-actions">
        <button
          type="button"
          class="btn-prioritize-importer"
          disabled={busy || prioritizing}
          onclick={prioritizeWork}
          title="Solicitar priorização no worker do Importer"
        >
          <Flame size={14} />
          <span>{prioritizing ? 'Priorizando…' : 'Priorizar no Importer'}</span>
        </button>

        {#if data.work.published}
          <a
            href="/obra/{data.work.slug}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-view-public"
          >
            <span>Ver no site público</span>
            <ExternalLink size={14} />
          </a>
        {/if}
      </div>
    {/if}
  </header>

  <!-- Feedback Notice Banner -->
  {#if notice}
    <div
      class="notice-banner"
      class:notice-success={noticeType === 'success'}
      class:notice-error={noticeType === 'error'}
      role="status"
    >
      {#if noticeType === 'success'}
        <CheckCircle2 size={16} />
      {:else if noticeType === 'error'}
        <AlertCircle size={16} />
      {/if}
      <span>{notice}</span>
    </div>
  {/if}

  <!-- Main Work Form -->
  <form class="editor-panel-form" onsubmit={save}>
    <!-- Cover Section Studio -->
    <div class="cover-studio-row">
      <div class="cover-preview-box">
        {#if cover}
          <img src="/media/{cover}" alt="Prévia da capa" width="140" height="198" class="cover-image" />
        {:else}
          <div class="cover-empty-box">
            <BookOpen size={28} />
            <span>Sem capa</span>
          </div>
        {/if}
      </div>

      <div class="cover-actions-col">
        <h3 class="cover-heading">Capa Oficial</h3>
        <p class="cover-hint">
          Selecione uma imagem vertical de alta resolução (proporção aproximada 1:1.4). Formatos suportados: WebP, PNG, JPEG ou GIF animado.
        </p>

        <label class="btn-select-cover" class:disabled={uploading}>
          <UploadCloud size={15} />
          <span>{uploading ? 'Processando capa…' : 'Selecionar Imagem da Capa'}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={uploading}
            onchange={upload}
            style="display:none"
          />
        </label>
      </div>
    </div>

    <!-- Metadata Fields Grid -->
    <div class="fields-grid">
      <!-- Title -->
      <label class="field-wrap col-full">
        <span class="field-label">Título da Obra <strong class="req">*</strong></span>
        <input
          name="title"
          class="field-input"
          bind:value={title}
          oninput={() => {
            if (!data.work) slug = slugify(title);
          }}
          required
          maxlength="200"
          placeholder="Ex: Cu Distante"
        />
      </label>

      <!-- Slug -->
      <label class="field-wrap col-full">
        <span class="field-label">Endereço público (Slug) <strong class="req">*</strong></span>
        <input
          name="slug"
          class="field-input monospace-input"
          bind:value={slug}
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="ex: distante-ceu"
        />
        <small class="field-hint">Endereço permanente da obra: <code>/obra/{slug || 'slug-da-obra'}</code></small>
      </label>

      <!-- Aliases -->
      <label class="field-wrap col-full">
        <span class="field-label">Títulos Alternativos</span>
        <textarea
          name="aliases"
          class="field-textarea"
          rows="2"
          placeholder="Um nome por linha (ex: Distant Sky, Sookhee)"
        >{data.work?.aliases.join('\n') || ''}</textarea>
        <small class="field-hint">Usados para descoberta na busca da plataforma.</small>
      </label>

      <!-- Synopsis -->
      <label class="field-wrap col-full">
        <span class="field-label">Sinopse da Obra <strong class="req">*</strong></span>
        <textarea
          name="synopsis"
          class="field-textarea"
          rows="4"
          maxlength="5000"
          required
          placeholder="Apresentação inicial para os leitores..."
        >{data.work?.synopsis || ''}</textarea>
      </label>

      <!-- Additional Description -->
      <label class="field-wrap col-full">
        <span class="field-label">Descrição Adicional ou Notas</span>
        <textarea
          name="description"
          class="field-textarea"
          rows="3"
          maxlength="10000"
          placeholder="Créditos de tradução, informações contextuais ou avisos..."
        >{data.work?.description || ''}</textarea>
      </label>

      <!-- Author -->
      <label class="field-wrap">
        <span class="field-label">Roteiro / Autor</span>
        <input
          name="author"
          class="field-input"
          value={data.work?.author || ''}
          maxlength="200"
          placeholder="Ex: Inwan Youn"
        />
      </label>

      <!-- Artist -->
      <label class="field-wrap">
        <span class="field-label">Arte / Ilustrador</span>
        <input
          name="artist"
          class="field-input"
          value={data.work?.artist || ''}
          maxlength="200"
          placeholder="Ex: Sunhee Kim"
        />
      </label>

      <!-- Kind / Formato -->
      <label class="field-wrap">
        <span class="field-label">Formato Editorial</span>
        <select name="kind" class="field-select" value={data.work?.kind || 'MANHWA'}>
          {#each Object.entries(kindLabels) as [val, lbl] (val)}
            <option value={val}>{lbl}</option>
          {/each}
        </select>
      </label>

      <!-- Status -->
      <label class="field-wrap">
        <span class="field-label">Status da Publicação</span>
        <select name="status" class="field-select" value={data.work?.status || 'ONGOING'}>
          {#each ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED'] as val (val)}
            <option value={val}>{statusLabels[val]}</option>
          {/each}
        </select>
      </label>

      <!-- Year -->
      <label class="field-wrap">
        <span class="field-label">Ano de Lançamento</span>
        <input
          name="year"
          type="number"
          min="1900"
          max="2200"
          class="field-input"
          value={data.work?.year || ''}
          placeholder="Ex: 2024"
        />
      </label>

      <!-- Age Rating -->
      <label class="field-wrap">
        <span class="field-label">Classificação Indicativa</span>
        <select name="age_rating" class="field-select" value={data.work?.ageRating ?? 12}>
          {#each [0, 10, 12, 14, 16, 18] as val (val)}
            <option value={val}>{val === 0 ? 'Livre' : `${val} anos`}</option>
          {/each}
        </select>
      </label>

      <!-- Content Rating (+18) -->
      <label class="field-wrap col-full">
        <span class="field-label">Classificação Editorial de Conteúdo (+18)</span>
        <select name="content_rating" class="field-select" value={(data.work as any)?.contentRating || 'GENERAL'}>
          <option value="GENERAL">Geral — Recomendado para todos os leitores</option>
          <option value="ADULT_18">Adulto (+18) — Conteúdo adulto/explícito (aplica tags automáticas e blur)</option>
        </select>
        <small class="field-hint">Obras marcadas como Adulto (+18) recebem a tag "Adulto (+18)" (e "Pornhwa" se for Manhwa) e tm capas borradas por padrão para proteção de menores.</small>
      </label>
    </div>

    <!-- Tags & Gêneros Selector -->
    <fieldset class="tags-fieldset">
      <legend class="tags-legend">Gêneros e Categorias Associadas</legend>
      <div class="tag-chips-wrap">
        {#each data.tags as tag (tag?.id)}
          <label class="tag-chip-label" class:active={selected.includes(tag.id)}>
            <input type="checkbox" bind:group={selected} value={tag.id} class="tag-checkbox" />
            <span class="tag-prefix">{tag.kind === 'GENRE' ? '◈' : '#'}</span>
            <span class="tag-name">{tag.name}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <!-- Scans / Tradução Selector -->
    <fieldset class="scans-fieldset">
      <div class="scans-fieldset-header">
        <div>
          <legend class="scans-legend">
            <Users size={15} />
            <span>Scans / Tradução & Créditos</span>
          </legend>
          <p class="scans-subtext">
            Associe as scans parceiras ou a scan oficial Project Nox a esta obra. Obras sem scan selecionada no exibiro scan falsa publicamente.
          </p>
        </div>

        {#if data.work?.id}
          <button
            type="button"
            class="btn-apply-chapters"
            onclick={applyScansToChapters}
            disabled={busy || applyingScans || !selectedScanIds.length}
            title="Replicar imediatamente estas scans para todos os capítulos desta obra"
          >
            <Zap size={14} />
            <span>{applyingScans ? 'Replicando…' : 'Replicar nos Capítulos'}</span>
          </button>
        {/if}
      </div>

      <div class="scans-chips-wrap">
        {#each data.allScans as scan (scan.id)}
          <label class="scan-chip-label" class:active={selectedScanIds.includes(scan.id)} class:is-official={scan.isOfficial}>
            <input
              type="checkbox"
              bind:group={selectedScanIds}
              value={scan.id}
              class="scan-checkbox"
              onchange={() => {
                if (!selectedScanIds.includes(primaryScanId)) {
                  primaryScanId = selectedScanIds[0] || '';
                }
              }}
            />
            {#if scan.isOfficial}
              <Shield size={13} class="icon-gold" />
            {/if}
            <span class="scan-name">{scan.name}</span>
            {#if scan.isOfficial}
              <span class="badge-official-mini">OFICIAL</span>
            {/if}
          </label>
        {/each}

        {#if !data.allScans?.length}
          <p class="no-scans-text">Nenhuma scan cadastrada no sistema. Cadastre na <a href="/admin/scans">Gestão de Scans</a>.</p>
        {/if}
      </div>

      {#if selectedScanIds.length > 1}
        <div class="primary-scan-row">
          <label for="primary-scan-select" class="field-label-sm">Scan Principal (Destaque editorial):</label>
          <select id="primary-scan-select" class="primary-select" bind:value={primaryScanId}>
            {#each data.allScans.filter((s: any) => selectedScanIds.includes(s.id)) as s (s.id)}
              <option value={s.id}>{s.name} {s.isOfficial ? '(Oficial Nox)' : ''}</option>
            {/each}
          </select>
        </div>
      {/if}

      {#if data.work?.id}
        <div class="scans-options-row">
          <label class="checkbox-option">
            <input type="checkbox" bind:checked={applyToExistingChapters} />
            <span>Replicar estas scans para todos os capítulos existentes ao salvar esta obra</span>
          </label>
        </div>
      {/if}
    </fieldset>

    <!-- Save & Action Footer -->
    <div class="form-actions-footer">
      <button type="submit" class="btn-submit-save" disabled={busy || uploading}>
        {#if saveState === 'saving'}
          <span>Salvando obra…</span>
        {:else if saveState === 'saved'}
          <CheckCircle2 size={16} />
          <span>Obra Salva!</span>
        {:else}
          <Save size={16} />
          <span>{data.work ? 'Salvar Alterações' : 'Cadastrar Obra'}</span>
        {/if}
      </button>

      {#if data.work?.published}
        <button
          type="button"
          class="btn-archive-work"
          onclick={archive}
          disabled={busy}
          title="Arquivar obra e ocultar do catálogo público"
        >
          <Archive size={15} />
          <span>Arquivar Obra</span>
        </button>
      {/if}
    </div>
  </form>

  <!-- Chapters Section -->
  {#if data.work}
    <section class="chapters-section">
      <div class="chapters-header">
        <div class="chapters-title-cluster">
          <div class="chapters-title-row">
            <h2 class="chapters-title">Capítulos</h2>
            <span class="chapters-count-pill">{data.chapters.length}</span>
          </div>
          <span class="chapters-subtitle">Acompanhe páginas, rascunhos e publicação da obra</span>
        </div>

        <div class="chapters-action-buttons">
          <button
            type="button"
            class="btn-batch-zip"
            onclick={() => (showBatchModal = true)}
          >
            <FolderArchive size={15} />
            <span>Importar Lote (ZIP)</span>
          </button>
          <a
            href="/admin/obras/{data.work.id}/capitulos/novo"
            class="btn-add-chapter"
          >
            <Plus size={15} />
            <span>Adicionar Capítulo</span>
          </a>
        </div>
      </div>

      {#if data.chapters.length > 0}
        <div class="chapters-table-card">
          <table class="chapters-table">
            <thead>
              <tr>
                <th>Capítulo</th>
                <th>Status</th>
                <th>Data</th>
                <th class="th-action">Ao</th>
              </tr>
            </thead>
            <tbody>
              {#each data.chapters as ch (ch.id)}
                <tr class="chapter-row">
                  <td class="td-ch-title">
                    <strong class="ch-num">Capítulo {ch.number}</strong>
                    {#if ch.title}
                      <span class="ch-desc">— {ch.title}</span>
                    {/if}
                  </td>
                  <td class="td-ch-status">
                    {#if ch.publishedAt}
                      <span class="status-badge status-live">
                        <CheckCircle2 size={11} />
                        <span>Publicado</span>
                      </span>
                    {:else}
                      <span class="status-badge status-draft">
                        <Clock size={11} />
                        <span>Rascunho</span>
                      </span>
                    {/if}
                  </td>
                  <td class="td-ch-date">
                    <span>{ch.publishedAt ? new Date(ch.publishedAt).toLocaleDateString('pt-BR') : '—'}</span>
                  </td>
                  <td class="td-ch-action">
                    <a
                      href="/admin/obras/{data.work.id}/capitulos/{ch.id}"
                      class="btn-open-editor"
                    >
                      <span>Abrir Editor</span>
                      <ArrowRight size={13} />
                    </a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="empty-chapters-card">
          <BookOpen size={30} class="empty-ch-icon" />
          <h3>Nenhum capítulo cadastrado ainda</h3>
          <p>Adicione o primeiro capítulo para iniciar a leitura desta obra.</p>
          <div class="empty-action-row">
            <button
              type="button"
              class="btn-batch-zip"
              onclick={() => (showBatchModal = true)}
            >
              <FolderArchive size={15} />
              <span>Importar Lote (ZIP)</span>
            </button>
            <a
              href="/admin/obras/{data.work.id}/capitulos/novo"
              class="btn-primary-add-first"
            >
              <Plus size={15} />
              <span>Cadastrar Capítulo 1</span>
            </a>
          </div>
        </div>
      {/if}
    </section>
  {/if}

  <!-- ZONA DE PERIGO (Somente Administrador) -->
  {#if data.role === 'ADMIN' && data.work}
    <section class="danger-zone-section" aria-labelledby="danger-zone-heading">
      <div class="danger-zone-header">
        <span class="danger-zone-badge">ZONA DE PERIGO</span>
      </div>
      <div class="danger-zone-card">
        <div class="danger-zone-copy">
          <h3 id="danger-zone-heading" class="danger-zone-title">Excluir obra</h3>
          <p class="danger-zone-desc">
            Esta ação removerá permanentemente esta obra e os dados diretamente associados a ela.
          </p>
        </div>
        <button
          type="button"
          class="btn-trigger-delete"
          onclick={openDeleteModal}
        >
          <Trash2 size={15} />
          <span>Excluir Obra</span>
        </button>
      </div>
    </section>
  {/if}

  <!-- MODAL DE CONFIRMAÇÃO DESTRUTIVA -->
  {#if showDeleteModal && data.work}
    <div class="modal-backdrop-danger" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
      <div class="modal-card-danger">
        <div class="modal-header-danger">
          <div class="modal-icon-alert">
            <AlertTriangle size={24} />
          </div>
          <div class="modal-title-wrap">
            <span class="modal-eyebrow-alert">AÇÃO DESTRUTIVA IRREVERSÍVEL</span>
            <h2 id="delete-modal-title" class="modal-heading-danger">Excluir obra permanentemente?</h2>
          </div>
        </div>

        <div class="modal-body-danger">
          <p class="modal-intro-text">
            Esta ação removerá permanentemente esta obra e os dados diretamente associados a ela do banco de dados.
          </p>

          <!-- Resumo do impacto real da exclusão -->
          <div class="impact-summary-box">
            <div class="impact-summary-title">Resumo do impacto real da exclusão:</div>
            <div class="impact-summary-grid">
              <div class="impact-item">
                <span class="impact-item-label">Nome da obra</span>
                <span class="impact-item-val font-semibold">{data.work.title}</span>
              </div>
              <div class="impact-item">
                <span class="impact-item-label">Slug público</span>
                <span class="impact-item-val monospace-val">/obra/{data.work.slug}</span>
              </div>
              <div class="impact-item">
                <span class="impact-item-label">Capítulos que serão apagados</span>
                <span class="impact-item-val text-crimson font-bold">{data.chapterCount} capítulo(s)</span>
              </div>
              <div class="impact-item">
                <span class="impact-item-label">Páginas que serão apagadas</span>
                <span class="impact-item-val text-crimson font-bold">{data.pageCount} página(s)</span>
              </div>
              <div class="impact-item col-full">
                <span class="impact-item-label">Fonte do Importer</span>
                {#if data.importerMapping}
                  <span class="importer-mapping-pill">
                    Fonte: <strong>{data.importerMapping.source}</strong> &bull; ID Externo: <code>{data.importerMapping.sourceWorkId}</code>
                  </span>
                {:else}
                  <span class="importer-none-pill">Nenhum vínculo do Importer detectado</span>
                {/if}
              </div>
            </div>
          </div>

          <!-- Checkbox de proteção contra o Importer (CRÍTICO) -->
          <label class="importer-protect-container">
            <input
              type="checkbox"
              bind:checked={preventRecreateWork}
              class="importer-checkbox"
            />
            <div class="importer-protect-text">
              <span class="importer-protect-headline">Impedir que o Importer recrie esta obra</span>
              <span class="importer-protect-caption">
                Gera um tombstone no Importer (status IGNORED / congelado por exclusão manual). Evita que a obra seja reimportada em sincronizações futuras.
              </span>
            </div>
          </label>

          <!-- Confirmação digitada obrigatória -->
          <div class="typed-confirm-container">
            <label for="delete-confirmation-input" class="typed-confirm-label">
              Para confirmar, digite exatamente <strong class="code-word">EXCLUIR</strong>:
            </label>
            <input
              id="delete-confirmation-input"
              type="text"
              class="typed-confirm-input"
              bind:value={deleteConfirmationText}
              placeholder="EXCLUIR"
              autocomplete="off"
              disabled={isDeleting}
            />
          </div>

          {#if deleteError}
            <div class="delete-error-alert" role="alert">
              <AlertCircle size={16} />
              <span>{deleteError}</span>
            </div>
          {/if}
        </div>

        <div class="modal-footer-danger">
          <button
            type="button"
            class="btn-modal-cancel"
            onclick={closeDeleteModal}
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-modal-delete-submit"
            disabled={deleteConfirmationText !== 'EXCLUIR' || isDeleting}
            onclick={handleDeleteWork}
          >
            {#if isDeleting}
              <span>Excluindo obra e dados…</span>
            {:else}
              <Trash2 size={15} />
              <span>Sim, excluir obra e dados</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showBatchModal && data.work}
    <BatchChapterModal
      work={data.work}
      existingChapters={data.chapters}
      onClose={() => (showBatchModal = false)}
      onSuccess={async () => {
        showBatchModal = false;
        await invalidateAll();
      }}
    />
  {/if}
</div>

<style>
  .work-editor-shell {
    display: flex;
    flex-direction: column;
    gap: 22px;
    width: 100%;
    max-width: 1100px;
  }

  /* Breadcrumb */
  .breadcrumb-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
  }

  .breadcrumb-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #98a2b8;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s ease;
  }

  .breadcrumb-link:hover {
    color: #dfc28d;
  }

  .breadcrumb-sep {
    color: #4b5263;
  }

  .breadcrumb-current {
    color: #e2e7f2;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Page Header */
  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .eyebrow {
    font-size: 11px;
    font-weight: 750;
    color: #dfc28d;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .page-title {
    margin: 0;
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: clamp(1.6rem, 2.8vw, 2.1rem);
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .slug-preview {
    font-size: 12px;
    color: #7b8396;
    font-family: monospace;
  }

  .btn-view-public {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d5d9e6;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-view-public:hover {
    background: rgba(223, 194, 141, 0.12);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
  }

  .btn-prioritize-importer {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-prioritize-importer:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.25);
    border-color: rgba(245, 158, 11, 0.6);
    transform: translateY(-1px);
  }

  .btn-prioritize-importer:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Notice */
  .notice-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 9px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #7dd3fc;
    font-size: 13px;
  }

  .notice-banner.notice-success {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
  }

  .notice-banner.notice-error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  /* Form Container */
  .editor-panel-form {
    display: flex;
    flex-direction: column;
    gap: 28px;
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 26px;
    backdrop-filter: blur(14px);
  }

  /* Cover Studio */
  .cover-studio-row {
    display: flex;
    align-items: center;
    gap: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cover-preview-box {
    width: 140px;
    height: 198px;
    border-radius: 10px;
    overflow: hidden;
    background: #121420;
    border: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }

  .cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .cover-empty-box {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #646b80;
    font-size: 11px;
    font-weight: 600;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 10px;
  }

  .cover-actions-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cover-heading {
    margin: 0;
    font-size: 15px;
    font-weight: 750;
    color: #ffffff;
  }

  .cover-hint {
    margin: 0;
    font-size: 12px;
    color: #7b8396;
    max-width: 480px;
    line-height: 1.5;
  }

  .btn-select-cover {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #ffffff;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    width: fit-content;
    margin-top: 4px;
    transition: all 0.2s ease;
  }

  .btn-select-cover:hover {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
  }

  .btn-select-cover.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  /* Fields Grid */
  .fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px 20px;
  }

  .col-full {
    grid-column: 1 / -1;
  }

  .field-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 650;
    color: #b5bdd0;
  }

  .req {
    color: #f43f5e;
  }

  .field-input,
  .field-select,
  .field-textarea {
    background: rgba(20, 24, 38, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 10px 14px;
    color: #ffffff;
    font-size: 13px;
    outline: none;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .field-input:focus,
  .field-select:focus,
  .field-textarea:focus {
    border-color: rgba(223, 194, 141, 0.45);
    box-shadow: 0 0 14px rgba(223, 194, 141, 0.15);
    background: rgba(24, 30, 48, 0.95);
  }

  .monospace-input {
    font-family: monospace;
    color: #cbb4ff;
  }

  .field-textarea {
    resize: vertical;
    line-height: 1.6;
  }

  .field-hint {
    font-size: 11px;
    color: #646b80;
  }

  .field-hint code {
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.08);
    padding: 1px 4px;
    border-radius: 4px;
  }

  /* Tags Fieldset */
  .tags-fieldset {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 14px 18px 18px;
    background: rgba(18, 22, 34, 0.4);
  }

  .tags-legend {
    font-size: 11.5px;
    font-weight: 700;
    color: #8c93a8;
    padding: 0 8px;
    letter-spacing: 0.04em;
  }

  .tag-chips-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }

  .tag-chip-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11.5px;
    color: #98a2b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tag-chip-label:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .tag-chip-label.active {
    background: rgba(181, 154, 245, 0.15);
    border-color: rgba(181, 154, 245, 0.4);
    color: #ffffff;
    font-weight: 600;
  }

  .tag-checkbox {
    accent-color: #b59af5;
  }

  .tag-prefix {
    color: #dfc28d;
    font-size: 10px;
  }

  /* Scans Fieldset */
  .scans-fieldset {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 16px 20px 20px;
    background: rgba(18, 22, 34, 0.5);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .scans-fieldset-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }

  .scans-legend {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 750;
    color: #dfc28d;
    letter-spacing: 0.02em;
    padding: 0 4px;
  }

  .scans-subtext {
    font-size: 12px;
    color: #8c899e;
    margin: 4px 0 0;
  }

  .btn-apply-chapters {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 8px;
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-apply-chapters:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.6);
    color: #ffffff;
  }

  .btn-apply-chapters:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .scans-chips-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .scan-chip-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 13px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 12px;
    color: #b5b1c7;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .scan-chip-label:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .scan-chip-label.active {
    background: rgba(139, 92, 246, 0.18);
    border-color: rgba(139, 92, 246, 0.5);
    color: #ffffff;
    font-weight: 600;
  }

  .scan-chip-label.is-official {
    border-color: rgba(201, 170, 115, 0.3);
  }

  .scan-chip-label.is-official.active {
    background: rgba(201, 170, 115, 0.18);
    border-color: rgba(201, 170, 115, 0.6);
    color: #fef08a;
  }

  .scan-checkbox {
    accent-color: #8b5cf6;
    cursor: pointer;
  }

  :global(.icon-gold) {
    color: #dfc28d;
  }

  .badge-official-mini {
    font-size: 8.5px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(201, 170, 115, 0.2);
    color: #dfc28d;
    border: 1px solid rgba(201, 170, 115, 0.4);
    letter-spacing: 0.06em;
  }

  .no-scans-text {
    font-size: 12px;
    color: #8c899e;
    margin: 0;
  }

  .no-scans-text a {
    color: #c4b5fd;
  }

  .primary-scan-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 6px;
    flex-wrap: wrap;
  }

  .field-label-sm {
    font-size: 12px;
    font-weight: 600;
    color: #dfc28d;
  }

  .primary-select {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 6px 12px;
    color: #ffffff;
    font-size: 12px;
    outline: none;
  }

  .scans-options-row {
    padding-top: 4px;
  }

  .checkbox-option {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #b5b1c7;
    cursor: pointer;
  }

  .checkbox-option input {
    accent-color: #8b5cf6;
    cursor: pointer;
  }

  /* Footer Actions */
  .form-actions-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .btn-submit-save {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    border-radius: 9px;
    background: linear-gradient(135deg, #dfc28d 0%, #c49c5e 100%);
    color: #0d0c14;
    font-size: 13px;
    font-weight: 750;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(223, 194, 141, 0.35);
    transition: all 0.2s ease;
  }

  .btn-submit-save:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(223, 194, 141, 0.5);
  }

  .btn-submit-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-archive-work {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 16px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #c5cbd8;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-archive-work:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .admin-danger-zone {
    margin-top: 4px;
  }

  /* Chapters Section */
  .chapters-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 12px;
  }

  .chapters-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .chapters-title-cluster {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .chapters-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chapters-title {
    margin: 0;
    font-family: var(--font-heading, 'Manrope', sans-serif);
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
  }

  .chapters-count-pill {
    font-size: 11px;
    font-weight: 750;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(181, 154, 245, 0.15);
    color: #cbb4ff;
    border: 1px solid rgba(181, 154, 245, 0.3);
  }

  .chapters-subtitle {
    font-size: 12px;
    color: #7b8396;
  }

  .chapters-action-buttons {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .btn-batch-zip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(181, 154, 245, 0.12);
    border: 1px solid rgba(181, 154, 245, 0.3);
    color: #e2d9fc;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-batch-zip:hover {
    background: rgba(181, 154, 245, 0.22);
    border-color: rgba(181, 154, 245, 0.5);
    color: #ffffff;
  }

  .btn-add-chapter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.3);
    color: #dfc28d;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-add-chapter:hover {
    background: rgba(223, 194, 141, 0.22);
    border-color: rgba(223, 194, 141, 0.5);
  }

  .empty-action-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }

  /* Chapters Table */
  .chapters-table-card {
    background: rgba(13, 16, 26, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    overflow: hidden;
    backdrop-filter: blur(14px);
  }

  .chapters-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .chapters-table th {
    background: rgba(18, 22, 34, 0.6);
    padding: 11px 16px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #7b8396;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .chapter-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.15s ease;
  }

  .chapter-row:hover {
    background: rgba(22, 28, 44, 0.4);
  }

  .chapter-row:last-child {
    border-bottom: none;
  }

  .chapters-table td {
    padding: 12px 16px;
    vertical-align: middle;
  }

  .td-ch-title {
    color: #ffffff;
  }

  .ch-num {
    color: #ffffff;
    font-weight: 750;
  }

  .ch-desc {
    color: #8c93a8;
    margin-left: 4px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 650;
  }

  .status-live {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
  }

  .status-draft {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  .th-action,
  .td-ch-action {
    text-align: right;
  }

  .btn-open-editor {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    color: #d2d8e6;
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .btn-open-editor:hover {
    background: rgba(223, 194, 141, 0.15);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    transform: translateX(2px);
  }

  /* Empty Chapters Card */
  .empty-chapters-card {
    padding: 40px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    border-radius: 12px;
    background: rgba(13, 16, 26, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.08);
  }

  :global(.empty-ch-icon) {
    color: #dfc28d;
  }

  .empty-chapters-card h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 750;
    color: #ffffff;
  }

  .empty-chapters-card p {
    margin: 0;
    font-size: 12px;
    color: #7b8396;
  }

  .btn-primary-add-first {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    background: rgba(223, 194, 141, 0.15);
    border: 1px solid rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    margin-top: 4px;
    transition: all 0.2s ease;
  }

  .btn-primary-add-first:hover {
    background: rgba(223, 194, 141, 0.25);
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
    }

    .header-actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-prioritize-importer,
    .btn-view-public {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }

    .cover-studio-row {
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 20px 14px;
    }

    .cover-preview-box {
      margin: 0 auto;
    }

    .cover-actions-col {
      align-items: center;
      width: 100%;
    }

    .btn-select-cover {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }

    .fields-grid {
      grid-template-columns: 1fr;
      gap: 16px;
      width: 100%;
    }

    .field-wrap {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .field-input,
    .field-textarea,
    .field-select {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      font-size: 15px;
    }

    .tag-chips-wrap {
      max-height: 250px;
      overflow-y: auto;
      gap: 8px;
    }

    .tag-chip-label {
      padding: 7px 12px;
      font-size: 12.5px;
    }

    .form-actions-footer {
      flex-direction: column;
      width: 100%;
      gap: 10px;
    }

    .btn-submit-save,
    .btn-archive-work {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }

    .chapters-header {
      flex-direction: column;
      align-items: stretch;
      gap: 14px;
    }

    .chapters-action-buttons {
      flex-direction: column;
      width: 100%;
      gap: 8px;
    }

    .btn-batch-zip,
    .btn-add-chapter {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }
  }

  /* ==========================================================================
     ZONA DE PERIGO & MODAL DESTRUTIVO (Somente Administrador)
     ========================================================================== */
  .danger-zone-section {
    margin-top: 36px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .danger-zone-header {
    display: flex;
    align-items: center;
  }

  .danger-zone-badge {
    font-size: 11px;
    font-weight: 800;
    color: #f87171;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .danger-zone-card {
    background: rgba(239, 68, 68, 0.03);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 12px;
    padding: 20px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .danger-zone-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .danger-zone-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #fca5a5;
  }

  .danger-zone-desc {
    margin: 0;
    font-size: 13.5px;
    color: #9ca3af;
    line-height: 1.4;
  }

  .btn-trigger-delete {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .btn-trigger-delete:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.6);
    color: #ffffff;
    box-shadow: 0 0 16px rgba(239, 68, 68, 0.25);
  }

  /* Modal Backdrop & Card */
  .modal-backdrop-danger {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  }

  .modal-card-danger {
    width: 100%;
    max-width: 560px;
    background: #12141a;
    border: 1px solid rgba(239, 68, 68, 0.35);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(239, 68, 68, 0.15);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes modalPopIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header-danger {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 24px 24px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(239, 68, 68, 0.06);
  }

  .modal-icon-alert {
    color: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(239, 68, 68, 0.16);
    border: 1px solid rgba(239, 68, 68, 0.35);
    flex-shrink: 0;
  }

  .modal-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .modal-eyebrow-alert {
    font-size: 10.5px;
    font-weight: 800;
    color: #f87171;
    letter-spacing: 0.1em;
  }

  .modal-heading-danger {
    margin: 0;
    font-size: 19px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.01em;
  }

  .modal-body-danger {
    padding: 22px 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    box-sizing: border-box;
  }

  .modal-intro-text {
    margin: 0;
    font-size: 13.5px;
    color: #d1d5db;
    line-height: 1.5;
  }

  .impact-summary-box {
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .impact-summary-title {
    font-size: 11.5px;
    font-weight: 750;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .impact-summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .impact-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .impact-item.col-full {
    grid-column: 1 / -1;
  }

  .impact-item-label {
    font-size: 11px;
    color: #6b7280;
  }

  .impact-item-val {
    font-size: 13.5px;
    color: #e5e7eb;
  }

  .text-crimson {
    color: #f87171;
  }

  .font-semibold {
    font-weight: 600;
  }

  .font-bold {
    font-weight: 700;
  }

  .monospace-val {
    font-family: monospace;
    font-size: 12.5px;
  }

  .importer-mapping-pill {
    font-size: 12px;
    color: #d1d5db;
    background: rgba(255, 255, 255, 0.05);
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: inline-block;
  }

  .importer-none-pill {
    font-size: 12px;
    color: #6b7280;
    font-style: italic;
  }

  .importer-protect-container {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.2);
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .importer-protect-container:hover {
    border-color: rgba(239, 68, 68, 0.35);
  }

  .importer-checkbox {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    accent-color: #ef4444;
    cursor: pointer;
    flex-shrink: 0;
  }

  .importer-protect-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .importer-protect-headline {
    font-size: 13px;
    font-weight: 700;
    color: #fca5a5;
  }

  .importer-protect-caption {
    font-size: 11.5px;
    color: #9ca3af;
    line-height: 1.4;
  }

  .typed-confirm-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .typed-confirm-label {
    font-size: 13px;
    color: #d1d5db;
  }

  .code-word {
    color: #f87171;
    font-family: monospace;
    font-size: 13.5px;
    background: rgba(239, 68, 68, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .typed-confirm-input {
    width: 100%;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 10px 14px;
    color: #ffffff;
    font-family: monospace;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .typed-confirm-input:focus {
    outline: none;
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25);
  }

  .delete-error-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    font-size: 13px;
  }

  .modal-footer-danger {
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }

  .btn-modal-cancel {
    padding: 9px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #d1d5db;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-modal-cancel:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  .btn-modal-delete-submit {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    border-radius: 8px;
    background: #dc2626;
    border: 1px solid #ef4444;
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);
  }

  .btn-modal-delete-submit:hover:not(:disabled) {
    background: #b91c1c;
    border-color: #dc2626;
    box-shadow: 0 4px 18px rgba(220, 38, 38, 0.5);
  }

  .btn-modal-delete-submit:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }

  @media (max-width: 640px) {
    .danger-zone-card {
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
    }

    .btn-trigger-delete {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }

    .impact-summary-grid {
      grid-template-columns: 1fr;
    }

    .modal-footer-danger {
      flex-direction: column-reverse;
      gap: 8px;
    }

    .btn-modal-cancel,
    .btn-modal-delete-submit {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }
  }
</style>
