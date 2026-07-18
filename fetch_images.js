const fs = require('fs');

const products = [
    'Arroz Costeño 1kg', 'Azúcar Rubia Cartavio 1kg', 'Aceite Primor Clásico 1L', 'Fideos Anita Spaghetti 500g', 'Avena Quaker 300g', 
    'Atún Florida 170g', 'Menestra Lentejitas Costeño 500g', 'Sal Marina Emsal 1kg', 'Harina Blanca Flor 1kg', 'Café Altomayo Clásico 250g',
    'Inca Kola 3L', 'Coca Cola 1.5L', 'Agua San Luis sin gas 625ml', 'Frugos del Valle Durazno 1L', 'Cerveza Cristal 650ml', 'Gatorade Tropical Fruit 500ml',
    'Leche Evaporada Gloria Azul 400g', 'Yogurt Gloria Fresa 1kg', 'Mantequilla Laive 200g', 'Queso Edam Laive 250g',
    'Galletas Soda Field', 'Galletas Oreo 36g', 'Papas Lays Clásicas 160g', 'Chocolate Sublime Clásico 30g', 'Chifles Karinto 100g',
    'Detergente Ariel 800g', 'Jabón Bolívar Rosa 150g', 'Lejía Clorox 1L', 'Papel Higiénico Suave 4 rollos', 'Pasta Dental Kolynos 90g'
];

const product_codes = [
    'BOD-001', 'BOD-002', 'BOD-003', 'BOD-004', 'BOD-005', 'BOD-006', 'BOD-007', 'BOD-008', 'BOD-009', 'BOD-010',
    'BOD-011', 'BOD-012', 'BOD-013', 'BOD-014', 'BOD-015', 'BOD-016', 'BOD-017', 'BOD-018', 'BOD-019', 'BOD-020',
    'BOD-021', 'BOD-022', 'BOD-023', 'BOD-024', 'BOD-025', 'BOD-026', 'BOD-027', 'BOD-028', 'BOD-029', 'BOD-030'
];

async function run() {
    let sql_statements = [];
    
    for (let i = 0; i < products.length; i++) {
        let prod = products[i];
        let code = product_codes[i];
        let imgUrl = '';
        
        try {
            const query = encodeURIComponent(prod + ' producto supermercado peru');
            const url = `https://html.duckduckgo.com/html/?q=${query}`;
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });
            const text = await response.text();
            
            // Try to extract an image URL
            const match = text.match(/\/\/external-content\.duckduckgo\.com\/iu\/\?u=([^&"']+)/);
            if (match && match[1]) {
                imgUrl = decodeURIComponent(match[1]);
            }
        } catch (e) {
            console.error('Error fetching for', prod);
        }
        
        if (imgUrl) {
            let jsonVal = JSON.stringify([imgUrl]).replace(/'/g, "''");
            sql_statements.push(`UPDATE productos SET imagenes = '${jsonVal}'::jsonb WHERE codigo_interno = '${code}' AND ferreteria_id = '289fbbc4-a3f6-4080-b34b-3cf591992235';`);
            console.log(`Found image for ${prod}: ${imgUrl}`);
        } else {
            console.log(`No image found for ${prod}`);
        }
        
        // Wait a bit to not get blocked
        await new Promise(r => setTimeout(r, 1000));
    }
    
    fs.writeFileSync('update_images.sql', sql_statements.join('\n'));
    console.log('Done! SQL written to update_images.sql');
}

run();
