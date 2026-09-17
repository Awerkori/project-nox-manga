import fs from 'fs';

function toCamelCase(str) {
  return str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
}

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
    
    let oldProp = null;
    let newProp = null;
    
    const propMatch = message.match(/Property '([a-z0-9_]+)' does not exist on type/);
    if (propMatch) {
       oldProp = propMatch[1];
       if (oldProp.includes('_')) {
           newProp = toCamelCase(oldProp);
       }
    }
    
    // Sometimes it's "Object literal may only specify known properties, and 'owner_id' does not exist"
    if (!oldProp) {
       const objMatch = message.match(/Object literal may only specify known properties, and '([a-z0-9_]+)' does not exist/);
       if (objMatch) {
          oldProp = objMatch[1];
          if (oldProp.includes('_')) {
             newProp = toCamelCase(oldProp);
          }
       }
    }
    
    // Also "Cannot find name 'created_at'."
    if (!oldProp) {
       const varMatch = message.match(/Cannot find name '([a-z0-9_]+)'/);
       if (varMatch) {
          oldProp = varMatch[1];
          if (oldProp.includes('_')) {
             newProp = toCamelCase(oldProp);
          }
       }
    }

    if (oldProp && newProp && oldProp !== newProp) {
       if (!byFile[file]) byFile[file] = [];
       byFile[file].push({
         line: parseInt(lineNumStr, 10),
         character: parseInt(colStr, 10),
         oldProp,
         newProp
       });
    }
  }

  let totalFixes = 0;
  for (const file of Object.keys(byFile)) {
    if (!fs.existsSync(file)) continue;
    
    let content = fs.readFileSync(file, 'utf8');
    const fileLines = content.split('\n');
    
    const fixes = byFile[file].sort((a, b) => {
      if (b.line !== a.line) return b.line - a.line;
      return b.character - a.character;
    });

    for (const fix of fixes) {
      const lineIdx = fix.line - 1; 
      let l = fileLines[lineIdx];
      if (l) {
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
