import fs from 'fs';
const file = 'src/routes/admin/importer/+page.svelte';
let code = fs.readFileSync(file, 'utf8');

const oldPoll = `    const poll = async () => {
      try {
        if (document.visibilityState === 'visible') await invalidateAll();
      } catch (error) {
        console.warn('Não foi possível atualizar o painel do Importer', error);
      } finally {
        if (!disposed) pollInterval = setTimeout(poll, 4000);
      }
    };`;

const newPoll = `    const poll = async () => {
      try {
        if (document.visibilityState === 'visible') {
          const res = await fetch('/api/internal/importer/snapshot');
          if (res.ok) {
            const body = await res.json();
            if (body.success && body.data) {
              data = body.data;
            }
          }
        }
      } catch (error) {
        console.warn('Não foi possível atualizar o painel do Importer', error);
      } finally {
        if (!disposed) pollInterval = setTimeout(poll, 4000);
      }
    };`;

code = code.replace(oldPoll, newPoll);
fs.writeFileSync(file, code);
