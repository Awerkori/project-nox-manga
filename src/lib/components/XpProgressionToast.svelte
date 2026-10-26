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

    // Keep max 3 toasts at a time to prevent clutter
    if (toasts.length >= 3) {
      toasts = [...toasts.slice(1), newToast];
    } else {
      toasts = [...toasts, newToast];
    }

    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 3800);
  }

  function handleCustomEvent(e: Event) {
    const custom = e as CustomEvent<{ amount?: number; title?: string; message?: string; kind?: string }>;
    if (!custom.detail) return;
    const amount = Number(custom.detail.amount) || 0;
    const title = custom.detail.title || custom.detail.message || 'Conquista alcançada!';
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
    bottom: 84px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999999;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 12px;
    pointer-events: none;
    user-select: none;
    width: auto;
    max-width: 90vw;
  }

  .xp-toast-card {
    position: relative;
    display: inline-flex;
    align-items: center;
    background: linear-gradient(135deg, rgba(22, 12, 38, 0.94), rgba(45, 16, 78, 0.96));
    border: 1px solid rgba(168, 85, 247, 0.6);
    border-radius: 9999px;
    padding: 9px 20px 9px 16px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.65),
      0 0 20px rgba(168, 85, 247, 0.4),
      inset 0 0 14px rgba(245, 158, 11, 0.2);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    animation: xpAscendFloat 3.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .xp-glow-backdrop {
    position: absolute;
    inset: -2px;
    border-radius: 9999px;
    background: radial-gradient(circle at center, rgba(168, 85, 247, 0.35) 0%, transparent 70%);
    z-index: -1;
    pointer-events: none;
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
    gap: 6px;
  }

  .xp-sparkle {
    color: #fbbf24;
    font-size: 15px;
    filter: drop-shadow(0 0 6px #f59e0b);
    animation: xpPulse 1.5s ease-in-out infinite;
  }

  .xp-amount {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #fbbf24;
    text-shadow: 0 0 10px rgba(251, 191, 36, 0.6);
    font-family: inherit;
  }

  .xp-divider {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.2);
  }

  .xp-toast-desc {
    font-size: 13.5px;
    font-weight: 600;
    color: #f1f5f9;
    letter-spacing: 0.2px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  }

  @keyframes xpAscendFloat {
    0% {
      opacity: 0;
      transform: translateY(16px) scale(0.92);
    }
    12% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    75% {
      opacity: 1;
      transform: translateY(-20px) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(-46px) scale(0.96);
    }
  }

  @keyframes xpPulse {
    0%, 100% {
      transform: scale(1);
      opacity: 0.9;
    }
    50% {
      transform: scale(1.25);
      opacity: 1;
      filter: drop-shadow(0 0 10px #f59e0b);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .xp-toast-card {
      animation: xpFadeOnly 3.8s ease forwards;
    }
    .xp-sparkle {
      animation: none;
    }
    @keyframes xpFadeOnly {
      0% { opacity: 0; }
      15% { opacity: 1; }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }
  }

  @media (max-width: 640px) {
    .xp-toast-container {
      bottom: 92px;
    }
    .xp-toast-card {
      padding: 8px 16px 8px 14px;
    }
    .xp-amount {
      font-size: 14px;
    }
    .xp-toast-desc {
      font-size: 12.5px;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
</style>
