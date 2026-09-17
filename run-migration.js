import fs from 'fs';
import { execSync } from 'child_process';

function toCamelCase(str) {
  return str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
}

const customMap = {
  // specific overrides if needed
};

function parseAndFix() {
  console.log("Running svelte-check...");
  try {
    execSync('npx svelte-check --output machine > check.txt', { stdio: 'ignore' });
  } catch (e) {
    // svelte-check exits with 1 if there are errors
  }

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
    
    const propMatch = message.match(/Property '([a-zA-Z0-9_]+)' does not exist/);
    if (propMatch) {
       oldProp = propMatch[1];
    } else {
       const varMatch = message.match(/Cannot find name '([a-zA-Z0-9_]+)'/);
       if (varMatch) oldProp = varMatch[1];
    }

    if (oldProp && oldProp.includes('_')) {
       newProp = customMap[oldProp] || toCamelCase(oldProp);
       if (newProp && oldProp !== newProp) {
         if (!byFile[file]) byFile[file] = [];
         byFile[file].push({
           line: parseInt(lineNumStr, 10),
           character: parseInt(colStr, 10),
           oldProp,
           newProp
         });
       }
    }
  }

  let totalFixes = 0;
  for (const file of Object.keys(byFile)) {
    if (!fs.existsSync(file)) continue;
    if (file.includes('.svelte-kit')) continue; // skip build folder
    
    let content = fs.readFileSync(file, 'utf8');
    const fileLines = content.split('\n');
    
    const fixes = byFile[file].sort((a, b) => {
      if (b.line !== a.line) return b.line - a.line;
      return b.character - a.character;
    });

    // We keep track of lines we already touched so we can replace multiple on same line
    let replacedInLine = new Set();
    
    for (const fix of fixes) {
      const lineIdx = fix.line - 1; 
      let l = fileLines[lineIdx];
      if (l) {
         // Replace using word boundary
         const before = fileLines[lineIdx];
         fileLines[lineIdx] = l.replace(new RegExp(`\\b${fix.oldProp}\\b`, 'g'), fix.newProp);
         if (before !== fileLines[lineIdx]) totalFixes++;
      }
    }
    
    fs.writeFileSync(file, fileLines.join('\n'));
    if (fixes.length > 0) {
      console.log(`Fixed ${fixes.length} errors in ${file}`);
    }
  }
  
  console.log(`Total fixes applied in this pass: ${totalFixes}`);
  return totalFixes;
}

let pass = 1;
while (true) {
  console.log(`\n--- PASS ${pass} ---`);
  const fixed = parseAndFix();
  if (fixed === 0) {
    console.log("No more automated fixes can be applied.");
    break;
  }
  pass++;
  if (pass > 5) {
    console.log("Max passes reached to prevent infinite loop.");
    break;
  }
}
