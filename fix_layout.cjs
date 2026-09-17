const fs = require('fs');
let code = fs.readFileSync('src/routes/+layout.svelte', 'utf8');

// The layout file seems to have a broken script block because of some bad partial edit.
// I will just wipe out the RealtimeChannel logic.
code = code.replace(/let subscribedProfileId:[^]*?(?=\s*onDestroy)/, '');
code = code.replace(/onDestroy\(\(\) => \{[^]*?\}\);/, '');

fs.writeFileSync('src/routes/+layout.svelte', code);
