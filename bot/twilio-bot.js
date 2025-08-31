// twilio-bot.js
// Bot de WhatsApp usando Twilio API (más confiable)

const express = require('express');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const greetedUsers = new Set();
const userMessageCounts = new Map();

// Función para generar respuesta con Gemini
async function getGeminiResponse(messageText) {
  try {
    const axios = require('axios');
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

// Endpoint para recibir mensajes de WhatsApp
app.post('/webhook', async (req, res) => {
  const { From, Body } = req.body;
  const user = From;
  const messageText = Body.toLowerCase().trim();

  console.log(`📨 Mensaje recibido de ${user}: ${Body}`);

  // Respuesta inicial para saludos
  if (messageText === "hola" && !greetedUsers.has(user)) {
    console.log("👋 Respondiendo saludo inicial");
    greetedUsers.add(user);
    
    try {
      await client.messages.create({
        body: "¡Hola! Soy el bot de Josue. ¿En qué puedo ayudarte?",
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        to: user
      });
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    }
    return res.status(200).send('OK');
  }

  // Despedida
  if (messageText === "adiós") {
    console.log("👋 Respondiendo despedida");
    try {
      await client.messages.create({
        body: "¡Adiós! Fue un gusto hablar contigo.",
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        to: user
      });
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
      await client.messages.create({
        body: "Lo siento, alcanzaste el límite de preguntas por hora.",
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        to: user
      });
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    }
    return res.status(200).send('OK');
  }

  // Generar respuesta con IA
  try {
    console.log("🤖 Generando respuesta con Gemini...");
    const aiResponse = await getGeminiResponse(Body);
    console.log("✅ Respuesta generada:", aiResponse.substring(0, 50) + "...");
    
    await client.messages.create({
      body: aiResponse,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: user
    });
  } catch (error) {
    console.error("❌ Error al procesar mensaje:", error);
    try {
      await client.messages.create({
        body: "Lo siento, hubo un error al procesar tu mensaje.",
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        to: user
      });
    } catch (sendError) {
      console.error("Error enviando mensaje de error:", sendError);
    }
  }

  res.status(200).send('OK');
});

// Endpoint para verificar webhook
app.get('/webhook', (req, res) => {
  res.status(200).send('Bot de WhatsApp funcionando correctamente');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🤖 Bot de WhatsApp iniciado en puerto ${PORT}`);
  console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`📋 Para usar con Twilio, configura el webhook en tu cuenta de Twilio`);
});

module.exports = app;



