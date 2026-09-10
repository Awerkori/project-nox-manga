<script lang="ts">
  import { Flag, X, AlertTriangle, CheckCircle2 } from '@lucide/svelte';

  let {
    open = $bindable(true),
    targetType,
    workId,
    chapterId,
    commentId,
    targetTitle,
    pageNumber,
    onclose,
    onsuccess
  }: {
    open?: boolean;
    targetType: 'WORK' | 'CHAPTER' | 'COMMENT' | 'USER';
    workId?: string;
    chapterId?: string;
    commentId?: string;
    targetTitle?: string;
    pageNumber?: number;
    onclose?: () => void;
    onsuccess?: () => void;
  } = $props();

  let selectedReason = $state('');
  let customReason = $state('');
  let details = $state('');
  let loading = $state(false);
  let submitted = $state(false);
  let errorMessage = $state('');

  const REASONS_BY_TYPE = {
    WORK: [
      'Informações incorretas (título, capa ou sinopse)',
      'Metadados errados (autor, artista, tipo ou status)',
      'Gêneros ou tags incorretos',
      'Conteúdo adulto sem classificação +18',
      'Capítulos faltando, duplicados ou fora de ordem',
      'Obra duplicada no catálogo',
      'Violação das diretrizes da comunidade',
      'Outro motivo'
    ],
    CHAPTER: [
      'Imagens quebradas ou falha no carregamento',
      'Páginas faltando ou incompletas',
      'Páginas fora de ordem',
      'Capítulo incorreto, arquivo errado ou numeração trocada',
      'Capítulo duplicado',
      'Tradução ilegível ou em outro idioma',
      'Outro motivo'
    ],
    COMMENT: [
      'Spam, divulgação ou link suspeito',
      'Assédio, ofensas ou discurso de ódio',
      'Spoiler não marcado',
      'Conteúdo impróprio ou abusivo',
      'Impersonação (se passando por outro usuário/staff)',
      'Outro motivo'
    ],
    USER: [
      'Spam ou conta automatizada (bot)',
      'Assédio, ofensas ou comportamento tóxico',
      'Foto de perfil, nome ou bio impróprios',
      'Impersonação de outro usuário ou staff',
      'Abuso do sistema ou conduta nociva',
      'Outro motivo'
    ]
  };

  let reasons = $derived(REASONS_BY_TYPE[targetType] || REASONS_BY_TYPE.WORK);

  function handleClose() {
    open = false;
    submitted = false;
    errorMessage = '';
    selectedReason = '';
    customReason = '';
    details = '';
    onclose?.();
  }

  async function submitReport() {
    const finalReason = selectedReason === 'Outro motivo' ? customReason.trim() : selectedReason;
    if (!finalReason) {
      errorMessage = 'Selecione ou descreva o motivo do reporte.';
      return;
    }

    loading = true;
    errorMessage = '';

    const pagePrefix = pageNumber ? `[Página ${pageNumber}] ` : '';
    const finalDetails = details.trim() ? `${pagePrefix}${details.trim()}` : (pagePrefix ? `[Página ${pageNumber}]` : '');

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          workId,
          chapterId,
          commentId,
          reason: finalReason,
          details: finalDetails
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao enviar reporte.');
      }

      submitted = true;
      onsuccess?.();
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      errorMessage = err.message || 'Falha ao processar solicitação.';
    } finally {
      loading = false;
    }
  }
</script>

