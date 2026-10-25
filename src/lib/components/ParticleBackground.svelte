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
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;
    let bookShimmer = 0;

    function isMobile() {
      return typeof window !== 'undefined' && window.innerWidth < 768;
    }

    function isLowEndDevice() {
      if (typeof navigator === 'undefined') return false;
      const cores = (navigator as any).hardwareConcurrency || 4;
      const memory = (navigator as any).deviceMemory || 4;
      const isFirefox = /Firefox/i.test(navigator.userAgent);
      return cores <= 2 || memory <= 2 || (isFirefox && isMobile());
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

      // Adaptive particle density: 90 desktop, 35 mobile / low-end
      const count = mobile || lowEnd ? 35 : 90;

      if (particles.length === 0 || Math.abs(particles.length - count) > 10) {
        particles = Array.from({ length: count }, () => createParticle(true, mobile));
      }
    }

    function createParticle(randomY = false, mobile = false): Particle {
      // 3 depth tiers for depth-of-field effect:
      // depth 0: small subtle background stars (45%)
      // depth 1: mid floating ambient motes (36%)
      // depth 2: refined foreground snowflakes (19% - slightly larger, 2.0-2.5px target)
      const rand = Math.random();
      const depth = rand < 0.45 ? 0 : rand < 0.81 ? 1 : 2;

      let radius: number;
      let baseAlpha: number;
      let baseSpeedY: number;

      if (depth === 0) {
        // Micro background stars: 0.5 - 0.95px
        radius = mobile ? 0.45 + Math.random() * 0.35 : 0.55 + Math.random() * 0.4;
        baseAlpha = 0.22 + Math.random() * 0.3;
        baseSpeedY = (mobile ? 0.09 : 0.13) + Math.random() * 0.14;
      } else if (depth === 1) {
        // Mid-layer motes: 0.9 - 1.5px
        radius = mobile ? 0.8 + Math.random() * 0.45 : 0.95 + Math.random() * 0.55;
        baseAlpha = 0.38 + Math.random() * 0.32;
        baseSpeedY = (mobile ? 0.17 : 0.22) + Math.random() * 0.24;
      } else {
        // Foreground snowflakes: delicate but clearly visible (1.8 - 2.45px desktop, 1.3 - 1.8px mobile)
        radius = mobile ? 1.3 + Math.random() * 0.5 : 1.75 + Math.random() * 0.7;
        baseAlpha = 0.6 + Math.random() * 0.35;
        baseSpeedY = (mobile ? 0.26 : 0.32) + Math.random() * 0.32;
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
        sway: (depth === 0 ? 0.1 : depth === 1 ? 0.2 : 0.35) * (0.8 + Math.random() * 0.4),
        hue: Math.random() > 0.4 ? (Math.random() > 0.5 ? 268 : 242) : 212, // cosmic violet, indigo, or frosty white-blue
        depth
      };
    }

    function renderFrame() {
      if (!ctx || width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);

      const mobile = isMobile();

      // Cosmic aura following cursor on desktop (zero blur cost, pure radial gradient)
      if (mouseX > -100 && mouseY > -100 && !mobile) {
        const auraRadius = 180;
        const aura = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, auraRadius);
        aura.addColorStop(0, 'rgba(139, 92, 246, 0.05)');
        aura.addColorStop(0.5, 'rgba(99, 102, 241, 0.02)');
        aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, auraRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Atmospheric book ripple reaction (triggered when a page turns in Nox Book)
      if (bookShimmer > 0.02) {
        const shimmerR = (1 - bookShimmer) * 380 + 90;
        const shimmerGrad = ctx.createRadialGradient(width / 2, height * 0.32, shimmerR * 0.65, width / 2, height * 0.32, shimmerR);
        shimmerGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        shimmerGrad.addColorStop(0.5, `rgba(139, 92, 246, ${bookShimmer * 0.055})`);
        shimmerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shimmerGrad;
        ctx.beginPath();
        ctx.arc(width / 2, height * 0.32, shimmerR, 0, Math.PI * 2);
        ctx.fill();
        bookShimmer *= 0.96;
      }

      // Smooth mobile tilt interpolation
      currentTiltX += (targetTiltX - currentTiltX) * 0.05;

      // Subtle parallax interpolation
      if (mouseX > -100 && mouseY > -100 && !mobile) {
        targetParallaxX = (mouseX - width * 0.5) * 0.015;
        targetParallaxY = (mouseY - height * 0.5) * 0.012;
      } else {
        targetParallaxX = 0;
        targetParallaxY = 0;
      }
      currentParallaxX += (targetParallaxX - currentParallaxX) * 0.05;
      currentParallaxY += (targetParallaxY - currentParallaxY) * 0.05;

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

        // Apply subtle parallax offset based on depth
        const drawX = p.x + currentParallaxX * (p.depth + 0.4) * 0.5;
        const drawY = p.y + currentParallaxY * (p.depth + 0.4) * 0.5;

        // Draw particle with pure GPU-accelerated paths (No shadowBlur to avoid Gecko/mobile CPU spikes)
        if (p.depth === 2) {
          // Foreground snowflakes: soft cosmic halo + luminous crisp core
          ctx.beginPath();
          ctx.arc(drawX, drawY, p.radius * 2.0, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 80%, 75%, ${p.alpha * 0.24})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, p.alpha * 1.15)})`;
          ctx.fill();
        } else if (p.depth === 1) {
          // Mid motes: soft pastel star
          ctx.beginPath();
          ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 65%, 85%, ${p.alpha * 0.85})`;
          ctx.fill();
        } else {
          // Background stars: tiny sharp points
          ctx.beginPath();
          ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 40%, 85%, ${p.alpha * 0.65})`;
          ctx.fill();
        }
      }
    }

    function loop(timestamp: number) {
      if (document.hidden || isScrolling) return;

      const elapsed = timestamp - lastFrameTime;
      const targetFps = isMobile() || isLowEndDevice() ? 30 : 45;
      const targetInterval = 1000 / targetFps;

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

    function onBookFlip() {
      if (!reducedMotion) {
        bookShimmer = 1.0;
      }
    }

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('nox:book-flip', onBookFlip);
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
        window.removeEventListener('nox:book-flip', onBookFlip);
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
    background: radial-gradient(circle at 50% 15%, #0d0a1c 0%, #070611 40%, #030306 100%);
  }

  .ambient-mesh {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 25% 18%, rgba(139, 92, 246, 0.08) 0%, transparent 45%),
      radial-gradient(circle at 80% 28%, rgba(99, 102, 241, 0.065) 0%, transparent 48%),
      radial-gradient(circle at 50% 75%, rgba(124, 58, 237, 0.065) 0%, transparent 50%),
      radial-gradient(circle at 12% 75%, rgba(147, 51, 234, 0.055) 0%, transparent 42%);
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
    opacity: 0.72;
    pointer-events: none;
  }

  .glow-top {
    top: -160px;
    left: 50%;
    transform: translateX(-50%);
    width: 1000px;
    height: 560px;
    background: radial-gradient(
      ellipse at center,
      rgba(139, 92, 246, 0.11) 0%,
      rgba(99, 102, 241, 0.05) 38%,
      transparent 70%
    );
  }

  .glow-side {
    top: 30%;
    right: -120px;
    width: 700px;
    height: 700px;
    background: radial-gradient(
      circle,
      rgba(147, 51, 234, 0.075) 0%,
      rgba(79, 70, 229, 0.035) 45%,
      transparent 72%
    );
  }

  .glow-bottom-left {
    bottom: -100px;
    left: -80px;
    width: 650px;
    height: 650px;
    background: radial-gradient(
      circle,
      rgba(124, 58, 237, 0.065) 0%,
      rgba(30, 27, 75, 0.035) 50%,
      transparent 72%
    );
  }

  .night-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at center,
      transparent 45%,
      rgba(3, 3, 6, 0.82) 100%
    );
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .ambient-glow {
      opacity: 0.5;
    }
    .glow-top {
      width: 100%;
      height: 300px;
    }
    .glow-side,
    .glow-bottom-left {
      display: none;
    }
  }
</style>