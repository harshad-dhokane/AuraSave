const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const files = execSync('grep -rn "useMemo(" app/ | awk -F: \'{print $1}\' | sort -u').toString().trim().split('\n');

for (const file of files) {
  if (!file) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  // Check if it already imports useMemo
  if (content.match(/import\s+.*?\{.*?useMemo.*?\}.*?from\s+["']react["']/)) {
    continue;
  }
  
  // If it imports React but not useMemo, try to add it
  if (content.match(/import\s+React.*?\{.*?\}.*?from\s+["']react["']/)) {
    content = content.replace(/(import\s+React.*?\{)(.*?)\}(\s+from\s+["']react["'])/, (match, p1, p2, p3) => {
      return p1 + p2 + (p2.trim() ? ', ' : '') + 'useMemo}' + p3;
    });
  } else if (content.match(/import\s+React\s+from\s+["']react["']/)) {
    content = content.replace(/(import\s+React)(\s+from\s+["']react["'])/, '$1, { useMemo }$2');
  } else if (content.match(/import\s+\{.*?\}.*?from\s+["']react["']/)) {
    content = content.replace(/(import\s+\{)(.*?)\}(\s+from\s+["']react["'])/, (match, p1, p2, p3) => {
      return p1 + p2 + (p2.trim() ? ', ' : '') + 'useMemo}' + p3;
    });
  } else {
    // just add it at the top
    content = 'import { useMemo } from "react";\n' + content;
  }
  
  fs.writeFileSync(file, content);
  console.log('Fixed', file);
}
