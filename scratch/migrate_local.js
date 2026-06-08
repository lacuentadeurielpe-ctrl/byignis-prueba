const fs = require('fs');
const path = require('path');

// Target ferreteria_id in byignispruebas
const TARGET_FERRETERIA_ID = '32e14714-dfae-4a90-8cb9-41eb7d90a8d2';

// File paths
const inputPath = path.join(__dirname, 'output.txt');
const outputPath = path.join(__dirname, 'migration.sql');

// Read categories fetched earlier from console result
const categories = [
  {"id":"99c6d20f-1a48-48fa-bf62-324b089c35ff","nombre":"Fierro","orden":0},
  {"id":"987978c1-c55a-417b-b2f0-bd6542c3d8c3","nombre":"Agregados","orden":0},
  {"id":"39d3dcd5-56b1-46c9-a60f-7c06936d8f9c","nombre":"Cemento","orden":0},
  {"id":"fc2e2a12-d84f-45a7-a9ea-155fad743001","nombre":"Pinturas","orden":0},
  {"id":"9dd624af-6e06-418f-8945-62bbdd9c5c64","nombre":"Materiales de construcción","orden":0},
  {"id":"37df6c85-e7ed-4b3b-978d-048fe1663cf7","nombre":"Herramientas","orden":0},
  {"id":"7d34c78f-80e8-4026-bcbc-23e7ab4bc24c","nombre":"Tuberías","orden":0},
  {"id":"9065ffe0-bddc-4070-965d-f63e4bcf71b1","nombre":"Adhesivos","orden":0},
  {"id":"ba39e315-88dd-4210-96a7-a66b737698cc","nombre":"Cerraduras","orden":0},
  {"id":"51f08e5a-6870-42ff-b801-ad70dfdf86a0","nombre":"Electricidad","orden":0},
  {"id":"5a3a5e9c-96c1-4c8a-9cb2-0be783b1f1e9","nombre":"Herramienta","orden":99},
  {"id":"20900b42-e1fe-412b-9a24-f06ec50fa0e7","nombre":"Fragua","orden":99},
  {"id":"9bff995e-6b5f-4ef7-b546-f571411028c8","nombre":"Broca","orden":99},
  {"id":"263a7f3b-b490-4808-b4ff-440c5b348e24","nombre":"Tubería","orden":99},
  {"id":"8e2b27f9-6d43-4c35-9363-bae3226bf34c","nombre":"Lijas","orden":99},
  {"id":"2c256f61-3bd4-42eb-9df9-aa60721dace3","nombre":"Lija","orden":99},
  {"id":"b35111d9-52f7-4940-8754-7dfdacf4cdbd","nombre":"Luz","orden":99},
  {"id":"cd2f4c93-f742-44b2-a292-a71a330f00b8","nombre":"Agua","orden":99},
  {"id":"9fdc404d-b5dd-4527-bb95-dc9302ee53f5","nombre":"Disco","orden":99},
  {"id":"e0bbe9a8-8102-4a1a-9d83-dfebae445950","nombre":"Desagüe","orden":99},
  {"id":"26a05c3f-3ceb-4d2e-b8f3-f821c9a36984","nombre":"Madera","orden":99},
  {"id":"af3b82ba-04f5-49c0-8422-48d4fa85b5ed","nombre":"tuberia","orden":99},
  {"id":"61f37419-f2b0-4518-9074-519ea572387f","nombre":"materiales","orden":99},
  {"id":"fec315c0-4f8c-48dd-a9d2-bc4f00aa131c","nombre":"Caños","orden":0}
];

function escapeSQLString(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${val.toString().replace(/'/g, "''")}'`;
}

try {
  const content = fs.readFileSync(inputPath, 'utf8');
  
  // Parse the outer JSON first
  const fileData = JSON.parse(content);
  const resultStr = fileData.result;

  // Extract JSON string from resultStr between the first '[' and last ']'
  const startIdx = resultStr.indexOf('[');
  const endIdx = resultStr.lastIndexOf(']');
  
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Could not find JSON array in output.txt result property');
  }

  const jsonStr = resultStr.substring(startIdx, endIdx + 1);
  const products = JSON.parse(jsonStr);

  console.log(`Loaded ${products.length} products and ${categories.length} categories.`);

  let sql = '-- Migration script: replace catalog\n';
  sql += 'BEGIN;\n\n';
  
  // 1. Delete all alias_productos, productos, and categorias
  sql += 'DELETE FROM alias_productos;\n';
  sql += 'DELETE FROM productos;\n';
  sql += 'DELETE FROM categorias;\n\n';

  // 2. Insert categories
  sql += '-- Inserting categories\n';
  categories.forEach(cat => {
    sql += `INSERT INTO categorias (id, ferreteria_id, nombre, orden) VALUES (${escapeSQLString(cat.id)}, ${escapeSQLString(TARGET_FERRETERIA_ID)}, ${escapeSQLString(cat.nombre)}, ${cat.orden});\n`;
  });
  sql += '\n';

  // 3. Insert products
  sql += '-- Inserting products\n';
  products.forEach(p => {
    const cols = [
      'id', 'ferreteria_id', 'categoria_id', 'nombre', 'descripcion', 
      'precio_base', 'unidad', 'stock', 'modo_negociacion', 
      'umbral_negociacion_cantidad', 'activo', 'precio_compra', 'stock_minimo', 
      'afecto_igv', 'venta_sin_stock', 'proveedor', 'marca', 'codigo_barras', 'facturable'
    ];
    const vals = [
      escapeSQLString(p.id),
      escapeSQLString(TARGET_FERRETERIA_ID),
      p.categoria_id ? escapeSQLString(p.categoria_id) : 'NULL',
      escapeSQLString(p.nombre),
      p.descripcion ? escapeSQLString(p.descripcion) : 'NULL',
      p.precio_base ? p.precio_base : '0.00',
      escapeSQLString(p.unidad),
      p.stock !== null ? p.stock : '0',
      p.modo_negociacion ? 'true' : 'false',
      p.umbral_negociacion_cantidad !== null ? p.umbral_negociacion_cantidad : 'NULL',
      p.activo ? 'true' : 'false',
      p.precio_compra !== null ? p.precio_compra : '0.00',
      p.stock_minimo !== null ? p.stock_minimo : 'NULL',
      p.afecto_igv ? 'true' : 'false',
      p.venta_sin_stock ? 'true' : 'false',
      p.proveedor ? escapeSQLString(p.proveedor) : 'NULL',
      p.marca ? escapeSQLString(p.marca) : 'NULL',
      p.codigo_barras ? escapeSQLString(p.codigo_barras) : 'NULL',
      p.facturable ? 'true' : 'false'
    ];
    
    sql += `INSERT INTO productos (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`;
  });
  
  // 4. Update the sequences table so that new product codes start at products.length
  sql += `\n-- Reset sequence for product codes\n`;
  sql += `INSERT INTO secuencias_codigo_producto (ferreteria_id, ultimo_numero) \n`;
  sql += `VALUES (${escapeSQLString(TARGET_FERRETERIA_ID)}, ${products.length}) \n`;
  sql += `ON CONFLICT (ferreteria_id) DO UPDATE SET ultimo_numero = ${products.length};\n\n`;

  sql += 'COMMIT;\n';

  fs.writeFileSync(outputPath, sql, 'utf8');
  console.log(`Generated SQL file at ${outputPath}`);
} catch (e) {
  console.error('Error generating migration SQL:', e);
  fs.writeFileSync(path.join(__dirname, 'error.log'), e.stack || e.message, 'utf8');
}
