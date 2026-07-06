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
