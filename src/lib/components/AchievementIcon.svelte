<script lang="ts">
  import {
    Sparkles,
    BookOpen,
    Trophy,
    Flame,
    Heart,
    Eye,
    Download,
    Crown,
    Star,
    Zap,
    Shield,
    Compass,
    Award,
    Feather,
    Swords,
    Target,
    Gem,
    Coffee,
    Gift,
    Search,
    Users,
    CheckCircle2,
    Library,
    Moon,
    Medal
  } from '@lucide/svelte';

  let { icon = 'Trophy', size = 18 }: { icon?: string; size?: number } = $props();
</script>

{#if icon === 'Moon'}
  <Moon {size} />
{:else if icon === 'Flame'}
  <Flame {size} />
{:else if icon === 'Heart'}
  <Heart {size} />
{:else if icon === 'Eye'}
  <Eye {size} />
{:else if icon === 'Download'}
  <Download {size} />
{:else if icon === 'Crown'}
  <Crown {size} />
{:else if icon === 'Star'}
  <Star {size} />
{:else if icon === 'Zap'}
  <Zap {size} />
{:else if icon === 'Shield'}
  <Shield {size} />
{:else if icon === 'Compass'}
  <Compass {size} />
{:else if icon === 'Award'}
  <Award {size} />
{:else if icon === 'Feather'}
  <Feather {size} />
{:else if icon === 'Swords'}
  <Swords {size} />
{:else if icon === 'Target'}
  <Target {size} />
{:else if icon === 'Gem'}
  <Gem {size} />
{:else if icon === 'Coffee'}
  <Coffee {size} />
{:else if icon === 'Gift'}
  <Gift {size} />
{:else if icon === 'Search'}
  <Search {size} />
{:else if icon === 'Users'}
  <Users {size} />
{:else if icon === 'CheckCircle2'}
  <CheckCircle2 {size} />
{:else if icon === 'Library'}
  <Library {size} />
{:else if icon === 'Sparkles'}
  <Sparkles {size} />
{:else if icon === 'BookOpen'}
  <BookOpen {size} />
{:else if icon === 'Medal'}
  <Medal {size} />
{:else}
  <Trophy {size} />
{/if}
