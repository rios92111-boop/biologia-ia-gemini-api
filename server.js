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
- Nivel: Bachillerato, especialmente 3ro BGU.
- Rol del usuario: ${rol || "estudiante"}.
- Curso actual: ${curso || "Biología 3ro BGU"}.
- Tema actual: ${tema || "Ciencias Naturales"}.
- Función pedagógica: BIA es el núcleo del prototipo; debe orientar, explicar, crear recursos didácticos y apoyar actividades según el rol.

Reglas:
- Responde siempre en español.
- Sé claro, educativo, amable y directo.
- Si responde a estudiante, guía y explica; no hagas toda la tarea sin enseñar.
- Si responde a docente, ayuda a generar actividades, recursos, rúbricas y cuestionarios.
- Mantén el enfoque en Biología y Ciencias Naturales.
- Usa ejemplos adecuados para estudiantes de bachillerato.
- No inventes datos institucionales.
- No uses asteriscos de Markdown ni títulos con **texto**.
- No uses lenguaje infantil, expresiones coloquiales ni metáforas demasiado simples.
- Cuando el rol sea estudiante, inicia con: "Estimado estudiante, lo que buscas es...".
- Cuando el rol sea docente, inicia con: "Estimado docente, lo que buscas es...".
- Cuando el rol sea administrador, inicia con: "Estimado administrador, lo que buscas es...".
- Organiza las respuestas, cuando corresponda, con: Lo importante, Explicación clara, Ejemplo aplicado, Para reforzar e Imagen sugerida o esquema recomendado.
- Si piden crear una imagen, actúa como diseñador educativo visual: entrega título, objetivo, elementos, texto, composición, colores y un prompt listo para generar una imagen. No afirmes que la imagen ya fue creada cuando solo entregas texto.
`;
}

async function generarTextoGemini(prompt) {
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: prompt
  });

  return response.text || "No se pudo generar una respuesta.";
}

function extraerImagenDesdeRespuesta(data) {
  if (!data || typeof data !== "object") return null;

  const direct = data.output_image || data.outputImage || data.image || data.generatedImage;
  if (direct?.data) {
    return {
      data: direct.data,
      mimeType: direct.mime_type || direct.mimeType || "image/png"
    };
  }

  if (data.inlineData?.data) {
    return {
      data: data.inlineData.data,
      mimeType: data.inlineData.mimeType || "image/png"
    };
  }

  for (const value of Object.values(data)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = extraerImagenDesdeRespuesta(item);
        if (found) return found;
      }
    } else if (value && typeof value === "object") {
      const found = extraerImagenDesdeRespuesta(value);
      if (found) return found;
    }
  }

  return null;
}

function extraerTextoDesdeRespuesta(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.output_text === "string") return data.output_text;
  if (typeof data.outputText === "string") return data.outputText;
  if (typeof data.text === "string") return data.text;
  return "";
}

async function generarImagenGemini(prompt) {
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

  if (ai.interactions?.create) {
    const interaction = await ai.interactions.create({
      model,
      input: prompt
    });

    const imagen = extraerImagenDesdeRespuesta(interaction);
    if (imagen?.data) {
      return {
        imageBase64: imagen.data,
        mimeType: imagen.mimeType || "image/png",
        descripcion: extraerTextoDesdeRespuesta(interaction)
      };
    }
  }

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      model,
      input: [{ type: "text", text: prompt }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const detail = data?.error?.message || "La API de imagen no respondió correctamente.";
    throw new Error(detail);
  }

  const imagen = extraerImagenDesdeRespuesta(data);
  if (!imagen?.data) {
    throw new Error("Gemini respondió, pero no devolvió una imagen. Revisa el modelo GEMINI_IMAGE_MODEL.");
  }

  return {
    imageBase64: imagen.data,
    mimeType: imagen.mimeType || "image/png",
    descripcion: extraerTextoDesdeRespuesta(data)
  };
}

function buildEducationalImagePrompt({ tema, curso, rol, contexto }) {
  return `
Crea una imagen educativa para el aula virtual Atahualpa.

Tema: ${tema || "Ciencias Naturales"}
Curso: ${curso || "Ciencias Naturales"}
Rol del solicitante: ${rol || "estudiante"}
Contexto: ${contexto ? JSON.stringify(contexto) : "sin contexto"}

Requisitos visuales:
- Debe ser una imagen didáctica, clara y adecuada para estudiantes de 3ro de bachillerato.
- Estilo: ilustración educativa moderna, limpia, científica y no infantil.
- Usar colores verdes, blancos, azules suaves y tonos naturales, coherentes con Atahualpa.
- Evitar exceso de texto. Si incluyes texto, que sea breve, legible y en español.
- Mostrar el proceso o concepto principal con flechas, etiquetas simples e íconos científicos.
- No incluir marcas comerciales ni rostros reales.
- Formato recomendado: infografía horizontal para aula virtual.
`.trim();
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "API Biología IA con Gemini funcionando"
  });
});

app.get("/api/salud", (req, res) => {
  res.json({
    ok: true,
    message: "API Biología IA con Gemini funcionando",
    alias: "/api/health"
  });
});

app.post("/api/ia/chat", async (req, res) => {
  try {
    const { mensaje, rol, tema, curso, contexto } = req.body;

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

Contexto adicional de navegación:
${contexto ? JSON.stringify(contexto, null, 2) : "Sin contexto adicional"}

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


app.post("/api/agente/probar", async (req, res) => {
  try {
    const { mensaje, rol, tema, curso } = req.body;

    if (!mensaje || mensaje.trim().length < 2) {
      return res.status(400).json({ ok: false, error: "Escribe una pregunta válida." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ ok: false, error: "Falta configurar GEMINI_API_KEY en el backend." });
    }

    const prompt = `${buildSystemPrompt({ rol, tema, curso })}

Pregunta del usuario:
${mensaje}`;

    const respuesta = await generarTextoGemini(prompt);
    res.json({ ok: true, respuesta });
  } catch (error) {
    console.error("Error en /api/agente/probar:", error);
    res.status(500).json({ ok: false, error: "No se pudo conectar con Gemini. Revisa GEMINI_API_KEY, cuota o modelo." });
  }
});

app.post("/api/ia/crear-imagen", async (req, res) => {
  try {
    const { tema = "Biología", mensaje = "", rol = "student", curso = "Ciencias Naturales", contexto } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ ok: false, error: "Falta configurar GEMINI_API_KEY en el backend." });
    }

    const temaFinal = mensaje?.trim() || tema;
    const prompt = buildEducationalImagePrompt({ tema: temaFinal, curso, rol, contexto });
    const result = await generarImagenGemini(prompt);
    const mimeType = result.mimeType || "image/png";

    res.json({
      ok: true,
      tipo: "imagen_generada",
      model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
      prompt,
      descripcion: result.descripcion || "Imagen educativa generada para el aula virtual.",
      mimeType,
      imageBase64: result.imageBase64,
      imageDataUrl: `data:${mimeType};base64,${result.imageBase64}`
    });
  } catch (error) {
    console.error("Error en /api/ia/crear-imagen:", error);
    res.status(500).json({
      ok: false,
      error: "No se pudo crear la imagen educativa. Revisa GEMINI_IMAGE_MODEL, cuota o disponibilidad del modelo de imagen.",
      detalle: error.message
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
