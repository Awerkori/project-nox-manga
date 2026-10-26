<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface XpToast {
    id: string;
    amount: number;
    title: string;
    badge: string;
    created: number;
  }

  let toasts = $state<XpToast[]>([]);

  export function triggerXpReward(amount: number, title: string) {
    if (!amount || amount <= 0) return;
    const id = `xp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: XpToast = {
      id,
      amount,
      title,
      badge: `✦ +${amount} XP`,
      created: Date.now()
    };

    // Keep max 2 toasts at a time in the center to maintain elegance
    if (toasts.length >= 2) {
      toasts = [...toasts.slice(1), newToast];
    } else {
      toasts = [...toasts, newToast];
    }

    // Dismiss after 2.6s (fulfilling the 2 to 3 seconds requirement)
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 2600);
  }

  function handleCustomEvent(e: Event) {
    const custom = e as CustomEvent<{ amount?: number; title?: string; message?: string; kind?: string }>;
    if (!custom.detail) return;
    const amount = Number(custom.detail.amount) || 0;
    const title = custom.detail.title || custom.detail.message || 'Capítulo concluído';
    if (amount > 0) {
      triggerXpReward(amount, title);
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('nox-xp-awarded', handleCustomEvent);
      (window as any).__noxTriggerXpReward = triggerXpReward;
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('nox-xp-awarded', handleCustomEvent);
      if ((window as any).__noxTriggerXpReward === triggerXpReward) {
        delete (window as any).__noxTriggerXpReward;
      }
    }
  });
</script>

{#if toasts.length > 0}
  <div class="xp-toast-container" aria-live="polite" aria-atomic="true">
    {#each toasts as toast (toast.id)}
      <div class="xp-toast-card">
        <div class="xp-glow-backdrop"></div>
        <div class="xp-toast-content">
          <div class="xp-badge-wrap">
            <span class="xp-sparkle">✦</span>
            <span class="xp-amount">+{toast.amount} XP</span>
          </div>
          <div class="xp-divider"></div>
          <span class="xp-toast-desc">{toast.title.replace(/^✦\s*\+\d+\s*XP\s*—\s*/, '')}</span>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .xp-toast-container {
    position: fixed;
    top: 54%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 99999999;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 12px;
    pointer-events: none;
    user-select: none;
    width: auto;
    max-width: 92vw;
  }

  .xp-toast-card {
    position: relative;
    display: inline-flex;
    align-items: center;
    background: linear-gradient(135deg, rgba(22, 10, 38, 0.96), rgba(46, 16, 78, 0.98));
    border: 1.5px solid rgba(168, 85, 247, 0.75);
    border-radius: 9999px;
    padding: 11px 24px 11px 18px;
    box-shadow:
      0 12px 38px rgba(0, 0, 0, 0.8),
      0 0 30px rgba(168, 85, 247, 0.55),
      inset 0 0 16px rgba(245, 158, 11, 0.28);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    animation: xpSoloLevelingFloat 2.6s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .xp-glow-backdrop {
    position: absolute;
    inset: -3px;
    border-radius: 9999px;
    background: radial-gradient(circle at center, rgba(168, 85, 247, 0.45) 0%, transparent 75%);
    z-index: -1;
    pointer-events: none;
    animation: xpGlowPulse 2s ease-in-out infinite alternate;
  }

  .xp-toast-content {
    display: flex;
    align-items: center;
    gap: 12px;
    white-space: nowrap;
  }

  .xp-badge-wrap {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .xp-sparkle {
    color: #fbbf24;
    font-size: 16px;
    filter: drop-shadow(0 0 8px #f59e0b);
    animation: xpSparkleSpin 1.4s ease-in-out infinite;
  }

  .xp-amount {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.6px;
    color: #fbbf24;
    text-shadow: 0 0 12px rgba(251, 191, 36, 0.7);
    font-family: inherit;
  }

  .xp-divider {
    width: 1px;
    height: 16px;
    background: rgba(255, 255, 255, 0.25);
  }

  .xp-toast-desc {
    font-size: 14.5px;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: 0.3px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
  }

  @keyframes xpSoloLevelingFloat {
    0% {
      opacity: 0;
      transform: translateY(22px) scale(0.88);
      filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.2));
    }
    14% {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: drop-shadow(0 0 22px rgba(168, 85, 247, 0.7));
    }
    72% {
      opacity: 1;
      transform: translateY(-28px) scale(1);
      filter: drop-shadow(0 0 16px rgba(168, 85, 247, 0.5));
    }
    100% {
      opacity: 0;
      transform: translateY(-64px) scale(0.94);
      filter: drop-shadow(0 0 0 rgba(168, 85, 247, 0));
    }
  }

  @keyframes xpGlowPulse {
    0% {
      opacity: 0.7;
      transform: scale(0.98);
    }
    100% {
      opacity: 1;
      transform: scale(1.04);
    }
  }

  @keyframes xpSparkleSpin {
    0%, 100% {
      transform: scale(1);
      opacity: 0.95;
    }
    50% {
      transform: scale(1.3);
      opacity: 1;
      filter: drop-shadow(0 0 12px #f59e0b);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .xp-toast-card {
      animation: xpFadeOnly 2.6s ease forwards;
    }
    .xp-sparkle,
    .xp-glow-backdrop {
      animation: none;
    }
    @keyframes xpFadeOnly {
      0% { opacity: 0; }
      15% { opacity: 1; }
      75% { opacity: 1; }
      100% { opacity: 0; }
    }
  }

  @media (max-width: 640px) {
    .xp-toast-container {
      top: 50%;
      max-width: 95vw;
    }
    .xp-toast-card {
      padding: 9px 18px 9px 15px;
    }
    .xp-amount {
      font-size: 15px;
    }
    .xp-toast-desc {
      font-size: 13.5px;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
</style>
