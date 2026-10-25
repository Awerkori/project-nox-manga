<script lang="ts">
  import { Star, X, Check, Loader2 } from '@lucide/svelte';
  import type { RatingSummary } from '$lib/server/ratings';

  type Props = {
    workId: string;
    rating: RatingSummary;
    profile?: any;
    onNotice?: (msg: string) => void;
  };

  let { workId, rating = $bindable(), profile, onNotice }: Props = $props();

  let hoverScore = $state<number | null>(null);
  let isVoting = $state(false);
  let showMobileModal = $state(false);
  let errorMessage = $state<string | null>(null);

  const RATING_LABELS: Record<number, string> = {
    0: '0 - Péssimo',
    1: '1 - Muito ruim',
    2: '2 - Regular',
    3: '3 - Bom',
    4: '4 - Muito bom',
    5: '5 - Obra-prima'
  };

  let displayAvg = $derived(
    rating?.average !== null && rating?.average !== undefined
      ? Number(rating.average).toFixed(1)
      : null
  );

  let userVoted = $derived(rating?.userRating !== null && rating?.userRating !== undefined);
  let userScore = $derived(rating?.userRating);

  async function handleVote(score: number) {
    if (isVoting) return;
    isVoting = true;
    errorMessage = null;

    // Optimistic state
    const prevRating = { ...rating };
    const prevScore = rating.userRating;
    const isNewVote = prevScore === null || prevScore === undefined;
    const newCount = isNewVote ? rating.count + 1 : rating.count;
    const currentSum = (rating.average || 0) * rating.count;
    const newSum = isNewVote ? currentSum + score : currentSum - (prevScore || 0) + score;
    const newAvg = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : null;

    rating = {
      ...rating,
      average: newAvg,
      count: newCount,
      userRating: score
    };

    try {
      const res = await fetch(`/api/works/${workId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: score })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao registrar avaliação.');
      }
      rating = {
        average: data.average,
        count: data.count,
        userRating: data.userRating,
        distribution: data.distribution || rating.distribution
      };
      if (onNotice) {
        onNotice(`Avaliação de ${score} estrelas registrada com sucesso!`);
      }
      showMobileModal = false;
    } catch (err: any) {
      // Revert on error
      rating = prevRating;
      errorMessage = err.message || 'Falha ao salvar voto.';
      if (onNotice) onNotice(errorMessage || 'Falha ao registrar avaliação.');
    } finally {
      isVoting = false;
      hoverScore = null;
    }
  }

  async function handleRemoveVote() {
    if (isVoting || !userVoted) return;
    isVoting = true;
    errorMessage = null;

    const prevRating = { ...rating };
    const prevScore = rating.userRating!;
    const newCount = Math.max(0, rating.count - 1);
    const currentSum = (rating.average || 0) * rating.count;
    const newSum = Math.max(0, currentSum - prevScore);
    const newAvg = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : null;

    rating = {
      ...rating,
      average: newAvg,
      count: newCount,
      userRating: null
    };

    try {
      const res = await fetch(`/api/works/${workId}/rating`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao remover avaliação.');
      }
      rating = {
        average: data.average,
        count: data.count,
        userRating: null,
        distribution: data.distribution || rating.distribution
      };
      if (onNotice) onNotice('Sua avaliação foi removida.');
      showMobileModal = false;
    } catch (err: any) {
      rating = prevRating;
      errorMessage = err.message || 'Falha ao remover voto.';
      if (onNotice) onNotice(errorMessage || 'Falha ao remover voto.');
    } finally {
      isVoting = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent, score: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleVote(score);
    }
  }
</script>

<div class="rating-widget" aria-label="Avaliações dos leitores">
  <!-- Top Summary Line -->
  <div class="rating-summary">
    <div class="rating-score-box">
      {#if displayAvg !== null}
        <span class="rating-number">{displayAvg}</span>
        <div class="rating-stars-display" aria-hidden="true">
          {#each [1, 2, 3, 4, 5] as starIndex (starIndex)}
            {@const activeRatio = Math.max(0, Math.min(1, (rating.average || 0) - (starIndex - 1)))}
            <div class="star-wrapper">
              <Star size={18} class="star-bg" />
              <div class="star-fill" style="width: {activeRatio * 100}%">
                <Star size={18} class="star-fg" fill="currentColor" />
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <span class="rating-empty-badge">Sem avaliações</span>
      {/if}
    </div>

    <div class="rating-meta-info">
      {#if rating?.count > 0}
        <span class="rating-count">{rating.count} {rating.count === 1 ? 'avaliação' : 'avaliações'}</span>
      {:else}
        <span class="rating-count">Seja o primeiro a avaliar</span>
      {/if}

      {#if !profile}
        <div class="sheet-login-hint">
          <span>Entre na sua conta para salvar suas avaliações no seu perfil pessoal.</span>
        </div>
      {/if}

      {#if userVoted}
        <span class="user-score-chip" class:zero-score={userScore === 0}>
          <Check size={12} />
          {userScore === 0 ? 'Sua nota: 0 ★' : `Sua nota: ${userScore} ★`}
        </span>
      {/if}
    </div>
  </div>

  <!-- Interactive Rating Controls (Desktop Hover & Click) -->
  <div class="rating-interactive-desktop">
    <span class="rate-prompt">Avaliar obra:</span>

    <!-- Optional Zero-Star Quick Button -->
    <button
      type="button"
      class="btn-zero-star"
      class:is-active={userScore === 0}
      onclick={() => handleVote(0)}
      title="Avaliar com nota zero (0 estrelas)"
      disabled={isVoting}
    >
      0★
    </button>

    <div class="interactive-stars" role="radiogroup" aria-label="Avaliar de 1 a 5 estrelas">
      {#each [1, 2, 3, 4, 5] as starValue (starValue)}
        {@const isHovered = hoverScore !== null && starValue <= hoverScore}
        {@const isSelected = hoverScore === null && userScore !== null && userScore !== undefined && starValue <= userScore}
        <button
          type="button"
          class="star-btn"
          class:is-active={isHovered || isSelected}
          onmouseenter={() => (hoverScore = starValue)}
          onmouseleave={() => (hoverScore = null)}
          onclick={() => handleVote(starValue)}
          onkeydown={(e) => handleKeyDown(e, starValue)}
          role="radio"
          aria-checked={userScore === starValue}
          aria-label="{starValue} de 5 estrelas: {RATING_LABELS[starValue]}"
          disabled={isVoting}
        >
          <Star size={22} fill={isHovered || isSelected ? 'currentColor' : 'none'} />
        </button>
      {/each}
    </div>

    {#if hoverScore !== null}
      <span class="rating-tooltip-label">{RATING_LABELS[hoverScore]}</span>
    {:else if userVoted}
      <button
        type="button"
        class="btn-remove-rating"
        onclick={handleRemoveVote}
        disabled={isVoting}
        title="Remover minha avaliação"
      >
        <X size={13} /> Remover
      </button>
    {/if}

    {#if isVoting}
      <Loader2 size={15} class="spin voting-spinner" />
    {/if}
  </div>

  <!-- Mobile Quick Rating Action Button (Large Touch Target) -->
  <div class="rating-interactive-mobile">
    <button
      type="button"
      class="btn-mobile-rate"
      class:has-voted={userVoted}
      onclick={() => (showMobileModal = true)}
    >
      <Star size={18} fill={userVoted ? 'currentColor' : 'none'} />
      <span>{userVoted ? `Sua nota: ${userScore} ★ (Alterar)` : 'Avaliar esta obra'}</span>
    </button>
  </div>
</div>

<!-- Mobile Touch Modal / Drawer -->
{#if showMobileModal}
  <div class="rating-modal-backdrop" onclick={() => (showMobileModal = false)} role="presentation">
    <div
      class="rating-modal-sheet"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-rate-title"
    >
      <div class="sheet-handle" aria-hidden="true"></div>

      <div class="sheet-header">
        <h3 id="mobile-rate-title">Avaliar Obra</h3>
        <button type="button" class="btn-sheet-close" onclick={() => (showMobileModal = false)} aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      <p class="sheet-desc">Escolha sua nota de 0 a 5 estrelas para compartilhar sua opinião com os outros leitores:</p>

      <div class="sheet-options">
        {#each [5, 4, 3, 2, 1, 0] as score (score)}
          {@const isCurrent = userScore === score}
          <button
            type="button"
            class="sheet-score-row"
            class:is-selected={isCurrent}
            onclick={() => handleVote(score)}
            disabled={isVoting}
          >
            <div class="sheet-stars-preview">
              {#if score === 0}
                <span class="zero-badge">0★</span>
              {:else}
                {#each [1, 2, 3, 4, 5] as s (s)}
                  <Star size={16} fill={s <= score ? 'currentColor' : 'none'} class="score-row-star" />
                {/each}
              {/if}
            </div>
            <span class="sheet-score-label">{RATING_LABELS[score]}</span>
            {#if isCurrent}
              <Check size={18} class="current-check-icon" />
            {/if}
          </button>
        {/each}
      </div>

      {#if !profile}
        <div class="sheet-login-hint">
          <span>Entre na sua conta para salvar suas avaliações no seu perfil pessoal.</span>
        </div>
      {/if}

      {#if userVoted}
        <button
          type="button"
          class="btn-sheet-remove"
          onclick={handleRemoveVote}
          disabled={isVoting}
        >
          <X size={16} /> Remover minha avaliação
        </button>
      {/if}

      {#if isVoting}
        <div class="sheet-loading-overlay">
          <Loader2 size={24} class="spin" />
          <span>Salvando avaliação…</span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .rating-widget {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(18, 14, 28, 0.6);
    border: 1px solid rgba(181, 154, 245, 0.14);
    border-radius: 12px;
    backdrop-filter: blur(12px);
    margin: 8px 0;
  }

  .rating-summary {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .rating-score-box {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .rating-number {
    font-size: 1.75rem;
    font-weight: 800;
    line-height: 1;
    color: #ffd154;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .rating-empty-badge {
    font-size: 0.82rem;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.6);
    background: rgba(255, 255, 255, 0.05);
    padding: 4px 10px;
    border-radius: 999px;
  }

  .rating-stars-display {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .star-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
  }

  :global(.star-bg) {
    color: rgba(181, 154, 245, 0.25);
  }

  .star-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    overflow: hidden;
    color: #ffd154;
    display: flex;
    align-items: center;
  }

  .rating-meta-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .rating-count {
    font-size: 0.85rem;
    color: rgba(226, 232, 240, 0.65);
    font-weight: 500;
  }

  .user-score-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.12);
    border: 1px solid rgba(167, 139, 250, 0.28);
    padding: 3px 8px;
    border-radius: 999px;
  }

  .user-score-chip.zero-score {
    color: #f87171;
    background: rgba(248, 113, 113, 0.12);
    border-color: rgba(248, 113, 113, 0.3);
  }

  /* Desktop Interactive Row */
  .rating-interactive-desktop {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid rgba(181, 154, 245, 0.08);
  }

  .rate-prompt {
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.7);
  }

  .btn-zero-star {
    font-size: 0.75rem;
    font-weight: 700;
    color: rgba(226, 232, 240, 0.6);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(181, 154, 245, 0.14);
    padding: 2px 7px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-zero-star:hover,
  .btn-zero-star.is-active {
    color: #f87171;
    background: rgba(248, 113, 113, 0.14);
    border-color: rgba(248, 113, 113, 0.4);
  }

  .interactive-stars {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .star-btn {
    background: none;
    border: none;
    padding: 4px;
    color: rgba(181, 154, 245, 0.3);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: transform 0.15s ease, color 0.15s ease;
  }

  .star-btn:hover {
    transform: scale(1.18);
  }

  .star-btn.is-active {
    color: #ffd154;
    filter: drop-shadow(0 0 6px rgba(255, 209, 84, 0.4));
  }

  .rating-tooltip-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #ffd154;
    margin-left: 6px;
  }

  .btn-remove-rating {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(248, 113, 113, 0.8);
    background: none;
    border: none;
    cursor: pointer;
    margin-left: 6px;
    padding: 3px 6px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .btn-remove-rating:hover {
    background: rgba(248, 113, 113, 0.12);
  }

  .voting-spinner {
    color: #a78bfa;
    margin-left: 6px;
  }

  /* Mobile Button */
  .rating-interactive-mobile {
    display: none;
  }

  .btn-mobile-rate {
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 0.88rem;
    font-weight: 700;
    color: #e2e8f0;
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.25);
    border-radius: 10px;
    cursor: pointer;
    touch-action: manipulation;
    transition: all 0.2s ease;
  }

  .btn-mobile-rate.has-voted {
    color: #ffd154;
    background: rgba(255, 209, 84, 0.1);
    border-color: rgba(255, 209, 84, 0.3);
  }

  /* Responsive Switch */
  @media (max-width: 768px) {
    .rating-interactive-desktop {
      display: none;
    }
    .rating-interactive-mobile {
      display: block;
      margin-top: 6px;
    }
  }

  /* Modal / Drawer for Mobile Touch Rating */
  .rating-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 5, 10, 0.75);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
  }

  .rating-modal-sheet {
    position: relative;
    width: 100%;
    max-width: 480px;
    background: #0d0f17;
    border: 1px solid rgba(181, 154, 245, 0.2);
    border-radius: 20px 20px 0 0;
    padding: 16px 20px 28px;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.6);
    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sheet-handle {
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    margin: 0 auto 14px;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .sheet-header h3 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .btn-sheet-close {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #94a3b8;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .sheet-desc {
    font-size: 0.85rem;
    color: rgba(226, 232, 240, 0.7);
    margin: 0 0 16px;
    line-height: 1.45;
  }

  .sheet-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sheet-score-row {
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(181, 154, 245, 0.12);
    border-radius: 12px;
    color: #f1f5f9;
    cursor: pointer;
    touch-action: manipulation;
    text-align: left;
    transition: all 0.15s ease;
  }

  .sheet-score-row:active,
  .sheet-score-row.is-selected {
    background: rgba(167, 139, 250, 0.16);
    border-color: #a78bfa;
    color: #ffd154;
  }

  .sheet-stars-preview {
    display: flex;
    align-items: center;
    gap: 2px;
    color: #ffd154;
    min-width: 90px;
  }

  .zero-badge {
    font-size: 0.82rem;
    font-weight: 800;
    color: #f87171;
    background: rgba(248, 113, 113, 0.14);
    padding: 2px 8px;
    border-radius: 6px;
  }

  .sheet-score-label {
    flex: 1;
    font-size: 0.92rem;
    font-weight: 600;
  }

  .current-check-icon {
    color: #a78bfa;
  }

  .sheet-login-hint {
    margin-top: 10px;
    padding: 8px 12px;
    background: rgba(167, 139, 250, 0.08);
    border: 1px dashed rgba(167, 139, 250, 0.25);
    border-radius: 8px;
    font-size: 0.78rem;
    color: rgba(226, 232, 240, 0.7);
    text-align: center;
  }

  .btn-sheet-remove {
    width: 100%;
    min-height: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 12px;
    font-size: 0.88rem;
    font-weight: 600;
    color: #f87171;
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.25);
    border-radius: 12px;
    cursor: pointer;
    touch-action: manipulation;
  }

  .sheet-loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(13, 15, 23, 0.85);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: 20px 20px 0 0;
    color: #a78bfa;
    font-weight: 600;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
</style>
