import re

with open('src/lib/components/RecentReleases.svelte', 'r') as f:
    content = f.read()

# Import untrack
if 'untrack' not in content:
    content = content.replace("import { fade } from 'svelte/transition';", "import { fade } from 'svelte/transition';\n  import { untrack } from 'svelte';")

# Fix effect
bad_effect = """  $effect(() => {
    // Keep it in sync if props change externally
    if (releases !== currentReleases) {
      currentReleases = [...releases];
    }
  });"""

good_effect = """  $effect(() => {
    // Keep it in sync if props change externally
    const current = untrack(() => currentReleases);
    if (releases && releases.length > 0 && releases[0] !== current[0]) {
      currentReleases = [...releases];
    }
  });"""

content = content.replace(bad_effect, good_effect)

with open('src/lib/components/RecentReleases.svelte', 'w') as f:
    f.write(content)

