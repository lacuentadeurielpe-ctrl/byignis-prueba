const fs = require('fs');

function keepHead(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Reemplazar todos los bloques de conflicto manteniendo HEAD
  content = content.replace(/<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> origin\/main/g, '$1');
  fs.writeFileSync(filePath, content);
}

keepHead('src/app/api/orders/[id]/route.ts');
keepHead('src/components/orders/OrdersTable.tsx');
console.log('Conflictos resueltos usando HEAD');
