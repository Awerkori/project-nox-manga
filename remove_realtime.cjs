const fs = require('fs');

function removeRealtime(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace(/import \{ getSupabaseBrowserClient \} from '\$lib\/supabase';/g, '');
  content = content.replace(/import type \{ RealtimeChannel \} from '@supabase\/supabase-js';/g, '');
  content = content.replace(/let realtimeChannel: RealtimeChannel \| null = null;/g, '');
  
  // TasksTab / PipelineStageView / ChatTab
  content = content.replace(/const client = getSupabaseBrowserClient\(\);[\s\S]*?realtimeChannel\.subscribe\(\);/g, `
    // Supabase Realtime removed for Turso migration.
    // Fallback: Poll every 10 seconds to keep data fresh.
    const interval = setInterval(() => {
      invalidateAll();
    }, 10000);
    return () => clearInterval(interval);
  `);

  content = content.replace(/if \(realtimeChannel\) \{[\s\S]*?realtimeChannel\.unsubscribe\(\);[\s\S]*?\}/g, '');
  
  fs.writeFileSync(filepath, content);
  console.log(`Processed ${filepath}`);
}

removeRealtime('src/routes/scan/components/TasksTab.svelte');
removeRealtime('src/routes/scan/components/ChatTab.svelte');
removeRealtime('src/routes/scan/components/PipelineStageView.svelte');

