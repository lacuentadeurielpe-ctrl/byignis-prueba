const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('.git')) {
        results = results.concat(walk(file));
      }
    } else {
      results.push(file);
    }
  });
  return results;
}

const allFiles = walk('C:\\Users\\USER\\Documents\\byignis-prueba\\src');
console.log('SEARCH RESULTS FOR "/api/compras":');
allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('/api/compras') || content.includes('ai-extract')) {
    console.log(file);
  }
});
