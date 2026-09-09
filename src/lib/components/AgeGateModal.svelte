<script lang="ts">
  import { ShieldAlert, Eye, EyeOff, Check, AlertTriangle } from '@lucide/svelte';
  import { setAgeStatus, setBlurNsfw, type AgeStatus } from '$lib/preferences';
  import { action } from '$lib/actions';
  import { invalidateAll } from '$app/navigation';

  let {
    status = 'UNKNOWN',
    isLoggedIn = false
  }: {
    status?: AgeStatus;
    isLoggedIn?: boolean;
  } = $props();

  let dismissed = $state(false);
  let visible = $derived(status === 'UNKNOWN' && !dismissed);
  let step = $state<1 | 2>(1);
  let blurChoice = $state(true);
  let busy = $state(false);

  async function handleMinor() {
    busy = true;
    try {
      setAgeStatus('MINOR');
      setBlurNsfw(true);
      if (isLoggedIn) {
        await action('member', 'preferences', { age_status: 'MINOR', blur_nsfw: true }).catch(() => {});
      }
      dismissed = true;
      await invalidateAll();
    } finally {
      busy = false;
    }
  }

  function handleAdultNext() {
    step = 2;
  }

  async function handleComplete() {
    busy = true;
    try {
      setAgeStatus('ADULT');
      setBlurNsfw(blurChoice);
      if (isLoggedIn) {
        await action('member', 'preferences', {
          age_status: 'ADULT',
          blur_nsfw: blurChoice
        }).catch(() => {});
      }
      dismissed = true;
      await invalidateAll();
    } finally {
      busy = false;
    }
  }
</script>

{#if visible}
  <div class="age-gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
    <div class="age-gate-card">
      {#if step === 1}
        <div class="step-icon-wrap">
          <ShieldAlert size={36} class="step-icon" />
        </div>

        <div class="step-content">
          <span class="step-badge">CLASSIFICAÇÃO INDICATIVA</span>
          <h2 id="age-gate-title" class="step-title">Aviso de Conteúdo +18</h2>
          <p class="step-desc">
            O Project Nox disponibiliza obras e capítulos destinados exclusivamente a maiores de 18 anos, contendo temas adultos e ilustrações explícitas.
          </p>
          <p class="step-question">Você tem 18 anos ou mais?</p>
        </div>

        <div class="step-actions">
          <button
            class="btn-choice minor"
            onclick={handleMinor}
            disabled={busy}
          >
            Não, sou menor de 18 anos
          </button>
          <button
            class="btn-choice adult"
            onclick={handleAdultNext}
            disabled={busy}
          >
            Sim, tenho 18 anos ou mais
          </button>
        </div>
      {:else}
        <div class="step-icon-wrap">
          <Eye size={36} class="step-icon" />
        </div>

        <div class="step-content">
          <span class="step-badge">PREFERÊNCIAS DE VISUALIZAÇÃO</span>
          <h2 id="age-gate-title" class="step-title">Exibição de Capas +18</h2>
          <p class="step-desc">
            Você pode escolher se deseja manter as capas de obras adultas borradas ou exibidas normalmente. Você poderá alterar isso depois nas configurações de perfil.
          </p>
        </div>

        <div class="choices-stack">
          <!-- Option 1: Blurred (Recommended) -->
          <label class="choice-card" class:selected={blurChoice}>
            <input
              type="radio"
              name="blur-option"
              checked={blurChoice}
              onchange={() => (blurChoice = true)}
            />
            <div class="choice-icon">
              <EyeOff size={20} />
            </div>
            <div class="choice-info">
              <strong>Manter capas +18 borradas (Recomendado)</strong>
              <small>Aplica desfoque visual suave com identificação +18 na capa.</small>
            </div>
            {#if blurChoice}
              <div class="choice-check">
                <Check size={16} />
              </div>
            {/if}
          </label>

          <!-- Option 2: Unblurred -->
          <label class="choice-card" class:selected={!blurChoice}>
            <input
              type="radio"
              name="blur-option"
              checked={!blurChoice}
              onchange={() => (blurChoice = false)}
            />
            <div class="choice-icon">
              <Eye size={20} />
            </div>
            <div class="choice-info">
              <strong>Mostrar capas +18 normalmente</strong>
              <small>Exibe todas as capas adultas sem aplicar desfoque nas ilustrações.</small>
            </div>
            {#if !blurChoice}
              <div class="choice-check">
                <Check size={16} />
              </div>
            {/if}
          </label>
        </div>

        <div class="step-actions">
          <button
            class="btn-choice adult"
            onclick={handleComplete}
            disabled={busy}
          >
            Confirmar e Continuar
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .age-gate-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(3, 4, 8, 0.88);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .age-gate-card {
    background: #0f121d;
    border: 1px solid rgba(181, 154, 245, 0.25);
    border-radius: 20px;
    max-width: 480px;
    width: 100%;
    padding: 32px 28px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 32px rgba(181, 154, 245, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
  }

  .step-icon-wrap {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: rgba(181, 154, 245, 0.1);
    border: 1px solid rgba(181, 154, 245, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #dfc28d;
    box-shadow: 0 0 24px rgba(223, 194, 141, 0.2);
  }

  .step-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .step-badge {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: #dfc28d;
    background: rgba(223, 194, 141, 0.12);
    border: 1px solid rgba(223, 194, 141, 0.25);
    padding: 4px 12px;
    border-radius: 999px;
  }

  .step-title {
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    margin: 4px 0 0;
  }

  .step-desc {
    font-size: 13.5px;
    color: #9da3b4;
    line-height: 1.5;
    margin: 0;
  }

  .step-question {
    font-size: 15px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 8px 0 0;
  }

  .step-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-top: 6px;
  }

  .btn-choice {
    width: 100%;
    padding: 13px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .btn-choice.adult {
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 20px rgba(109, 40, 217, 0.4);
  }

  .btn-choice.adult:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(139, 92, 246, 0.55);
  }

  .btn-choice.minor {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
  }

  .btn-choice.minor:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.35);
    color: #f87171;
  }

  .btn-choice:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .choices-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    text-align: left;
  }

  .choice-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .choice-card input[type='radio'] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .choice-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(181, 154, 245, 0.3);
  }

  .choice-card.selected {
    background: rgba(139, 92, 246, 0.12);
    border-color: #8b5cf6;
  }

  .choice-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .choice-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
  }

  .choice-info strong {
    font-size: 13.5px;
    color: #ffffff;
  }

  .choice-info small {
    font-size: 11.5px;
    color: #94a3b8;
    line-height: 1.35;
  }

  .choice-check {
    color: #a78bfa;
    flex-shrink: 0;
  }
</style>
