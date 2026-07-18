import urllib.request
import re
import json

products = [
    'Arroz Costeño 1kg', 'Azúcar Rubia Cartavio 1kg', 'Aceite Primor Clásico 1L', 'Fideos Anita Spaghetti 500g', 'Avena Quaker 300g', 
    'Atún Florida 170g', 'Menestra Lentejitas Costeño 500g', 'Sal Marina Emsal 1kg', 'Harina Blanca Flor 1kg', 'Café Altomayo Clásico 250g',
    'Inca Kola 3L', 'Coca Cola 1.5L', 'Agua San Luis sin gas 625ml', 'Frugos del Valle Durazno 1L', 'Cerveza Cristal 650ml', 'Gatorade Tropical Fruit 500ml',
    'Leche Evaporada Gloria Azul 400g', 'Yogurt Gloria Fresa 1kg', 'Mantequilla Laive 200g', 'Queso Edam Laive 250g',
    'Galletas Soda Field', 'Galletas Oreo 36g', 'Papas Lays Clásicas 160g', 'Chocolate Sublime Clásico 30g', 'Chifles Karinto 100g',
    'Detergente Ariel 800g', 'Jabón Bolívar Rosa 150g', 'Lejía Clorox 1L', 'Papel Higiénico Suave 4 rollos', 'Pasta Dental Kolynos 90g'
]

product_codes = [
    'BOD-001', 'BOD-002', 'BOD-003', 'BOD-004', 'BOD-005', 'BOD-006', 'BOD-007', 'BOD-008', 'BOD-009', 'BOD-010',
    'BOD-011', 'BOD-012', 'BOD-013', 'BOD-014', 'BOD-015', 'BOD-016', 'BOD-017', 'BOD-018', 'BOD-019', 'BOD-020',
    'BOD-021', 'BOD-022', 'BOD-023', 'BOD-024', 'BOD-025', 'BOD-026', 'BOD-027', 'BOD-028', 'BOD-029', 'BOD-030'
]

sql_statements = []

for prod, code in zip(products, product_codes):
    try:
        url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(prod + ' producto peru supermercado')
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        html = urllib.request.urlopen(req).read().decode('utf-8')
        
        images = re.findall(r'//external-content\.duckduckgo\.com/iu/\?u=([^&\"\'\?]+)', html)
        if images:
            img_url = urllib.parse.unquote(images[0])
            if img_url.startswith('http'):
                pass
            else:
                img_url = f'https://ui-avatars.com/api/?name={urllib.parse.quote(prod)}&background=random&size=512'
        else:
            img_url = f'https://ui-avatars.com/api/?name={urllib.parse.quote(prod)}&background=random&size=512'
            
        json_val = json.dumps([img_url]).replace("'", "''")
        sql_statements.append(f"UPDATE productos SET imagenes = '{json_val}'::jsonb WHERE codigo_interno = '{code}' AND ferreteria_id = '289fbbc4-a3f6-4080-b34b-3cf591992235';")
    except Exception as e:
        img_url = f'https://ui-avatars.com/api/?name={urllib.parse.quote(prod)}&background=random&size=512'
        json_val = json.dumps([img_url]).replace("'", "''")
        sql_statements.append(f"UPDATE productos SET imagenes = '{json_val}'::jsonb WHERE codigo_interno = '{code}' AND ferreteria_id = '289fbbc4-a3f6-4080-b34b-3cf591992235';")

with open('update_images.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_statements))
print('Done. SQL saved to update_images.sql')