{#if open}
  <div class="modal-backdrop" onclick={handleClose} onkeydown={(e) => { if (e.key === 'Escape') handleClose(); }} role="presentation">
    <div class="modal-container" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <header class="modal-header">
        <div class="header-title-cluster">
          <div class="flag-icon-wrap">
            <Flag size={18} />
          </div>
          <div>
            <h3 class="modal-title">Reportar Conteúdo</h3>
            {#if targetTitle}
              <p class="modal-sub">{targetTitle}</p>
            {/if}
            {#if pageNumber}
              <span class="page-context-chip">Página {pageNumber}</span>
            {/if}
          </div>
        </div>

        <button type="button" class="btn-close" onclick={handleClose} aria-label="Fechar">
          <X size={18} />
        </button>
      </header>

      {#if submitted}
        <div class="modal-success-state">
          <div class="success-icon">
            <CheckCircle2 size={36} />
          </div>
          <h4 class="success-heading">Reporte Enviado</h4>
          <p class="success-text">
            Obrigado por ajudar a manter a comunidade da Project Nox saudável. Nossa equipe editorial irá analisar.
          </p>
        </div>
      {:else}
        <form onsubmit={(e) => { e.preventDefault(); submitReport(); }} class="modal-form">
          {#if errorMessage}
            <div class="error-banner">
              <AlertTriangle size={15} />
              <span>{errorMessage}</span>
            </div>
          {/if}

          <div class="form-group">
            <span class="form-label">Qual o motivo do reporte?</span>
            <div class="reason-options">
              {#each reasons as r}
                <label class="reason-option-label" class:selected={selectedReason === r}>
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    bind:group={selectedReason}
                    class="radio-input"
                  />
                  <span>{r}</span>
                </label>
              {/each}
            </div>
          </div>

          {#if selectedReason === 'Outro motivo'}
            <div class="form-group">
              <label for="custom-reason" class="form-label">Descreva o motivo brevemente:</label>
              <input
                id="custom-reason"
                type="text"
                bind:value={customReason}
                maxlength="120"
                class="form-input"
                placeholder="Ex: tradução confusa / marca d'água de outro grupo..."
                required
              />
            </div>
          {/if}

          <div class="form-group">
            <label for="report-details" class="form-label">Detalhes adicionais (opcional):</label>
            <textarea
              id="report-details"
              bind:value={details}
              rows="3"
              class="form-textarea"
              placeholder="Forneça mais contexto ou indique páginas específicas se aplicável..."
              maxlength="2000"
            ></textarea>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-cancel" onclick={handleClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" class="btn-submit" disabled={loading || !selectedReason}>
              {loading ? 'Enviando...' : 'Enviar Reporte'}
            </button>
          </footer>
        </form>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .modal-container {
    background: #10141f;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .header-title-cluster {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .flag-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-title {
    margin: 0;
    font-size: 16px;
    font-weight: 750;
    color: #ffffff;
  }

  .modal-sub {
    margin: 2px 0 0;
    font-size: 12px;
    color: #7b8396;
    max-width: 320px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #646b80;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: color 0.15s;
  }

  .btn-close:hover {
    color: #ffffff;
  }

  .modal-form {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12.5px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 12px;
    font-weight: 700;
    color: #cbd5e1;
  }

  .reason-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .reason-option-label {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #94a3b8;
    transition: all 0.15s;
  }

  .reason-option-label:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
  }

  .reason-option-label.selected {
    background: rgba(223, 194, 141, 0.1);
    border-color: rgba(223, 194, 141, 0.35);
    color: #dfc28d;
    font-weight: 600;
  }

  .radio-input {
    accent-color: #dfc28d;
  }

  .form-input,
  .form-textarea {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #ffffff;
    padding: 9px 12px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
    font-family: inherit;
  }

  .form-input:focus,
  .form-textarea:focus {
    border-color: #dfc28d;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 8px;
  }

  .btn-cancel {
    padding: 8px 16px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-submit {
    padding: 8px 18px;
    border-radius: 8px;
    background: linear-gradient(135deg, #dfc28d 0%, #b59af5 100%);
    border: none;
    color: #0b0d14;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-success-state {
    padding: 40px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .success-icon {
    color: #10b981;
  }

  .success-heading {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
  }

  .success-text {
    margin: 0;
    font-size: 13.5px;
    color: #94a3b8;
    line-height: 1.5;
    max-width: 360px;
  }

  .page-context-chip {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.25);
    padding: 1px 6px;
    border-radius: 4px;
    margin-top: 3px;
  }

  @media (max-width: 600px) {
    .modal-backdrop {
      align-items: flex-end;
      padding: 0;
    }

    .modal-container {
      max-width: 100%;
      border-radius: 20px 20px 0 0;
      max-height: 90vh;
      overflow-y: auto;
      border-bottom: none;
      animation: sheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
  }

  @keyframes sheetSlideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
</style>
