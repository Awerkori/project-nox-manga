<script lang="ts">
  import { onMount } from 'svelte';

  interface Particle {
    x: number;
    y: number;
    radius: number;
    alpha: number;
    baseAlpha: number;
    speedY: number;
    angle: number;
    angleSpeed: number;
    sway: number;
    hue: number;
  }

  let canvas: HTMLCanvasElement | null = $state(null);

  onMount(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number | null = null;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function initSize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = width < 768 ? 28 : 55;
      if (particles.length === 0 || Math.abs(particles.length - count) > 10) {
        particles = Array.from({ length: count }, () => createParticle(true));
      }
    }

    function createParticle(randomY = false): Particle {
      const radius = 0.7 + Math.random() * 1.5;
      const baseAlpha = 0.15 + Math.random() * 0.55;
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -10,
        radius,
        alpha: baseAlpha,
        baseAlpha,
        speedY: 0.18 + Math.random() * 0.38,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: 0.006 + Math.random() * 0.015,
        sway: 0.2 + Math.random() * 0.35,
        // Soft white-blue (215) with occasional faint lavender (255)
        hue: Math.random() > 0.3 ? 215 : 255
      };
    }

    function renderFrame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!reducedMotion) {
          p.y += p.speedY;
          p.angle += p.angleSpeed;
          p.x += Math.sin(p.angle) * p.sway;

          // Wrap around edges smoothly
          if (p.y > height + 10) {
            p.y = -8;
            p.x = Math.random() * width;
          }
          if (p.x < -10) p.x = width + 5;
          if (p.x > width + 10) p.x = -5;

          // Subtle twinkle/pulsing alpha
          p.alpha = p.baseAlpha * (0.75 + Math.sin(p.angle * 1.5) * 0.25);
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        if (p.radius > 1.4) {
          ctx.fillStyle = `hsla(${p.hue}, 80%, 88%, ${p.alpha})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = `hsla(${p.hue}, 90%, 75%, ${p.alpha * 0.7})`;
        } else {
          ctx.fillStyle = `hsla(${p.hue}, 70%, 90%, ${p.alpha})`;
          ctx.shadowBlur = 0;
        }

        ctx.fill();
      }
    }

    function loop() {
      if (document.hidden) return;
      renderFrame();
      animId = requestAnimationFrame(loop);
    }

    initSize();
    renderFrame();

    if (!reducedMotion) {
      animId = requestAnimationFrame(loop);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      } else if (!reducedMotion && animId === null) {
        animId = requestAnimationFrame(loop);
      }
    }

    let resizeTimer: ReturnType<typeof setTimeout>;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        initSize();
        renderFrame();
      }, 150);
    }

    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  });
</script>

<div class="particle-system" aria-hidden="true">
  <div class="ambient-glow glow-top"></div>
  <div class="ambient-glow glow-side"></div>
  <canvas bind:this={canvas} class="particle-canvas"></canvas>
  <div class="night-vignette"></div>
</div>

<style>
  .particle-system {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }

  .particle-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .ambient-glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.55;
    pointer-events: none;
  }

  .glow-top {
    top: -150px;
    left: 50%;
    transform: translateX(-50%);
    width: 850px;
    height: 480px;
    background: radial-gradient(
      ellipse at center,
      rgba(95, 55, 175, 0.16) 0%,
      rgba(25, 35, 75, 0.12) 45%,
      transparent 70%
    );
  }

  .glow-side {
    top: 35%;
    right: -120px;
    width: 600px;
    height: 600px;
    background: radial-gradient(
      circle,
      rgba(181, 154, 245, 0.08) 0%,
      rgba(20, 28, 55, 0.06) 50%,
      transparent 75%
    );
  }

  .night-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      transparent 60%,
      rgba(6, 7, 12, 0.6) 100%
    );
    pointer-events: none;
  }
</style>
