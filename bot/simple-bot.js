// simple-bot.js
// Bot de WhatsApp simple para consultas sobre cabañas (sin Gemini)

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');

const greetedUsers = new Set();
const userMessageCounts = new Map();

// Respuestas predefinidas para consultas sobre cabañas
const cabinResponses = {
  precios: "🏡 Los precios de nuestras cabañas varían según la temporada y el tipo de cabaña:\n\n• Cabaña Básica: $XX por noche\n• Cabaña Premium: $XX por noche\n• Cabaña Familiar: $XX por noche\n\nPara precios exactos y disponibilidad, contacta directamente al establecimiento. 📞",
  
  servicios: "✨ Nuestras cabañas incluyen:\n\n• WiFi gratuito\n• Cocina equipada\n• Calefacción\n• TV por cable\n• Estacionamiento\n• Terraza privada\n• Servicio de limpieza\n\n¿Te gustaría saber más sobre algún servicio específico?",
  
  ubicacion: "📍 Nuestras cabañas están ubicadas en [Ubicación específica].\n\nPara llegar:\n• En auto: [Instrucciones]\n• En transporte público: [Instrucciones]\n• Coordenadas GPS: [Coordenadas]\n\n¿Necesitas más detalles sobre cómo llegar?",
  
  reserva: "📅 Para hacer una reserva:\n\n• Llama al: [Número de teléfono]\n• WhatsApp: [Número de WhatsApp]\n• Email: [Email]\n\nPolíticas de cancelación:\n• Cancelación gratuita hasta 48h antes\n• Se requiere depósito del 30%\n\n¿Te ayudo con algo más?",
  
  actividades: "🎯 Actividades cercanas:\n\n• Senderismo en las montañas\n• Paseos en bicicleta\n• Visitas a bodegas\n• Restaurantes locales\n• Paseos por el centro\n• Actividades acuáticas\n\n¿Te interesa alguna actividad en particular?",
  
  checkin: "⏰ Horarios:\n\n• Check-in: 15:00 hs\n• Check-out: 11:00 hs\n\nLlegadas tardías:\n• Hasta las 22:00 hs (avisar con anticipación)\n\n¿Necesitas información sobre horarios especiales?"
};

// Función para generar respuesta simple
function getSimpleResponse(messageText) {
  const text = messageText.toLowerCase();
  
  if (text.includes('precio') || text.includes('costo') || text.includes('tarifa')) {
    return cabinResponses.precios;
  }
  
  if (text.includes('servicio') || text.includes('incluye') || text.includes('wifi')) {
    return cabinResponses.servicios;
  }
  
  if (text.includes('ubicacion') || text.includes('donde') || text.includes('llegar')) {
    return cabinResponses.ubicacion;
  }
  
  if (text.includes('reserva') || text.includes('reservar') || text.includes('cancelacion')) {
    return cabinResponses.reserva;
  }
  
  if (text.includes('actividad') || text.includes('hacer') || text.includes('turismo')) {
    return cabinResponses.actividades;
  }
  
  if (text.includes('check') || text.includes('horario') || text.includes('llegada')) {
    return cabinResponses.checkin;
  }
  
  return "🏡 Gracias por tu consulta. Para información específica sobre nuestras cabañas, te recomiendo contactar directamente al establecimiento:\n\n📞 Teléfono: [Número]\n📱 WhatsApp: [Número]\n📧 Email: [Email]\n\n¿Hay algo más en lo que pueda ayudarte?";
}

async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_simple');
    
    const sock = makeWASocket({
      auth: state,
      browser: ['Bot Cabañas', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      emitOwnEvents: false
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('🔍 Código QR generado - Escanea con tu WhatsApp:');
        qrcode.generate(qr, { small: true });
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('🔌 Conexión cerrada debido a ', lastDisconnect?.error?.message || 'error desconocido');
        
        if (shouldReconnect) {
          console.log('🔄 Intentando reconectar en 30 segundos...');
          setTimeout(() => {
            connectToWhatsApp();
          }, 30000);
        } else {
          console.log('❌ Sesión cerrada manualmente. No se reconectará.');
        }
      } else if (connection === 'open') {
        console.log('✅ Conectado a WhatsApp exitosamente!');
        console.log('🏡 Bot de Cabañas listo para recibir consultas');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      
      if (!msg.key.fromMe && msg.message) {
        const user = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        if (!messageText) return;
        
        console.log(`📨 Consulta recibida de ${user}: ${messageText}`);
        
        const messageLower = messageText.toLowerCase().trim();
        
        // Respuesta inicial para saludos
        if (messageLower === "hola" && !greetedUsers.has(user)) {
          console.log("👋 Respondiendo saludo inicial");
          greetedUsers.add(user);
          
          await sock.sendMessage(user, { 
            text: "¡Hola! 🏡 Soy el asistente virtual de las cabañas. Puedo ayudarte con información sobre:\n\n• Precios y tarifas\n• Servicios incluidos\n• Ubicación y cómo llegar\n• Políticas de reserva\n• Actividades cercanas\n• Horarios de check-in/out\n\n¿En qué puedo ayudarte?" 
          });
          return;
        }
        
        // Despedida
        if (messageLower === "adiós" || messageLower === "gracias") {
          console.log("👋 Respondiendo despedida");
          await sock.sendMessage(user, { 
            text: "¡Gracias por contactarnos! 🏡 Si tienes más consultas, no dudes en escribirnos. ¡Que tengas un excelente día!" 
          });
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
          await sock.sendMessage(user, { 
            text: "Has alcanzado el límite de consultas por hora. Para más información, contacta directamente al establecimiento. 📞" 
          });
          return;
        }
        
        // Generar respuesta simple
        try {
          console.log("🤖 Generando respuesta...");
          const response = getSimpleResponse(messageText);
          console.log("✅ Respuesta generada");
          
          await sock.sendMessage(user, { text: response });
        } catch (error) {
          console.error("❌ Error al procesar mensaje:", error);
          await sock.sendMessage(user, { 
            text: "Lo siento, hubo un error al procesar tu consulta. Por favor, contacta directamente al establecimiento para obtener la información que necesitas. 📞" 
          });
        }
      }
    });

  } catch (error) {
    console.error("❌ Error al conectar:", error);
    console.log("🔄 Intentando reconectar en 60 segundos...");
    setTimeout(() => {
      connectToWhatsApp();
    }, 60000);
  }
}

// Iniciar el bot
console.log('🚀 Iniciando bot de WhatsApp para Cabañas (versión simple)...');
connectToWhatsApp().catch(err => {
  console.log("❌ Error inesperado:", err);
  console.log("🔄 Reiniciando en 2 minutos...");
  setTimeout(() => {
    connectToWhatsApp();
  }, 120000);
});



