import fs from 'fs';

async function run() {
  const checkLog = fs.readFileSync('check.txt', 'utf8');
  
  const byFile = {};
  const lines = checkLog.split('\n');
  
  for (const line of lines) {
    if (!line.includes('ERROR')) continue;
    const match = line.match(/^\d+ ERROR "([^"]+)" (\d+):(\d+) "(.*)"$/);
    if (!match) continue;
    
    const [_, file, lineNumStr, colStr, messageRaw] = match;
    const message = messageRaw.replace(/\\n/g, '\n');
    
    // Check if it's a "Did you mean 'xxx'?" error
    const propMatch = message.match(/Property '(.+?)' does not exist on type '.*?'. Did you mean '(.+?)'\?/);
    if (!propMatch) {
       // Also check "Property 'xxx' does not exist on type" without did you mean,
       // but we only want safe auto-renames.
       continue;
    }
    
    const oldProp = propMatch[1];
    const newProp = propMatch[2];
    
    if (!byFile[file]) byFile[file] = [];
    byFile[file].push({
      line: parseInt(lineNumStr, 10),
      character: parseInt(colStr, 10),
      oldProp,
      newProp
    });
  }

  let totalFixes = 0;
  for (const file of Object.keys(byFile)) {
    if (!fs.existsSync(file)) continue;
    
    let content = fs.readFileSync(file, 'utf8');
    const fileLines = content.split('\n');
    
    // Sort descending by line and character
    const fixes = byFile[file].sort((a, b) => {
      if (b.line !== a.line) return b.line - a.line;
      return b.character - a.character;
    });

    for (const fix of fixes) {
      const lineIdx = fix.line - 1; 
      let l = fileLines[lineIdx];
      if (l) {
         // Because there might be multiple occurrences on the same line,
         // we just do a global replace for the word boundary on that specific line.
         fileLines[lineIdx] = l.replace(new RegExp(`\\b${fix.oldProp}\\b`, 'g'), fix.newProp);
         totalFixes++;
      }
    }
    
    fs.writeFileSync(file, fileLines.join('\n'));
    console.log(`Fixed ${fixes.length} errors in ${file}`);
  }
  
  console.log(`Total fixes applied: ${totalFixes}`);
}

run();
