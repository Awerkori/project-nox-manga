const fs = require('fs');

// 1. TasksTab.svelte
let tasks = fs.readFileSync('src/routes/scan/components/TasksTab.svelte', 'utf8');
tasks = tasks.replace(/\/\/ Replaced invalidateAll polling with local state update logic./g, 
  `setInterval(async () => {
    try {
      const res = await fetch('/api/scan/tasks?scanId=' + scan.id);
      if (res.ok) {
        const { tasks: newTasks } = await res.json();
        if (newTasks) tasks = newTasks;
      }
    } catch (e) {}
  }, 10000);`);
fs.writeFileSync('src/routes/scan/components/TasksTab.svelte', tasks);

// 2. ChatTab.svelte
let chat = fs.readFileSync('src/routes/scan/components/ChatTab.svelte', 'utf8');
chat = chat.replace(/\/\/ Replaced invalidateAll polling with local state update logic./g, 
  `setInterval(async () => {
    try {
      const res = await fetch('/api/scan/chat?scanId=' + scan.id + '&channelId=' + selectedChannelId);
      if (res.ok) {
        const { messages: newMsgs } = await res.json();
        if (newMsgs) messages = newMsgs;
      }
    } catch (e) {}
  }, 5000);`);
fs.writeFileSync('src/routes/scan/components/ChatTab.svelte', chat);

// 3. PipelineStageView.svelte
let pipeline = fs.readFileSync('src/routes/scan/components/PipelineStageView.svelte', 'utf8');
pipeline = pipeline.replace(/\/\/ Replaced invalidateAll polling with local state update logic./g, 
  `setInterval(async () => {
    try {
      const res = await fetch('/api/scan/pipeline?scanId=' + scan.id + '&stage=' + stage.id);
      if (res.ok) {
        const { chapters: newChs } = await res.json();
        if (newChs) chapters = newChs;
      }
    } catch (e) {}
  }, 10000);`);
fs.writeFileSync('src/routes/scan/components/PipelineStageView.svelte', pipeline);

