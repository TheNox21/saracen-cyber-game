import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Google GenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// High-fidelity Realistic Studio Text-to-Speech Endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text, gender } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text prompt is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    // gemini-3.8-flash-lite-tts provides lifelike, studio-grade speech
    // Prebuilt realistic voices: 'Kore' (Warm, articulate female), 'Puck' (Clear, natural male)
    const isFemale = (gender === 'female');
    const voiceName = isFemale ? 'Kore' : 'Puck';
    const styleDescription = isFemale
      ? 'Warm, professional, crisp and encouraging corporate security leader'
      : 'Natural, authoritative, calm and friendly corporate security officer';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: styleDescription,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    // Unary returns a complete WAV file (audio/wav, 24kHz mono 16-bit RIFF)
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(502).json({ error: 'No audio data received from AI model' });
    }

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voiceName,
    });
  } catch (err: any) {
    console.error('Error in /api/tts:', err);
    res.status(500).json({
      error: err.message || 'Internal server error while generating realistic speech',
    });
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
