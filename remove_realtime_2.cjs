const fs = require('fs');
function remove(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace(/import \{ getSupabaseBrowserClient \} from '\$lib\/supabase';/g, '');
  
  if (filepath.includes('me/+page.svelte')) {
    content = content.replace(/const client = getSupabaseBrowserClient\(\);[\s\S]*?client\.channel[\s\S]*?\}\);/g, '');
  }
  if (filepath.includes('+layout.svelte')) {
    content = content.replace(/const client = getSupabaseBrowserClient\(\);[\s\S]*?client\.channel[\s\S]*?subscribe\(\);/g, '');
    content = content.replace(/client\.removeChannel[\s\S]*?;/g, '');
  }

  fs.writeFileSync(filepath, content);
}
remove('src/routes/me/+page.svelte');
remove('src/routes/+layout.svelte');
