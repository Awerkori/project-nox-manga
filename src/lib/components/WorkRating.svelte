<script lang="ts">
  import { onMount } from 'svelte';
  import { Star, X, Check, Loader2, BarChart3, Ellipsis, Trash2 } from '@lucide/svelte';
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
  let showOptionsDropdown = $state(false);

  const RATING_LABELS: Record<number, string> = {
    1: '1 - Muito ruim',
    2: '2 - Ruim',
    3: '3 - Regular',
    4: '4 - Muito bom',
    5: '5 - Excelente'
  };

  let displayAvg = $derived(
    rating?.average !== null && rating?.average !== undefined
      ? Number(rating.average).toFixed(1)
      : null
  );

  let userVoted = $derived(
    rating?.userRating !== null &&
    rating?.userRating !== undefined &&
    rating.userRating >= 1 &&
    rating.userRating <= 5
  );
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
      void err;
    }
  });

  async function handleVote(score: number) {
    if (isVoting || score < 1 || score > 5) return;
    isVoting = true;
    showOptionsDropdown = false;

    // Optimistic calculation
    const prevRating = { ...rating };
    const prevScore = rating.userRating;
    const isNewVote = prevScore === null || prevScore === undefined || prevScore < 1;
    const newCount = isNewVote ? rating.count + 1 : rating.count;
    const currentSum = (rating.average || 0) * rating.count;
    const newSum = isNewVote ? currentSum + score : currentSum - (prevScore || 0) + score;
    const newAvg = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : null;

    const newDist = { ...(rating.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }) };
    if (!isNewVote && prevScore && newDist[prevScore] > 0) {
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
      // Notice Requirement 3: NO success toast/pop-up on normal voting!
    } catch (err: any) {
      // Revert optimistic update only on error, and inform user of real failure
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
    showOptionsDropdown = false;

    const prevRating = { ...rating };
    const prevScore = rating.userRating!;
    const newCount = Math.max(0, rating.count - 1);
    const currentSum = (rating.average || 0) * rating.count;
    const newSum = Math.max(0, currentSum - prevScore);
    const newAvg = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : null;

    const newDist = { ...(rating.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }) };
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

<svelte:window onclick={(e) => {
  // Close discrete options popover on click outside
  if (showOptionsDropdown && !(e.target as HTMLElement)?.closest?.('.user-vote-chip-group')) {
    showOptionsDropdown = false;
  }
}} />

