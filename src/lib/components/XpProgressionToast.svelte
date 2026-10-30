<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface XpToast {
    id: string;
    amount: number;
    title: string;
    badge: string;
    created: number;
  }

  let toast = $state<XpToast | null>(null);
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTriggerTime = 0;
  let lastTriggerKey = '';

  export function triggerXpReward(amount: number, title: string) {
    if (!amount || amount <= 0) return;
    const now = Date.now();
    const cleanTitle = title.replace(/^✦\s*\+\d+\s*XP\s*—\s*/, '').trim();
    const key = `${amount}:${cleanTitle}`;

    // Deduplicate rapid calls from dual dispatch/listeners within 1200ms
    if (now - lastTriggerTime < 1200 && lastTriggerKey === key) {
      return;
    }
    lastTriggerTime = now;
    lastTriggerKey = key;

    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }

    const id = `xp_${now}_${Math.random().toString(36).substring(2, 7)}`;
    toast = {
      id,
      amount,
      title: cleanTitle,
      badge: `✦ +${amount} XP`,
      created: now
    };

    // Exactly 4.5 seconds duration for clear, comfortable visibility
    dismissTimer = setTimeout(() => {
      if (toast?.id === id) {
        toast = null;
      }
      dismissTimer = null;
    }, 4500);
  }

  function handleCustomEvent(e: Event) {
    const custom = e as CustomEvent<{ amount?: number; title?: string; label?: string; message?: string; kind?: string }>;
    if (!custom.detail) return;
    const amount = Number(custom.detail.amount) || 0;
    const title = custom.detail.title || custom.detail.label || custom.detail.message || 'Capítulo concluído';
    if (amount > 0) {
      triggerXpReward(amount, title);
    }
  }

  if (typeof window !== 'undefined') {
    (window as any).__noxTriggerXpReward = triggerXpReward;
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('nox-xp-awarded', handleCustomEvent);
      window.addEventListener('nox:xp_award', handleCustomEvent);
      (window as any).__noxTriggerXpReward = triggerXpReward;
    }
  });

  onDestroy(() => {
    if (dismissTimer) clearTimeout(dismissTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('nox-xp-awarded', handleCustomEvent);
      window.removeEventListener('nox:xp_award', handleCustomEvent);
      if ((window as any).__noxTriggerXpReward === triggerXpReward) {
        delete (window as any).__noxTriggerXpReward;
      }
    }
  });
</script>

{#if toast}
  <div class="xp-toast-container xp-progression-toast" aria-live="polite" aria-atomic="true">
    <div class="xp-toast-card" key={toast.id}>
      <div class="xp-glow-backdrop"></div>
      <div class="xp-toast-content">
        <div class="xp-badge-wrap">
          <span class="xp-sparkle" aria-hidden="true">✦</span>
          <span class="xp-amount">+{toast.amount} XP</span>
        </div>
        <div class="xp-divider" aria-hidden="true"></div>
        <span class="xp-toast-desc">{toast.title}</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .xp-toast-container {
    position: fixed;
    top: clamp(160px, 38vh, 46vh);
    right: 28px;
    z-index: 99999999;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    pointer-events: none;
    user-select: none;
    max-width: 90vw;
  }

  .xp-toast-card {
    position: relative;
    display: inline-flex;
    align-items: center;
    background: linear-gradient(135deg, rgba(20, 10, 36, 0.96), rgba(42, 14, 72, 0.98));
    border: 1px solid rgba(168, 85, 247, 0.65);
    border-radius: 9999px;
    padding: 8px 18px 8px 14px;
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.7),
      0 0 20px rgba(168, 85, 247, 0.4),
      inset 0 0 12px rgba(245, 158, 11, 0.2);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    animation: xpNaturalFloatFade 4.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .xp-glow-backdrop {
    position: absolute;
    inset: -2px;
    border-radius: 9999px;
    background: radial-gradient(circle at center, rgba(168, 85, 247, 0.35) 0%, transparent 75%);
    z-index: -1;
    pointer-events: none;
    animation: xpGlowPulse 1.8s ease-in-out infinite alternate;
  }

  .xp-toast-content {
    display: flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
  }

  .xp-badge-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .xp-sparkle {
    color: #fbbf24;
    font-size: 14px;
    filter: drop-shadow(0 0 6px #f59e0b);
    animation: xpSparkleSpin 1.4s ease-in-out infinite;
  }

  .xp-amount {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #fbbf24;
    text-shadow: 0 0 10px rgba(251, 191, 36, 0.65);
    font-family: inherit;
  }

  .xp-divider {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.22);
  }

  .xp-toast-desc {
    font-size: 13.5px;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: 0.25px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.85);
  }

  @keyframes xpNaturalFloatFade {
    0% {
      opacity: 0;
      transform: translate3d(24px, 12px, 0) scale(0.92);
      filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.2));
    }
    10% {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
      filter: drop-shadow(0 0 16px rgba(168, 85, 247, 0.6));
    }
    82% {
      opacity: 1;
      transform: translate3d(0, -6px, 0) scale(1);
      filter: drop-shadow(0 0 14px rgba(168, 85, 247, 0.45));
    }
    100% {
      opacity: 0;
      transform: translate3d(8px, -18px, 0) scale(0.96);
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
      transform: scale(1.03);
    }
  }

  @keyframes xpSparkleSpin {
    0%, 100% {
      transform: scale(1);
      opacity: 0.95;
    }
    50% {
      transform: scale(1.25);
      opacity: 1;
      filter: drop-shadow(0 0 10px #f59e0b);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .xp-toast-card {
      animation: xpFadeOnly 2.5s ease forwards;
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
      top: clamp(110px, 26vh, 32vh);
      right: max(16px, env(safe-area-inset-right, 16px));
      left: auto;
      max-width: calc(100vw - 32px);
    }
    .xp-toast-card {
      padding: 7px 15px 7px 12px;
    }
    .xp-amount {
      font-size: 13.5px;
    }
    .xp-toast-desc {
      font-size: 12.5px;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
</style>
