import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const allowedOrigin = process.env.FRONTEND_URL || "*";

app.use(cors({
  origin: allowedOrigin === "*" ? "*" : allowedOrigin
}));

app.use(express.json({ limit: "1mb" }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

function buildSystemPrompt({ rol, tema, curso }) {
  return `
Eres Biología IA, el agente educativo central del EVEA Atahualpa.

Contexto:
- Plataforma: EVEA Atahualpa.
- Asignatura: Ciencias Naturales / Biología.
- Nivel: estudiantes de 3ro de bachillerato.
- Rol del usuario: ${rol || "estudiante"}.
- Curso actual: ${curso || "Biología 3ro BGU"}.
- Tema actual: ${tema || "Ciencias Naturales"}.

Estilo obligatorio:
- Responde siempre en español.
- Usa lenguaje educativo, claro, formal y adecuado para estudiantes de 3ro de bachillerato.
- Explica de forma comprensible, pero sin sonar infantil.
- No uses Markdown.
- No uses asteriscos.
- No uses comillas innecesarias.
- No uses frases como "es como", "imagina que", "manual de instrucciones", "receta", "cocineras", "superhéroes", "magia" o comparaciones infantiles.
- No uses metáforas simples para explicar conceptos científicos.
- Usa conceptos biológicos reales y vocabulario académico comprensible.
- Mantén un tono serio, académico y orientador.
- Si el estudiante no entiende, explica por partes, pero sin infantilizar.
- Evita respuestas demasiado largas.
- No inventes datos institucionales.

Forma de responder:
1. Define el concepto directamente.
2. Explica su función o importancia.
3. Da un ejemplo científico sencillo, sin metáforas infantiles.
4. Cierra con una idea breve de refuerzo.

Ejemplo de estilo correcto:
El ADN es una molécula que almacena la información genética de los seres vivos. Esta información participa en la producción de proteínas, el funcionamiento celular y la transmisión de características hereditarias.
`;
}

async function generarTextoGemini(prompt) {
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: prompt
  });

  return response.text || "No se pudo generar una respuesta.";
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "API Biología IA con Gemini funcionando"
  });
});

app.post("/api/ia/chat", async (req, res) => {
  try {
    const { mensaje, rol, tema, curso } = req.body;

    if (!mensaje || mensaje.trim().length < 2) {
      return res.status(400).json({
        ok: false,
        error: "Escribe una pregunta válida."
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Falta configurar GEMINI_API_KEY en el backend."
      });
    }

    const prompt = `${buildSystemPrompt({ rol, tema, curso })}

Pregunta del usuario:
${mensaje}`;

    const respuesta = await generarTextoGemini(prompt);

    res.json({
      ok: true,
      respuesta
    });
  } catch (error) {
    console.error("Error en /api/ia/chat:", error);
    res.status(500).json({
      ok: false,
      error: "No se pudo conectar con Gemini. Revisa GEMINI_API_KEY, cuota o modelo."
    });
  }
});

app.post("/api/ia/generar-actividad", async (req, res) => {
  try {
    const { tema = "Biología", grado = "3ro BGU" } = req.body;

    const prompt = `
${buildSystemPrompt({ rol: "docente", tema, curso: grado })}

Crea una actividad educativa para:
- Grado: ${grado}
- Tema: ${tema}

Devuelve:
1. Título
2. Objetivo de aprendizaje
3. Instrucciones para estudiantes
4. Materiales necesarios
5. Producto esperado
6. Criterios de evaluación
7. Puntaje sugerido
`;

    const actividad = await generarTextoGemini(prompt);

    res.json({
      ok: true,
      actividad
    });
  } catch (error) {
    console.error("Error en /api/ia/generar-actividad:", error);
    res.status(500).json({
      ok: false,
      error: "No se pudo generar la actividad."
    });
  }
});

app.post("/api/ia/generar-cuestionario", async (req, res) => {
  try {
    const { tema = "Biología", cantidad = 5 } = req.body;

    const prompt = `
${buildSystemPrompt({ rol: "docente", tema, curso: "3ro BGU" })}

Crea un cuestionario de Biología.
Tema: ${tema}
Cantidad de preguntas: ${cantidad}

Formato:
- Pregunta
- Opción A
- Opción B
- Opción C
- Opción D
- Respuesta correcta
- Explicación breve
`;

    const cuestionario = await generarTextoGemini(prompt);

    res.json({
      ok: true,
      cuestionario
    });
  } catch (error) {
    console.error("Error en /api/ia/generar-cuestionario:", error);
    res.status(500).json({
      ok: false,
      error: "No se pudo generar el cuestionario."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Biología IA API activa en puerto ${PORT}`);
});