<div class="rating-widget" aria-label="Avaliações dos leitores">
  <!-- Left Side: Average Score & Total Count (Clickable to open breakdown modal) -->
  <button
    type="button"
    class="rating-score-box"
    onclick={() => (showBreakdownModal = true)}
    title="Ver detalhes e distribuição de notas"
    aria-label="Ver detalhes e distribuição de votos"
  >
    <div class="score-star-wrap" aria-hidden="true">
      <Star size={18} fill="#ffd154" class="score-star-icon" />
    </div>

    {#if displayAvg !== null}
      <span class="rating-number">{displayAvg}</span>
      <span class="rating-scale">/ 5</span>
    {:else}
      <span class="rating-empty-badge">Sem nota</span>
    {/if}

    <span class="rating-count">({rating?.count || 0})</span>

    <span class="btn-breakdown-hint" title="Ver distribuição de notas">
      <BarChart3 size={14} />
    </span>
  </button>

  <span class="rating-divider" aria-hidden="true"></span>

  <!-- Right Side: Direct Interactive Rating (1 to 5 Stars only) -->
  <div class="rating-interactive-row">
    <span class="rate-prompt">
      {#if userVoted}
        Sua nota:
      {:else}
        <span class="prompt-text-desktop">Avalie esta obra:</span>
        <span class="prompt-text-mobile">Avaliar:</span>
      {/if}
    </span>

    <!-- 1 to 5 Stars: Comfortable touch targets on mobile (min 44x44px) -->
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
          <Star size={20} fill={isHovered || isSelected ? 'currentColor' : 'none'} />
        </button>
      {/each}
    </div>

    <!-- Active Hover or Subtle Feedback -->
    {#if hoverScore !== null}
      <span class="rating-tooltip-label">{RATING_LABELS[hoverScore]}</span>
    {:else if userVoted}
      <div class="user-vote-chip-group">
        <span class="user-score-chip" title="Avaliação de {userScore} estrelas registrada">
          <Check size={11} />
          <span>Salvo</span>
        </span>

        <!-- Discrete removal menu button -->
        <button
          type="button"
          class="btn-rating-options"
          onclick={(e) => {
            e.stopPropagation();
            showOptionsDropdown = !showOptionsDropdown;
          }}
          title="Opções da avaliação"
          aria-label="Opções da avaliação"
          aria-expanded={showOptionsDropdown}
        >
          <Ellipsis size={13} />
        </button>

        {#if showOptionsDropdown}
          <div class="rating-options-popover" role="menu">
            <button
              type="button"
              class="btn-popover-remove"
              onclick={handleRemoveVote}
              disabled={isVoting}
            >
              <Trash2 size={13} />
              <span>Remover avaliação</span>
            </button>
          </div>
        {/if}
      </div>
    {/if}

    {#if isVoting}
      <Loader2 size={14} class="spin voting-spinner" />
    {/if}
  </div>
</div>

<!-- Detailed Distribution Modal (Accessed when clicking score box or chart icon) -->
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
            <strong>{userScore} {userScore === 1 ? 'Estrela' : 'Estrelas'} ({userScore}★)</strong>
          </div>
        {/if}
      </div>

      <!-- Rating Distribution Bars: 5 down to 1 only -->
      <div class="distribution-bars">
        {#each [5, 4, 3, 2, 1] as score (score)}
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
          <Trash2 size={15} />
          <span>Remover minha avaliação</span>
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .rating-widget {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    min-height: 44px;
    padding: 6px 16px;
    background: rgba(14, 12, 26, 0.45);
    border: 1px solid rgba(181, 154, 245, 0.12);
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(8px);
    margin: 4px 0 10px;
    width: fit-content;
    max-width: 100%;
    flex-wrap: wrap;
    box-sizing: border-box;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .rating-widget:hover {
    border-color: rgba(181, 154, 245, 0.22);
    background: rgba(18, 15, 32, 0.55);
  }

  .rating-score-box {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: inherit;
    border-radius: 6px;
    transition: opacity 0.15s ease;
  }

  .rating-score-box:hover {
    opacity: 0.85;
  }

  .score-star-wrap {
    display: flex;
    align-items: center;
    color: #ffd154;
    filter: drop-shadow(0 0 6px rgba(255, 209, 84, 0.45));
  }

  .rating-number {
    font-size: 1.35rem;
    font-weight: 800;
    line-height: 1;
    color: #ffd154;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }

  .rating-scale {
    font-size: 0.82rem;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.5);
  }

  .rating-empty-badge {
    font-size: 0.82rem;
    font-weight: 600;
    color: rgba(226, 232, 240, 0.7);
    background: rgba(255, 255, 255, 0.06);
    padding: 3px 9px;
    border-radius: 999px;
  }

  .rating-count {
    font-size: 0.84rem;
    color: rgba(226, 232, 240, 0.65);
    font-weight: 600;
  }

  .btn-breakdown-hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: rgba(181, 154, 245, 0.08);
    color: rgba(181, 154, 245, 0.65);
    transition: all 0.15s ease;
  }

  .rating-score-box:hover .btn-breakdown-hint {
    background: rgba(181, 154, 245, 0.2);
    color: #c4b5fd;
  }

  .rating-divider {
    width: 1px;
    height: 20px;
    background: rgba(181, 154, 245, 0.14);
  }

  .rating-interactive-row {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding-top: 0;
    border-top: none;
    flex-wrap: wrap;
  }

  .rate-prompt {
    font-size: 0.92rem;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .prompt-text-desktop {
    display: inline;
  }

  .prompt-text-mobile {
    display: none;
  }

  .interactive-stars {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .star-btn {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    padding: 0;
    color: rgba(181, 154, 245, 0.38);
    cursor: pointer;
    border-radius: 6px;
    touch-action: manipulation;
    transition: transform 0.15s ease, color 0.15s ease;
  }

  .star-btn:hover {
    transform: scale(1.2);
    color: #ffd154;
  }

  .star-btn.is-active {
    color: #ffd154;
    filter: drop-shadow(0 0 6px rgba(255, 209, 84, 0.5));
  }

  .rating-tooltip-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: #ffd154;
    white-space: nowrap;
  }

  .voting-spinner {
    color: #a78bfa;
    margin-left: 2px;
  }

  /* User Vote Chip & Discrete Removal Popover */
  .user-vote-chip-group {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .user-score-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.74rem;
    font-weight: 600;
    color: #c4b5fd;
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.2);
    padding: 2px 7px;
    border-radius: 999px;
  }

  .btn-rating-options {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(181, 154, 245, 0.15);
    border-radius: 50%;
    color: rgba(226, 232, 240, 0.6);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-rating-options:hover {
    color: #ffffff;
    background: rgba(181, 154, 245, 0.15);
  }

  .rating-options-popover {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 6px;
    background: #141220;
    border: 1px solid rgba(181, 154, 245, 0.2);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    z-index: 50;
    white-space: nowrap;
  }

  .btn-popover-remove {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 10px;
    background: none;
    border: none;
    font-size: 0.78rem;
    font-weight: 600;
    color: #f87171;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s ease;
  }

  .btn-popover-remove:hover {
    background: rgba(248, 113, 113, 0.12);
  }

  /* Mobile Responsive Tweaks: Comfortable Touch Targets (44px min) */
  @media (max-width: 768px) {
    .rating-widget {
      width: 100%;
      justify-content: space-between;
      min-height: 44px;
      padding: 6px 12px;
      gap: 8px;
      margin: 4px 0 8px;
      box-shadow: none;
    }

    .rating-number {
      font-size: 1.2rem;
    }

    .rating-divider {
      display: none;
    }

    .rating-interactive-row {
      gap: 4px;
    }

    .rate-prompt {
      font-size: 0.8rem;
      font-weight: 600;
      color: rgba(226, 232, 240, 0.7);
    }

    .star-btn {
      min-width: 44px;
      min-height: 44px;
      width: 44px;
      height: 44px;
    }

    .star-btn:active {
      transform: scale(1.18);
    }
  }

  /* Distribution / Breakdown Modal */
  .rating-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 5, 10, 0.8);
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
    max-width: 460px;
    background: #0d0f17;
    border: 1px solid rgba(181, 154, 245, 0.22);
    border-radius: 18px 18px 0 0;
    padding: 16px 20px max(28px, calc(16px + env(safe-area-inset-bottom, 0px)));
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.7);
    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sheet-handle {
    width: 36px;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    margin: 0 auto 12px;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .sheet-header h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .btn-sheet-close {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #94a3b8;
    width: 30px;
    height: 30px;
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
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(181, 154, 245, 0.1);
    border-radius: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .modal-score-big {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .modal-avg {
    font-size: 1.7rem;
    font-weight: 800;
    color: #ffd154;
  }

  .modal-stars-row {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .modal-total-count {
    font-size: 0.8rem;
    color: rgba(226, 232, 240, 0.6);
  }

  .modal-user-vote-banner {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 0.76rem;
    color: rgba(226, 232, 240, 0.6);
  }

  .modal-user-vote-banner strong {
    color: #c4b5fd;
    font-size: 0.85rem;
  }

  .distribution-bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
  }

  .dist-row-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(181, 154, 245, 0.08);
    border-radius: 8px;
    padding: 7px 10px;
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
    font-size: 0.8rem;
    font-weight: 700;
    min-width: 22px;
    color: #ffd154;
  }

  .dist-track {
    flex: 1;
    height: 7px;
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
    font-size: 0.78rem;
    font-weight: 600;
    color: #cbd5e1;
    min-width: 32px;
    text-align: right;
  }

  .dist-count {
    font-size: 0.72rem;
    color: rgba(226, 232, 240, 0.5);
    min-width: 26px;
  }

  .dist-check-icon {
    color: #a78bfa;
  }

  .btn-sheet-remove {
    width: 100%;
    min-height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #f87171;
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.22);
    border-radius: 10px;
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
