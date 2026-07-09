# API Biología IA con Gemini

## Probar local

```bash
cd api-gemini
npm install
cp .env.example .env
npm start
```

Abre:

```txt
http://localhost:3000/api/health
```

## Variables en Render

- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-2.5-flash`
- `FRONTEND_URL=https://tu-sitio.netlify.app`

## Endpoint principal

```http
POST /api/ia/chat
```


## V44 - Imagen educativa real con Gemini

Se agregó la ruta:

```txt
POST /api/ia/crear-imagen
```

Variables recomendadas en Render:

```txt
GEMINI_API_KEY=tu_api_key_real
GEMINI_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
FRONTEND_URL=*
```

Si el modelo de imagen no está disponible en tu cuenta o región, el chat de texto seguirá funcionando, pero la creación de imagen devolverá un aviso para revisar el modelo, cuota o disponibilidad.
