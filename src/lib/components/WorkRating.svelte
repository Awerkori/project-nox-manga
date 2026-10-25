<script lang="ts">
  import { onMount } from 'svelte';
  import { Star, X, Check, Loader2, BarChart3 } from '@lucide/svelte';
  import type { RatingSummary } from '$lib/server/ratings';

  type Props = {
    workId: string;
    rating: RatingSummary;
    profile?: any;
    onNotice?: (msg: string) => void;
  };

  let { workId, rating = $bindable(), onNotice }: Props = $props();

  let hoverScore = $state<number | null>(null);
  let isVoting = $state(false);
  let showBreakdownModal = $state(false);

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

  // Client-side fresh check to ensure visitor rating is verified without edge-cache contamination
  onMount(async () => {
    try {
      const res = await fetch(`/api/works/${workId}/rating`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && (data.userRating !== rating.userRating || data.count !== rating.count)) {
          rating = {
            average: data.average,
            count: data.count,
            userRating: data.userRating,
            distribution: data.distribution || rating.distribution
          };
        }
      }
    } catch (err) {
      // Ignore background verification failure on mount
      void err;
    }
  });

  async function handleVote(score: number) {
    if (isVoting) return;
    isVoting = true;

    // Optimistic calculation
    const prevRating = { ...rating };
    const prevScore = rating.userRating;
    const isNewVote = prevScore === null || prevScore === undefined;
    const newCount = isNewVote ? rating.count + 1 : rating.count;
    const currentSum = (rating.average || 0) * rating.count;
    const newSum = isNewVote ? currentSum + score : currentSum - (prevScore || 0) + score;
    const newAvg = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : null;

    const newDist = { ...(rating.distribution || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }) };
    if (!isNewVote && prevScore !== null && prevScore !== undefined && newDist[prevScore] > 0) {
      newDist[prevScore]--;
    }
    newDist[score] = (newDist[score] || 0) + 1;

    rating = {
      ...rating,
      average: newAvg,
      count: newCount,
      userRating: score,
      distribution: newDist
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
        onNotice(score === 0 ? 'Avaliação registrada: 0 estrelas.' : `Avaliação de ${score} estrelas registrada!`);
      }
    } catch (err: any) {
      // Revert optimistic update on error
      rating = prevRating;
      if (onNotice) onNotice(err.message || 'Falha ao salvar avaliação.');
    } finally {
      isVoting = false;
      hoverScore = null;
    }
  }

  async function handleRemoveVote() {
    if (isVoting || !userVoted) return;
    isVoting = true;

    const prevRating = { ...rating };
    const prevScore = rating.userRating!;
    const newCount = Math.max(0, rating.count - 1);
    const currentSum = (rating.average || 0) * rating.count;
    const newSum = Math.max(0, currentSum - prevScore);
    const newAvg = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : null;

    const newDist = { ...(rating.distribution || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }) };
    if (newDist[prevScore] > 0) newDist[prevScore]--;

    rating = {
      ...rating,
      average: newAvg,
      count: newCount,
      userRating: null,
      distribution: newDist
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
    } catch (err: any) {
      rating = prevRating;
      if (onNotice) onNotice(err.message || 'Falha ao remover avaliação.');
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
  <!-- Top Summary Line: Average Score & Reviews Count -->
  <div class="rating-summary-row">
    <button
      type="button"
      class="rating-score-box"
      onclick={() => (showBreakdownModal = true)}
      title="Ver detalhes da distribuição de votos"
      aria-label="Ver detalhes e distribuição de avaliações"
    >
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

      <span class="btn-breakdown-hint" title="Ver distribuição">
        <BarChart3 size={15} />
      </span>
    </button>

    <div class="rating-meta-info">
      {#if rating?.count > 0}
        <span class="rating-count">{rating.count} {rating.count === 1 ? 'avaliação' : 'avaliações'}</span>
      {:else}
        <span class="rating-count">Seja o primeiro a avaliar</span>
      {/if}

      {#if userVoted}
        <span class="user-score-chip" class:zero-score={userScore === 0}>
          <Check size={12} />
          {userScore === 0 ? 'Sua nota: 0 ★' : `Sua nota: ${userScore} ★`}
        </span>
      {/if}
    </div>
  </div>

  <!-- Interactive Rating Controls: DIRECTLY VISIBLE ON BOTH DESKTOP AND MOBILE -->
  <div class="rating-interactive-row">
    <span class="rate-prompt">Avaliar obra:</span>

    <!-- Dedicated 0-star button (distinguishing 0 from absence of vote) -->
    <button
      type="button"
      class="btn-zero-star"
      class:is-active={userScore === 0}
      onclick={() => handleVote(0)}
      title="Avaliar com nota zero (0 estrelas)"
      aria-label="Avaliar com nota zero (0 estrelas)"
      disabled={isVoting}
    >
      0★
    </button>

    <!-- 1 to 5 Stars: Large touch targets on mobile (min 44x44px hitboxes) -->
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
          <Star size={24} fill={isHovered || isSelected ? 'currentColor' : 'none'} />
        </button>
      {/each}
    </div>

    <!-- Active Hover or User Score Feedback -->
    {#if hoverScore !== null}
      <span class="rating-tooltip-label">{RATING_LABELS[hoverScore]}</span>
    {:else if userVoted}
      <button
        type="button"
        class="btn-remove-rating"
        onclick={handleRemoveVote}
        disabled={isVoting}
        title="Remover minha avaliação"
        aria-label="Remover minha avaliação"
      >
        <X size={13} /> Remover
      </button>
    {/if}

    {#if isVoting}
      <Loader2 size={16} class="spin voting-spinner" />
    {/if}
  </div>
</div>

<!-- Detailed Distribution / Stats Modal (Accessible by clicking score box) -->
{#if showBreakdownModal}
  <div class="rating-modal-backdrop" onclick={() => (showBreakdownModal = false)} role="presentation">
    <div
      class="rating-modal-sheet"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="breakdown-title"
    >
      <div class="sheet-handle" aria-hidden="true"></div>

      <div class="sheet-header">
        <h3 id="breakdown-title">Avaliações dos Leitores</h3>
        <button
          type="button"
          class="btn-sheet-close"
          onclick={() => (showBreakdownModal = false)}
          aria-label="Fechar painel"
        >
          <X size={18} />
        </button>
      </div>

      <div class="modal-score-summary">
        <div class="modal-score-big">
          <span class="modal-avg">{displayAvg || '—'}</span>
          <div class="modal-stars-row">
            {#each [1, 2, 3, 4, 5] as starIndex (starIndex)}
              {@const activeRatio = Math.max(0, Math.min(1, (rating.average || 0) - (starIndex - 1)))}
              <div class="star-wrapper">
                <Star size={16} class="star-bg" />
                <div class="star-fill" style="width: {activeRatio * 100}%">
                  <Star size={16} class="star-fg" fill="currentColor" />
                </div>
              </div>
            {/each}
          </div>
          <span class="modal-total-count">{rating.count} {rating.count === 1 ? 'voto total' : 'votos totais'}</span>
        </div>

        {#if userVoted}
          <div class="modal-user-vote-banner">
            <span>Sua avaliação registrada:</span>
            <strong>{userScore === 0 ? '0 Estrelas (0★)' : `${userScore} Estrelas (${userScore}★)`}</strong>
          </div>
        {/if}
      </div>

      <!-- Rating Distribution Bars (5 down to 0) -->
      <div class="distribution-bars">
        {#each [5, 4, 3, 2, 1, 0] as score (score)}
          {@const count = rating.distribution?.[score] || 0}
          {@const pct = rating.count > 0 ? Math.round((count / rating.count) * 100) : 0}
          {@const isMyVote = userScore === score}

          <button
            type="button"
            class="dist-row-btn"
            class:is-my-vote={isMyVote}
            onclick={() => handleVote(score)}
            disabled={isVoting}
            title="Votar {score} estrelas"
          >
            <span class="dist-score-lbl">{score}★</span>
            <div class="dist-track">
              <div class="dist-bar-fill" style="width: {pct}%"></div>
            </div>
            <span class="dist-pct">{pct}%</span>
            <span class="dist-count">({count})</span>
            {#if isMyVote}
              <Check size={14} class="dist-check-icon" />
            {/if}
          </button>
        {/each}
      </div>

      {#if userVoted}
        <button
          type="button"
          class="btn-sheet-remove"
          onclick={() => {
            handleRemoveVote();
            showBreakdownModal = false;
          }}
          disabled={isVoting}
        >
          <X size={16} /> Remover minha avaliação
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .rating-widget {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 18px;
    background: rgba(14, 12, 24, 0.7);
    border: 1px solid rgba(181, 154, 245, 0.16);
    border-radius: 14px;
    backdrop-filter: blur(12px);
    margin: 8px 0;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  }

  .rating-summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }

  .rating-score-box {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: inherit;
    border-radius: 8px;
    transition: opacity 0.15s ease;
  }

  .rating-score-box:hover {
    opacity: 0.92;
  }

  .rating-number {
    font-size: 1.85rem;
    font-weight: 800;
    line-height: 1;
    color: #ffd154;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .rating-empty-badge {
    font-size: 0.84rem;
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

  .btn-breakdown-hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: rgba(181, 154, 245, 0.08);
    color: rgba(181, 154, 245, 0.65);
    transition: all 0.15s ease;
  }

  .rating-score-box:hover .btn-breakdown-hint {
    background: rgba(181, 154, 245, 0.18);
    color: #c4b5fd;
  }

  .rating-meta-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .rating-count {
    font-size: 0.86rem;
    color: rgba(226, 232, 240, 0.7);
    font-weight: 500;
  }

  .user-score-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    font-weight: 700;
    color: #c4b5fd;
    background: rgba(167, 139, 250, 0.16);
    border: 1px solid rgba(167, 139, 250, 0.35);
    padding: 3px 9px;
    border-radius: 999px;
    letter-spacing: 0.01em;
  }

  .user-score-chip.zero-score {
    color: #f87171;
    background: rgba(248, 113, 113, 0.14);
    border-color: rgba(248, 113, 113, 0.35);
  }

  /* Interactive Rating Controls */
  .rating-interactive-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(181, 154, 245, 0.1);
    flex-wrap: wrap;
  }

  .rate-prompt {
    font-size: 0.82rem;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.75);
    white-space: nowrap;
  }

  .btn-zero-star {
    min-width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 800;
    color: rgba(226, 232, 240, 0.7);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(181, 154, 245, 0.16);
    border-radius: 8px;
    cursor: pointer;
    touch-action: manipulation;
    transition: all 0.2s ease;
  }

  .btn-zero-star:hover,
  .btn-zero-star.is-active {
    color: #f87171;
    background: rgba(248, 113, 113, 0.16);
    border-color: rgba(248, 113, 113, 0.45);
  }

  .interactive-stars {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .star-btn {
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    padding: 0;
    color: rgba(181, 154, 245, 0.28);
    cursor: pointer;
    border-radius: 8px;
    touch-action: manipulation;
    transition: transform 0.15s ease, color 0.15s ease;
  }

  .star-btn:hover {
    transform: scale(1.15);
  }

  .star-btn.is-active {
    color: #ffd154;
    filter: drop-shadow(0 0 6px rgba(255, 209, 84, 0.45));
  }

  .rating-tooltip-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: #ffd154;
    margin-left: 4px;
    white-space: nowrap;
  }

  .btn-remove-rating {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 34px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #f87171;
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.25);
    cursor: pointer;
    touch-action: manipulation;
    margin-left: 6px;
    padding: 4px 10px;
    border-radius: 8px;
    transition: background 0.15s;
  }

  .btn-remove-rating:hover {
    background: rgba(248, 113, 113, 0.18);
  }

  .voting-spinner {
    color: #a78bfa;
    margin-left: 4px;
  }

  /* Mobile Responsive Tweaks: Comfortable Touch Targets */
  @media (max-width: 768px) {
    .rating-widget {
      padding: 12px 14px;
      margin: 6px 0;
    }

    .rating-summary-row {
      gap: 10px;
    }

    .rating-interactive-row {
      justify-content: flex-start;
      gap: 6px;
    }

    /* 44px min touch target on mobile */
    .btn-zero-star {
      min-width: 44px;
      height: 44px;
      font-size: 0.85rem;
    }

    .star-btn {
      width: 44px;
      height: 44px;
    }

    .star-btn:active {
      transform: scale(1.2);
    }

    .btn-remove-rating {
      min-height: 40px;
      padding: 6px 12px;
      font-size: 0.8rem;
    }
  }

  /* Distribution / Breakdown Modal */
  .rating-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 5, 10, 0.8);
    backdrop-filter: blur(10px);
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
    border: 1px solid rgba(181, 154, 245, 0.25);
    border-radius: 20px 20px 0 0;
    padding: 16px 20px 28px;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.7);
    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sheet-handle {
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 999px;
    margin: 0 auto 14px;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
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

  .modal-score-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(181, 154, 245, 0.1);
    border-radius: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .modal-score-big {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .modal-avg {
    font-size: 1.8rem;
    font-weight: 800;
    color: #ffd154;
  }

  .modal-stars-row {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .modal-total-count {
    font-size: 0.82rem;
    color: rgba(226, 232, 240, 0.6);
  }

  .modal-user-vote-banner {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 0.78rem;
    color: rgba(226, 232, 240, 0.6);
  }

  .modal-user-vote-banner strong {
    color: #c4b5fd;
    font-size: 0.88rem;
  }

  .distribution-bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .dist-row-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(181, 154, 245, 0.08);
    border-radius: 8px;
    padding: 8px 12px;
    color: #e2e8f0;
    cursor: pointer;
    touch-action: manipulation;
    transition: all 0.15s ease;
  }

  .dist-row-btn:hover {
    background: rgba(181, 154, 245, 0.08);
    border-color: rgba(181, 154, 245, 0.2);
  }

  .dist-row-btn.is-my-vote {
    background: rgba(167, 139, 250, 0.12);
    border-color: #a78bfa;
  }

  .dist-score-lbl {
    font-size: 0.82rem;
    font-weight: 700;
    min-width: 24px;
    color: #ffd154;
  }

  .dist-track {
    flex: 1;
    height: 8px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 999px;
    overflow: hidden;
  }

  .dist-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #7c3aed 0%, #ffd154 100%);
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  .dist-pct {
    font-size: 0.8rem;
    font-weight: 600;
    color: #cbd5e1;
    min-width: 34px;
    text-align: right;
  }

  .dist-count {
    font-size: 0.75rem;
    color: rgba(226, 232, 240, 0.5);
    min-width: 28px;
  }

  .dist-check-icon {
    color: #a78bfa;
  }

  .btn-sheet-remove {
    width: 100%;
    min-height: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    color: #f87171;
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.25);
    border-radius: 12px;
    cursor: pointer;
    touch-action: manipulation;
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
