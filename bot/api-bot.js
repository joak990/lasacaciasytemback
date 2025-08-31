// api-bot.js
// Bot de WhatsApp usando API externa (más simple)

const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const greetedUsers = new Set();
const userMessageCounts = new Map();

// Función para generar respuesta con Gemini
async function getGeminiResponse(messageText) {
  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent",
      {
        contents: [
          {
            parts: [
              {
                text: "Eres un bot de WhatsApp creado por Josue Hoenicka, pero tienes uso de razonamiento porque eres Gemini la AI de Google, ahora debes responder el siguiente mensaje que acabas de recibir (y debes decir del mensaje [Bot Gemini AI creado por Josue Hoenicka] :" + messageText,
              },
            ],
          },
        ],
      },
      {
        params: { key: process.env.GEMINI_API_KEY },
        headers: { "Content-Type": "application/json" },
      }
    );

    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "No pude generar una respuesta. Inténtalo nuevamente.";
  } catch (error) {
    console.error("Error en la API de Gemini:", error.response?.data || error.message);
    return "Ocurrió un error al obtener una respuesta de la IA.";
  }
}

// Función para enviar mensaje (usando API externa)
async function sendWhatsAppMessage(to, message) {
  try {
    // Aquí puedes usar diferentes APIs de WhatsApp
    // Ejemplo con una API gratuita
    const response = await axios.post('https://api.whatsapp.com/send', {
      phone: to,
      message: message,
      // Agrega aquí tu API key si es necesario
    });
    return response.data;
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    throw error;
  }
}

// Endpoint para recibir mensajes
app.post('/webhook', async (req, res) => {
  const { from, message } = req.body;
  const user = from;
  const messageText = message.toLowerCase().trim();

  console.log(`📨 Mensaje recibido de ${user}: ${message}`);

  // Respuesta inicial para saludos
  if (messageText === "hola" && !greetedUsers.has(user)) {
    console.log("👋 Respondiendo saludo inicial");
    greetedUsers.add(user);
    
    try {
      await sendWhatsAppMessage(user, "¡Hola! Soy el bot de Josue. ¿En qué puedo ayudarte?");
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    }
    return res.status(200).send('OK');
  }

  // Despedida
  if (messageText === "adiós") {
    console.log("👋 Respondiendo despedida");
    try {
      await sendWhatsAppMessage(user, "¡Adiós! Fue un gusto hablar contigo.");
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    }
    return res.status(200).send('OK');
  }

  // Control de límite de mensajes
  let userData = userMessageCounts.get(user);
  const now = Date.now();

  if (!userData) {
    userData = { count: 1, firstMessageTime: now };
  } else {
    const timeElapsed = now - userData.firstMessageTime;
    if (timeElapsed > 3600000) {
      userData.count = 1;
      userData.firstMessageTime = now;
    } else {
      userData.count += 1;
    }
  }

  console.log("📊 userData: ", userData);
  userMessageCounts.set(user, userData);

  if (userData.count > 15) {
    console.log("⚠️ Límite de mensajes alcanzado");
    try {
      await sendWhatsAppMessage(user, "Lo siento, alcanzaste el límite de preguntas por hora.");
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    }
    return res.status(200).send('OK');
  }

  // Generar respuesta con IA
  try {
    console.log("🤖 Generando respuesta con Gemini...");
    const aiResponse = await getGeminiResponse(message);
    console.log("✅ Respuesta generada:", aiResponse.substring(0, 50) + "...");
    
    await sendWhatsAppMessage(user, aiResponse);
  } catch (error) {
    console.error("❌ Error al procesar mensaje:", error);
    try {
      await sendWhatsAppMessage(user, "Lo siento, hubo un error al procesar tu mensaje.");
    } catch (sendError) {
      console.error("Error enviando mensaje de error:", sendError);
    }
  }

  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🤖 Bot de WhatsApp iniciado en puerto ${PORT}`);
  console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
});

module.exports = app;



