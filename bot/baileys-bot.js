// baileys-bot.js
// Bot de WhatsApp usando Baileys (funciona con tu número actual)

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

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

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  
  const sock = makeWASocket({
    auth: state,
    browser: ['Bot de Josue', 'Chrome', '1.0.0']
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('🔍 Código QR generado - Escanea con tu WhatsApp:');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('🔌 Conexión cerrada debido a ', lastDisconnect?.error, ', reconectando ', shouldReconnect);
      
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ Conectado a WhatsApp exitosamente!');
      console.log('🤖 Bot listo para recibir mensajes');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    
    if (!msg.key.fromMe && msg.message) {
      const user = msg.key.remoteJid;
      const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      
      if (!messageText) return;
      
      console.log(`📨 Mensaje recibido de ${user}: ${messageText}`);
      
      const messageLower = messageText.toLowerCase().trim();
      
      // Respuesta inicial para saludos
      if (messageLower === "hola" && !greetedUsers.has(user)) {
        console.log("👋 Respondiendo saludo inicial");
        greetedUsers.add(user);
        
        await sock.sendMessage(user, { text: "¡Hola! Soy el bot de Josue. ¿En qué puedo ayudarte?" });
        return;
      }
      
      // Despedida
      if (messageLower === "adiós") {
        console.log("👋 Respondiendo despedida");
        await sock.sendMessage(user, { text: "¡Adiós! Fue un gusto hablar contigo." });
        return;
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
        await sock.sendMessage(user, { text: "Lo siento, alcanzaste el límite de preguntas por hora." });
        return;
      }
      
      // Generar respuesta con IA
      try {
        console.log("🤖 Generando respuesta con Gemini...");
        const aiResponse = await getGeminiResponse(messageText);
        console.log("✅ Respuesta generada:", aiResponse.substring(0, 50) + "...");
        
        await sock.sendMessage(user, { text: aiResponse });
      } catch (error) {
        console.error("❌ Error al procesar mensaje:", error);
        await sock.sendMessage(user, { text: "Lo siento, hubo un error al procesar tu mensaje." });
      }
    }
  });
}

// Iniciar el bot
console.log('🚀 Iniciando bot de WhatsApp con Baileys...');
connectToWhatsApp().catch(err => console.log("Error inesperado", err));
