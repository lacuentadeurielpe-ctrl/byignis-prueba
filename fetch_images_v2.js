const fs = require('fs');

const products = [
    { name: 'Arroz Costeño', cat: 'abarrotes', code: 'BOD-001' },
    { name: 'Azucar Cartavio', cat: 'abarrotes', code: 'BOD-002' },
    { name: 'Aceite Primor', cat: 'abarrotes', code: 'BOD-003' },
    { name: 'Fideos Anita', cat: 'abarrotes', code: 'BOD-004' },
    { name: 'Avena Quaker', cat: 'abarrotes', code: 'BOD-005' },
    { name: 'Atun Florida', cat: 'abarrotes', code: 'BOD-006' },
    { name: 'Lentejas Costeño', cat: 'abarrotes', code: 'BOD-007' },
    { name: 'Sal Emsal', cat: 'abarrotes', code: 'BOD-008' },
    { name: 'Harina Blanca Flor', cat: 'abarrotes', code: 'BOD-009' },
    { name: 'Cafe Altomayo', cat: 'abarrotes', code: 'BOD-010' },
    { name: 'Inca Kola', cat: 'bebidas', code: 'BOD-011' },
    { name: 'Coca Cola', cat: 'bebidas', code: 'BOD-012' },
    { name: 'Agua San Luis', cat: 'bebidas', code: 'BOD-013' },
    { name: 'Frugos del Valle', cat: 'bebidas', code: 'BOD-014' },
    { name: 'Cerveza Cristal', cat: 'bebidas', code: 'BOD-015' },
    { name: 'Gatorade', cat: 'bebidas', code: 'BOD-016' },
    { name: 'Leche Gloria', cat: 'lacteos', code: 'BOD-017' },
    { name: 'Yogurt Gloria', cat: 'lacteos', code: 'BOD-018' },
    { name: 'Mantequilla Laive', cat: 'lacteos', code: 'BOD-019' },
    { name: 'Queso Edam Laive', cat: 'lacteos', code: 'BOD-020' },
    { name: 'Galletas Soda Field', cat: 'snacks', code: 'BOD-021' },
    { name: 'Galletas Oreo', cat: 'snacks', code: 'BOD-022' },
    { name: 'Papas Lays', cat: 'snacks', code: 'BOD-023' },
    { name: 'Chocolate Sublime', cat: 'snacks', code: 'BOD-024' },
    { name: 'Chifles Karinto', cat: 'snacks', code: 'BOD-025' },
    { name: 'Detergente Ariel', cat: 'limpieza', code: 'BOD-026' },
    { name: 'Jabon Bolivar', cat: 'limpieza', code: 'BOD-027' },
    { name: 'Lejia Clorox', cat: 'limpieza', code: 'BOD-028' },
    { name: 'Papel Higienico Suave', cat: 'limpieza', code: 'BOD-029' },
    { name: 'Pasta Dental Kolynos', cat: 'limpieza', code: 'BOD-030' }
];

const fallbacks = {
    'abarrotes': 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
    'bebidas': 'https://images.pexels.com/photos/2793774/pexels-photo-2793774.jpeg?auto=compress&cs=tinysrgb&w=800',
    'lacteos': 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg?auto=compress&cs=tinysrgb&w=800',
    'snacks': 'https://images.pexels.com/photos/1108117/pexels-photo-1108117.jpeg?auto=compress&cs=tinysrgb&w=800',
    'limpieza': 'https://images.pexels.com/photos/4239146/pexels-photo-4239146.jpeg?auto=compress&cs=tinysrgb&w=800'
};

// Some hardcoded URLs for the most famous Peruvian products so it looks great
const overrides = {
    'BOD-001': 'https://s7d2.scene7.com/is/image/PlazaVea/153123_1?wid=500&hei=500', // Arroz Costeño
    'BOD-002': 'https://s7d2.scene7.com/is/image/PlazaVea/121852_1?wid=500&hei=500', // Azúcar Cartavio
    'BOD-003': 'https://s7d2.scene7.com/is/image/PlazaVea/102602_1?wid=500&hei=500', // Aceite Primor
    'BOD-004': 'https://s7d2.scene7.com/is/image/PlazaVea/20067645_1?wid=500&hei=500', // Fideos Anita
    'BOD-005': 'https://s7d2.scene7.com/is/image/PlazaVea/74737_1?wid=500&hei=500', // Avena Quaker
    'BOD-006': 'https://s7d2.scene7.com/is/image/PlazaVea/111867_1?wid=500&hei=500', // Atún Florida
    'BOD-011': 'https://s7d2.scene7.com/is/image/PlazaVea/20202951_1?wid=500&hei=500', // Inca Kola
    'BOD-012': 'https://s7d2.scene7.com/is/image/PlazaVea/20127138_1?wid=500&hei=500', // Coca Cola
    'BOD-017': 'https://s7d2.scene7.com/is/image/PlazaVea/20078726_1?wid=500&hei=500', // Leche Gloria
    'BOD-018': 'https://s7d2.scene7.com/is/image/PlazaVea/20088916_1?wid=500&hei=500', // Yogurt Gloria
    'BOD-021': 'https://s7d2.scene7.com/is/image/PlazaVea/20138985_1?wid=500&hei=500', // Galletas Field
    'BOD-022': 'https://s7d2.scene7.com/is/image/PlazaVea/111467_1?wid=500&hei=500', // Oreo
    'BOD-023': 'https://s7d2.scene7.com/is/image/PlazaVea/20076757_1?wid=500&hei=500', // Papas Lays
    'BOD-024': 'https://s7d2.scene7.com/is/image/PlazaVea/73426_1?wid=500&hei=500', // Sublime
    'BOD-026': 'https://s7d2.scene7.com/is/image/PlazaVea/20150917_1?wid=500&hei=500', // Ariel
    'BOD-027': 'https://s7d2.scene7.com/is/image/PlazaVea/20140733_1?wid=500&hei=500', // Jabon Bolivar
    'BOD-028': 'https://s7d2.scene7.com/is/image/PlazaVea/87747_1?wid=500&hei=500', // Clorox
    'BOD-029': 'https://s7d2.scene7.com/is/image/PlazaVea/20227914_1?wid=500&hei=500', // Papel Suave
};

async function run() {
    let sql_statements = [];
    
    for (let p of products) {
        let imgUrl = overrides[p.code];
        
        if (!imgUrl) {
            try {
                const query = encodeURIComponent(p.name);
                const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.products && data.products.length > 0 && data.products[0].image_url) {
                    imgUrl = data.products[0].image_url;
                    console.log(`Found image for ${p.name}: ${imgUrl}`);
                }
            } catch (e) {
                console.error('Error fetching for', p.name);
            }
        }
        
        if (!imgUrl) {
            imgUrl = fallbacks[p.cat];
            console.log(`Using fallback for ${p.name}`);
        }
        
        let jsonVal = JSON.stringify([imgUrl]).replace(/'/g, "''");
        sql_statements.push(`UPDATE productos SET imagenes = '${jsonVal}'::jsonb WHERE codigo_interno = '${p.code}' AND ferreteria_id = '289fbbc4-a3f6-4080-b34b-3cf591992235';`);
        
        await new Promise(r => setTimeout(r, 500));
    }
    
    fs.writeFileSync('update_images.sql', sql_statements.join('\n'));
    console.log('Done! SQL written to update_images.sql');
}

run();
