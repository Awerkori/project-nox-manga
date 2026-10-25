<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Particle {
    x: number;
    y: number;
    radius: number;
    alpha: number;
    baseAlpha: number;
    speedY: number;
    baseSpeedY: number;
    speedX: number;
    angle: number;
    angleSpeed: number;
    sway: number;
    hue: number;
    depth: number; // 0: background star, 1: mid-layer mote, 2: foreground snowflake
  }

  let canvas: HTMLCanvasElement | null = $state(null);
  let cleanupListeners: (() => void) | null = null;

  onMount(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number | null = null;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let isScrolling = false;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastFrameTime = 0;

    // Interactive tracking
    let mouseX = -9999;
    let mouseY = -9999;
    let targetTiltX = 0;
    let currentTiltX = 0;

    function isMobile() {
      return typeof window !== 'undefined' && window.innerWidth < 768;
    }

    function isLowEndDevice() {
      if (typeof navigator === 'undefined') return false;
      const cores = (navigator as any).hardwareConcurrency || 4;
      const memory = (navigator as any).deviceMemory || 4;
      return cores <= 2 || memory <= 2;
    }

    function initSize() {
      if (!canvas) return;
      const mobile = isMobile();
      const lowEnd = isLowEndDevice();
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.0 : 1.25);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density: 75 particles desktop, 36 mobile, reduced if low-end
      let count = mobile ? 36 : 75;
      if (lowEnd) count = Math.floor(count * 0.6);

      if (particles.length === 0 || Math.abs(particles.length - count) > 8) {
        particles = Array.from({ length: count }, () => createParticle(true, mobile));
      }
    }

    function createParticle(randomY = false, mobile = false): Particle {
      // 3 depth tiers for depth-of-field effect:
      // depth 0: small subtle background stars (40%)
      // depth 1: mid floating ambient motes (40%)
      // depth 2: glowing foreground snowflakes (20%)
      const rand = Math.random();
      const depth = rand < 0.45 ? 0 : rand < 0.82 ? 1 : 2;

      let radius: number;
      let baseAlpha: number;
      let baseSpeedY: number;

      if (depth === 0) {
        radius = mobile ? 0.6 + Math.random() * 0.5 : 0.8 + Math.random() * 0.6;
        baseAlpha = 0.15 + Math.random() * 0.25;
        baseSpeedY = (mobile ? 0.08 : 0.12) + Math.random() * 0.15;
      } else if (depth === 1) {
        radius = mobile ? 0.9 + Math.random() * 0.7 : 1.2 + Math.random() * 0.9;
        baseAlpha = 0.3 + Math.random() * 0.35;
        baseSpeedY = (mobile ? 0.16 : 0.22) + Math.random() * 0.25;
      } else {
        radius = mobile ? 1.4 + Math.random() * 0.9 : 1.9 + Math.random() * 1.3;
        baseAlpha = 0.5 + Math.random() * 0.4;
        baseSpeedY = (mobile ? 0.24 : 0.32) + Math.random() * 0.35;
      }

      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -15,
        radius,
        alpha: baseAlpha,
        baseAlpha,
        speedY: baseSpeedY,
        baseSpeedY,
        speedX: 0,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: 0.006 + Math.random() * 0.012,
        sway: (depth === 0 ? 0.1 : depth === 1 ? 0.22 : 0.38) * (0.8 + Math.random() * 0.4),
        hue: Math.random() > 0.4 ? (Math.random() > 0.5 ? 265 : 240) : 210, // violet, indigo, or frosty white-blue
        depth
      };
    }

    function renderFrame() {
      if (!ctx || width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);

      // Smooth mobile tilt interpolation
      currentTiltX += (targetTiltX - currentTiltX) * 0.05;

      const mouseRadius = 110;
      const mouseRadiusSq = mouseRadius * mouseRadius;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!reducedMotion) {
          // Downward gravity with subtle wave
          p.y += p.speedY;
          p.angle += p.angleSpeed;
          p.x += Math.sin(p.angle) * p.sway + currentTiltX * (p.depth + 1) * 0.3;

          // Apply temporary interactive horizontal velocity decay
          p.x += p.speedX;
          p.speedX *= 0.92;

          // Smooth mouse interaction (repulsion & gentle swirl)
          if (mouseX > -100 && mouseY > -100) {
            const dx = p.x - mouseX;
            const dy = p.y - mouseY;
            const distSq = dx * dx + dy * dy;

            if (distSq < mouseRadiusSq && distSq > 1) {
              const dist = Math.sqrt(distSq);
              const force = (1 - dist / mouseRadius) * (p.depth === 2 ? 2.5 : p.depth === 1 ? 1.8 : 0.8);
              p.speedX += (dx / dist) * force;
              p.y += (dy / dist) * force * 0.5;
            }
          }

          // Boundary wrapping
          if (p.y > height + 15) {
            p.y = -10;
            p.x = Math.random() * width;
            p.speedX = 0;
          }
          if (p.x < -15) p.x = width + 10;
          if (p.x > width + 15) p.x = -10;

          // Gentle twinkling alpha
          p.alpha = p.baseAlpha * (0.85 + Math.sin(p.angle * 1.8) * 0.25);
        }

        // Draw particle with soft glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        if (p.depth === 2) {
          // Foreground snowflakes: crisp white core with soft violet/blue halo
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, p.alpha * 1.1)})`;
          ctx.shadowColor = `hsla(${p.hue}, 80%, 75%, ${p.alpha * 0.6})`;
          ctx.shadowBlur = 6;
        } else if (p.depth === 1) {
          // Mid motes: soft pastel star
          ctx.fillStyle = `hsla(${p.hue}, 60%, 90%, ${p.alpha})`;
          ctx.shadowColor = `hsla(${p.hue}, 70%, 70%, ${p.alpha * 0.4})`;
          ctx.shadowBlur = 3;
        } else {
          // Background stars: tiny sharp points
          ctx.fillStyle = `hsla(${p.hue}, 40%, 85%, ${p.alpha})`;
          ctx.shadowBlur = 0;
        }

        ctx.fill();
      }

      // Reset shadow for next frame
      ctx.shadowBlur = 0;
    }

    function loop(timestamp: number) {
      if (document.hidden || isScrolling) return;

      const elapsed = timestamp - lastFrameTime;
      const targetInterval = 1000 / 45; // 45 FPS target: silky smooth & battery efficient

      if (elapsed >= targetInterval) {
        lastFrameTime = timestamp - (elapsed % targetInterval);
        renderFrame();
      }

      animId = requestAnimationFrame(loop);
    }

    initSize();
    if (!reducedMotion) {
      renderFrame();
      animId = requestAnimationFrame(loop);
    }

    // Desktop Mouse Tracking
    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }

    function onMouseLeave() {
      mouseX = -9999;
      mouseY = -9999;
    }

    // Mobile Device Tilt / Orientation
    function onDeviceOrientation(e: DeviceOrientationEvent) {
      if (e.gamma !== null && Math.abs(e.gamma) > 1) {
        // Clamp gamma between -30 and 30 deg, scale to -1.2 to 1.2 px drift
        const clamped = Math.max(-30, Math.min(30, e.gamma));
        targetTiltX = (clamped / 30) * 1.2;
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      } else if (!reducedMotion && animId === null && !isScrolling) {
        animId = requestAnimationFrame(loop);
      }
    }

    function onScroll() {
      isScrolling = true;
      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        if (!document.hidden && !reducedMotion && animId === null) {
          animId = requestAnimationFrame(loop);
        }
      }, 100);
    }

    let resizeTimer: ReturnType<typeof setTimeout>;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        initSize();
        renderFrame();
        if (!reducedMotion && animId === null && !document.hidden && !isScrolling) {
          animId = requestAnimationFrame(loop);
        }
      }, 150);
    }

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Register gyroscope if available and supported
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      try {
        window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
      } catch {
        // Ignored if permissions policy restricts
      }
    }

    cleanupListeners = () => {
      if (animId !== null) cancelAnimationFrame(animId);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('deviceorientation', onDeviceOrientation);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('mouseleave', onMouseLeave);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  });

  onDestroy(() => {
    if (cleanupListeners) {
      cleanupListeners();
      cleanupListeners = null;
    }
  });
</script>

<div class="particle-system" aria-hidden="true">
  <!-- Subtle atmospheric gradient mesh pulling from deep void black to rich purple & dark blue -->
  <div class="ambient-mesh"></div>
  <div class="ambient-glow glow-top"></div>
  <div class="ambient-glow glow-side"></div>
  <div class="ambient-glow glow-bottom-left"></div>
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
    contain: strict;
    background: radial-gradient(circle at 50% 0%, #0d0a1c 0%, #06070c 55%, #040508 100%);
  }

  .ambient-mesh {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 20% 15%, rgba(139, 92, 246, 0.07) 0%, transparent 40%),
      radial-gradient(circle at 85% 35%, rgba(59, 130, 246, 0.05) 0%, transparent 45%),
      radial-gradient(circle at 50% 85%, rgba(109, 40, 217, 0.06) 0%, transparent 50%);
    pointer-events: none;
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
    filter: blur(120px);
    opacity: 0.65;
    pointer-events: none;
  }

  .glow-top {
    top: -180px;
    left: 50%;
    transform: translateX(-50%);
    width: 950px;
    height: 520px;
    background: radial-gradient(
      ellipse at center,
      rgba(139, 92, 246, 0.18) 0%,
      rgba(45, 55, 120, 0.12) 45%,
      transparent 70%
    );
  }

  .glow-side {
    top: 30%;
    right: -140px;
    width: 650px;
    height: 650px;
    background: radial-gradient(
      circle,
      rgba(168, 85, 247, 0.1) 0%,
      rgba(30, 41, 75, 0.07) 50%,
      transparent 75%
    );
  }

  .glow-bottom-left {
    bottom: -100px;
    left: -100px;
    width: 600px;
    height: 600px;
    background: radial-gradient(
      circle,
      rgba(99, 102, 241, 0.09) 0%,
      rgba(15, 23, 42, 0.05) 55%,
      transparent 75%
    );
  }

  .night-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      transparent 55%,
      rgba(4, 5, 8, 0.7) 100%
    );
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .ambient-glow {
      filter: blur(80px);
      opacity: 0.45;
    }
    .glow-top {
      width: 100%;
      height: 280px;
    }
    .glow-side,
    .glow-bottom-left {
      display: none;
    }
  }
</style>