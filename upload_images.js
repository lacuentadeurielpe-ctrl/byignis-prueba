const fs = require('fs');

const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcG5jc2ljb2V2aGxpYW94ZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDU2MzQsImV4cCI6MjA5NjAyMTYzNH0.YCPa6frtS0BWyqnrV4DK6Xcvl4Es_EpRk7bgIB2zeIA';
const projectUrl = 'https://copncsicoevhliaoxfpj.supabase.co';
const bucketName = 'productos-imagenes';
const ferreteriaId = '289fbbc4-a3f6-4080-b34b-3cf591992235';

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

const overrides = {
    'BOD-001': 'https://s7d2.scene7.com/is/image/PlazaVea/153123_1?wid=500&hei=500', 
    'BOD-002': 'https://s7d2.scene7.com/is/image/PlazaVea/121852_1?wid=500&hei=500', 
    'BOD-003': 'https://s7d2.scene7.com/is/image/PlazaVea/102602_1?wid=500&hei=500', 
    'BOD-004': 'https://s7d2.scene7.com/is/image/PlazaVea/20067645_1?wid=500&hei=500', 
    'BOD-005': 'https://s7d2.scene7.com/is/image/PlazaVea/74737_1?wid=500&hei=500', 
    'BOD-006': 'https://s7d2.scene7.com/is/image/PlazaVea/111867_1?wid=500&hei=500', 
    'BOD-011': 'https://s7d2.scene7.com/is/image/PlazaVea/20202951_1?wid=500&hei=500', 
    'BOD-012': 'https://s7d2.scene7.com/is/image/PlazaVea/20127138_1?wid=500&hei=500', 
    'BOD-017': 'https://s7d2.scene7.com/is/image/PlazaVea/20078726_1?wid=500&hei=500', 
    'BOD-018': 'https://s7d2.scene7.com/is/image/PlazaVea/20088916_1?wid=500&hei=500', 
    'BOD-021': 'https://s7d2.scene7.com/is/image/PlazaVea/20138985_1?wid=500&hei=500', 
    'BOD-022': 'https://s7d2.scene7.com/is/image/PlazaVea/111467_1?wid=500&hei=500', 
    'BOD-023': 'https://s7d2.scene7.com/is/image/PlazaVea/20076757_1?wid=500&hei=500', 
    'BOD-024': 'https://s7d2.scene7.com/is/image/PlazaVea/73426_1?wid=500&hei=500', 
    'BOD-026': 'https://s7d2.scene7.com/is/image/PlazaVea/20150917_1?wid=500&hei=500', 
    'BOD-027': 'https://s7d2.scene7.com/is/image/PlazaVea/20140733_1?wid=500&hei=500', 
    'BOD-028': 'https://s7d2.scene7.com/is/image/PlazaVea/87747_1?wid=500&hei=500', 
    'BOD-029': 'https://s7d2.scene7.com/is/image/PlazaVea/20227914_1?wid=500&hei=500', 
};

async function uploadToSupabase(buffer, filename, contentType) {
    const url = `${projectUrl}/storage/v1/object/${bucketName}/${ferreteriaId}/${filename}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': contentType,
            // Overwrite if exists
            'x-upsert': 'true'
        },
        body: buffer
    });
    
    if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
    
    return `${projectUrl}/storage/v1/object/public/${bucketName}/${ferreteriaId}/${filename}`;
}

async function run() {
    let sql_statements = [];
    
    for (let p of products) {
        let sourceUrl = overrides[p.code];
        
        if (!sourceUrl) {
            try {
                const query = encodeURIComponent(p.name);
                const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.products && data.products.length > 0 && data.products[0].image_url) {
                    sourceUrl = data.products[0].image_url;
                }
            } catch (e) {
                // ignore
            }
        }
        
        if (!sourceUrl) {
            sourceUrl = fallbacks[p.cat];
        }
        
        console.log(`Downloading ${p.name} from ${sourceUrl}...`);
        
        try {
            const imgRes = await fetch(sourceUrl);
            const arrayBuffer = await imgRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
            let ext = contentType === 'image/png' ? 'png' : 'jpg';
            const filename = `${p.code}-${Date.now()}.${ext}`;
            
            console.log(`Uploading ${filename}...`);
            const publicUrl = await uploadToSupabase(buffer, filename, contentType);
            
            let jsonVal = JSON.stringify([publicUrl]).replace(/'/g, "''");
            sql_statements.push(`UPDATE productos SET imagenes = '${jsonVal}'::jsonb WHERE codigo_interno = '${p.code}' AND ferreteria_id = '${ferreteriaId}';`);
            console.log(`Success! Public URL: ${publicUrl}`);
        } catch (e) {
            console.error(`Failed for ${p.name}:`, e.message);
        }
        
        // Wait a bit to not get blocked
        await new Promise(r => setTimeout(r, 1000));
    }
    
    fs.writeFileSync('final_update_images.sql', sql_statements.join('\n'));
    console.log('Done! SQL written to final_update_images.sql');
}

run();
