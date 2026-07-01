# Greenter API — Microservicio SUNAT

Microservicio PHP que expone una API REST para emitir comprobantes electrónicos SUNAT directamente, sin intermediarios como Nubefact.

Usa la librería **[Greenter](https://github.com/thegreenter/greenter)** — la librería PHP más completa para SUNAT en Perú (maneja XML UBL 2.1, firma XAdES-BES, ZIP, SOAP y parseo de CDR).

## Deploy rápido en Railway

```bash
# 1. Fork este directorio como repo separado
# 2. En Railway: New Project → Deploy from GitHub → seleccionar el repo
# 3. Railway detecta el Dockerfile automáticamente
# 4. Copiar la URL pública (ej: https://greenter-api-xxxx.up.railway.app)
# 5. Pegar esa URL en Settings → Integraciones → SUNAT Directo
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/verificar` | Verifica credenciales SUNAT (sin emitir) |
| POST | `/boleta/emitir` | Emite una boleta de venta electrónica |
| POST | `/factura/emitir` | Emite una factura electrónica |
| POST | `/nota-credito/emitir` | Emite una nota de crédito |

## Payload base (todos los endpoints de emisión)

```json
{
  "modo": "beta",
  "ruc": "20123456789",
  "emisor": {
    "ruc": "20123456789",
    "razon_social": "Mi Ferretería S.A.C.",
    "serie": "B001",
    "numero": 1
  },
  "sol": {
    "usuario": "MODDATOS",
    "clave": "mi-clave-sol"
  },
  "certificado": {
    "pfx_base64": "<base64 del archivo .pfx>",
    "clave": "clave-del-pfx"
  },
  "cliente": {
    "tipo_doc": "1",
    "numero_doc": "12345678",
    "nombre": "Juan Pérez"
  },
  "igv_incluido": false,
  "items": [
    {
      "descripcion": "Cemento 42.5kg",
      "cantidad": 5,
      "precio_unitario": 28.50,
      "unidad": "SAC"
    }
  ]
}
```

## Seguridad

- Las credenciales viajan cifradas en tránsito (HTTPS).
- Este microservicio **no persiste** las credenciales — las recibe en cada request y las usa una vez.
- En producción, asegúrate de que este servicio solo sea accesible desde tu app Next.js (whitelist de IPs o token de autenticación).

## Variables de entorno opcionales

```bash
AUTH_TOKEN=secret123   # Si se configura, todos los requests deben incluir Authorization: Bearer secret123
```
