import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/genai';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3001;

// --- Configuración ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors()); // Permite peticiones de otros orígenes (tu frontend de Vite)
app.use(express.json());

// Configuración de Multer para manejar la subida de archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Inicializa el cliente de Google GenAI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Convierte un buffer de archivo a un formato que GenAI entiende.
 * @param {Express.Multer.File} file - El archivo subido con Multer.
 * @returns {{inlineData: {data: string, mimeType: string}}}
 */
const fileToGenerativePart = (file) => {
  return {
    inlineData: {
      data: file.buffer.toString("base64"),
      mimeType: file.mimetype,
    },
  };
};

// --- Endpoints de API ---

app.post('/api/ocr', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se ha subido ninguna imagen." });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
    const imagePart = fileToGenerativePart(req.file);
    
    // El prompt viene en el cuerpo de la petición
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: "No se ha proporcionado un prompt." });
    }

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Intenta parsear el texto como JSON antes de enviarlo
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Error en la API de Gemini:", error);
    res.status(500).json({ error: "Error al procesar la imagen con la IA." });
  }
});

// --- Servir la aplicación de React en producción ---
if (process.env.NODE_ENV === 'production') {
  // Sirve los archivos estáticos generados por Vite
  app.use(express.static(path.join(__dirname, 'dist')));

  // Para cualquier otra ruta, sirve el index.html de React
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});