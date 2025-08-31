// stable-bot.js
// Bot de WhatsApp para Las Acacias - Respuestas personalizadas

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const greetedUsers = new Set();
const userMessageCounts = new Map();
const userSessions = new Map(); // Para manejar el flujo de reserva
const transferredUsers = new Set(); // Para usuarios transferidos a persona

// Variable global para el estado del bot
let botEnabled = true;
let disabledByKeyword = false; // Para controlar si fue deshabilitado por palabra clave

// Función para verificar el estado del bot desde el archivo local
function checkBotStatus() {
  // Si fue deshabilitado por palabra clave, no leer el archivo
  if (disabledByKeyword) {
    console.log(`🤖 Bot deshabilitado por palabra clave - NO leyendo archivo`);
    return;
  }
  
  try {
    const statusPath = path.join(__dirname, 'bot-status.json');
    if (fs.existsSync(statusPath)) {
      const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      botEnabled = statusData.enabled;
      console.log(`🤖 Estado del bot: ${botEnabled ? 'HABILITADO' : 'DESHABILITADO'}`);
    }
  } catch (error) {
    console.error('❌ Error verificando estado del bot:', error.message);
    // Si no se puede verificar, mantener el estado actual
  }
}

// Configuración del backend
const BACKEND_URL = 'http://localhost:3000/api'; // Cambia si tu backend está en otro puerto

// Función para limpiar la sesión y forzar nuevo QR
function clearSession() {
  try {
    const sessionPath = path.join(__dirname, 'auth_info_stable');
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log('🗑️ Sesión anterior eliminada');
    }
  } catch (error) {
    console.log('❌ Error eliminando sesión:', error.message);
  }
}

// Respuestas personalizadas para Las Acacias
const cabinResponses = {
  precios: "🏡 **Precios de Las Acacias Refugio:**\n\n• **Cabaña Beige:** $XX por noche\n• **Cabaña Maíz:** $XX por noche\n• **Cabaña Morada:** $XX por noche\n• **Cabaña Perla:** $XX por noche\n• **Cabaña Rosa:** $XX por noche\n• **Cabaña Turquesa:** $XX por noche\n\n💡 Los precios varían según temporada y disponibilidad.\n📞 Para precios exactos y reservas, contacta directamente.",
  
  servicios: "✨ **Servicios Incluidos en Las Acacias:**\n\n🏠 **Comodidades:**\n• WiFi gratuito en todo el establecimiento\n• TV por internet\n• Cámaras de seguridad en espacios comunes\n• Cochera semicubierta (media sombra)\n• Piscina incluida (horario 10:00 a 21:00hs)\n• Parrilla individual por cabaña\n\n🧹 **Servicios:**\n• Desayuno serrano incluido\n• Blanco (sábanas y toallas)\n• Servicio de lavandería (con cargo)\n• Servicio de bar\n\n🍽️ **Desayuno incluye:**\n• Infusiones\n• Pan casero\n• Criollos\n• Manteca y mermelada\n\n¿Te gustaría saber más sobre algún servicio específico?",
  
  ubicacion: "📍 **Ubicación de Las Acacias Refugio:**\n\n🗺️ **Dirección:** [Dirección específica]\n\n🚗 **Cómo llegar:**\n• [Instrucciones específicas]\n\n🌄 **Entorno:**\n• Ubicadas en las montañas\n• Vista panorámica del valle\n• Cerca de ríos y actividades turísticas\n\n📞 **Para información turística:**\n• Te brindamos información para acceder a varios ríos\n• Actividades cercanas disponibles\n\n¿Necesitas más detalles sobre cómo llegar?",
  
  reserva: "📅 **Sistema de Reservas - Las Acacias:**\n\n📞 **Contacto directo:**\n• Teléfono: [Tu número]\n• WhatsApp: [Tu número de WhatsApp]\n• Email: [Tu email]\n\n💳 **Políticas de pago:**\n• Reserva mínima: 2 noches\n• Depósito del 50% para confirmar\n• Pago completo al llegar\n\n❌ **Políticas de cancelación:**\n• Cancelación gratuita hasta 48h antes\n• Reembolso del 50% hasta 24h antes\n• No reembolso con menos de 24h\n\n📋 **Check-in/Check-out:**\n• Check-in: 15:00 hs\n• Check-out: 11:00 hs\n\n¿Te ayudo con algo más?",
  
  actividades: "🎯 **Actividades en Las Acacias:**\n\n🏊‍♂️ **Piscina:**\n• Dos piletas compartidas\n• Horario: 10:00 a 21:00hs\n• No climatizada\n\n🏔️ **Naturaleza:**\n• Ríos cercanos (información turística disponible)\n• Senderismo en las montañas\n• Paseos por el valle\n\n🍽️ **Gastronomía:**\n• Parrilla individual por cabaña\n• Servicio de bar\n• Desayuno serrano incluido\n\n🏠 **Comodidades:**\n• WiFi gratuito\n• TV por internet\n• Cámaras de seguridad\n• Cochera semicubierta\n\n¿Te interesa alguna actividad en particular?",
  
  checkin: "⏰ **Horarios y Check-in - Las Acacias:**\n\n🕒 **Horarios oficiales:**\n• Check-in: 15:00 hs\n• Check-out: 11:00 hs\n\n🏊‍♂️ **Piscina:**\n• Horario: 10:00 a 21:00hs\n• Dos piletas compartidas\n\n🚗 **Estacionamiento:**\n• Cochera semicubierta (media sombra)\n• Gratuito y privado\n\n🔑 **Acceso:**\n• Recepción personalizada\n• Información del entorno\n• Tour por la cabaña\n\n¿Necesitas información sobre horarios especiales?",
  
  cabanas: "🏡 **Nuestras Cabañas - Las Acacias:**\n\n🎨 **Tipos disponibles:**\n• **Beige:** Cabaña acogedora con vista al valle\n• **Maíz:** Espaciosa para familias\n• **Morada:** Romántica para parejas\n• **Perla:** Elegante con terraza privada\n• **Rosa:** Familiar con jardín\n• **Turquesa:** Premium con jacuzzi\n\n🛏️ **Capacidades:**\n• Desde 2 hasta 6 personas\n• Diferentes configuraciones\n\n🏠 **Comodidades por cabaña:**\n• 1 amplio dormitorio matrimonial con cama somier\n• TV con cable\n• Frigo bar\n• Baño completo\n• Vajilla completa y utensilios de cocina\n• Parrilla individual\n\n📸 **Fotos:**\n• Cada cabaña tiene su galería\n• Vista 360° disponible\n\n¿Te gustaría conocer más detalles de alguna cabaña específica?",
  
  mascotas: "🐕 **Política de Mascotas - Las Acacias:**\n\n✅ **Aceptamos mascotas:**\n• Hasta 7kg (tipo caniche)\n• Debes informar al hacer la reserva\n\n📋 **Condiciones:**\n• Mascota debe estar bajo tu responsabilidad\n• No permitidas en áreas comunes\n• Limpieza adicional puede aplicar\n\n🏠 **En la cabaña:**\n• Tu mascota puede estar contigo\n• Respeta las normas del establecimiento\n\n¿Tienes alguna pregunta específica sobre mascotas?",
  
  parrilla: "🔥 **Parrillas en Las Acacias:**\n\n✅ **Cada cabaña tiene:**\n• Parrilla individual\n• No es compartida\n• Privada para tu uso\n\n🏠 **Ubicación:**\n• En el área de tu cabaña\n• Fácil acceso\n• Incluye asador\n\n🍖 **Puedes llevar:**\n• Tu propia carne\n• Carbón y encendedor\n• Utensilios de parrilla\n\n¿Necesitas más información sobre las parrillas?",
  
  pileta: "🏊‍♂️ **Piscinas en Las Acacias:**\n\n🏊‍♀️ **Dos piletas compartidas:**\n• Horario: 10:00 a 21:00hs\n• No climatizadas\n• Compartidas entre todos los huéspedes\n\n⏰ **Horarios:**\n• Apertura: 10:00 hs\n• Cierre: 21:00 hs\n\n🌡️ **Temperatura:**\n• No climatizadas\n• Temperatura natural\n\n🏖️ **Área:**\n• Espacios comunes\n• Sillas y reposeras disponibles\n\n¿Te interesa saber más sobre las piscinas?",
  
  cochera: "🚗 **Cochera en Las Acacias:**\n\n🅿️ **Tipo de cochera:**\n• Semicubierta (media sombra)\n• No completamente cubierta\n• Protección parcial del sol\n\n✅ **Incluida:**\n• Sin costo adicional\n• Una por cabaña\n• Acceso directo\n\n🌤️ **Características:**\n• Media sombra natural\n• Protección básica\n• Espacio suficiente\n\n¿Necesitas más detalles sobre la cochera?",
  
  vajilla: "🍽️ **Vajilla en Las Acacias:**\n\n✅ **Todas las cabañas incluyen:**\n• Vajilla completa\n• Utensilios de cocina\n• Todo lo necesario para cocinar\n\n🏠 **Lo que encontrarás:**\n• Platos, tazas, vasos\n• Cubiertos completos\n• Ollas y sartenes\n• Utensilios de cocina\n• Cafetera y tetera\n\n🍳 **Para cocinar:**\n• Todo lo necesario incluido\n• No necesitas traer nada\n• Cocina completamente equipada\n\n¿Tienes alguna pregunta específica sobre la vajilla?",
  
  rios: "🌊 **Ríos cerca de Las Acacias:**\n\n✅ **Información turística disponible:**\n• Te brindamos información para acceder a varios ríos\n• Rutas y direcciones\n• Actividades acuáticas\n\n🗺️ **Servicio incluido:**\n• Información detallada al llegar\n• Mapas y rutas\n• Recomendaciones locales\n\n🏊‍♂️ **Actividades:**\n• Paseos por ríos\n• Actividades acuáticas\n• Turismo de naturaleza\n\n¿Te interesa información sobre algún río específico?",
  
  blanco: "🛏️ **Blanco en Las Acacias:**\n\n✅ **Incluido en todas las cabañas:**\n• Sábanas limpias\n• Toallas de baño\n• Ropa de cama completa\n\n❌ **No incluye:**\n• Toallones de piscina\n• Toallas adicionales\n\n🧺 **Servicio de lavandería:**\n• Disponible con cargo adicional\n• Servicio bajo pedido\n\n🏠 **En tu cabaña:**\n• Todo el blanco necesario\n• Limpio y en perfecto estado\n\n¿Necesitas más información sobre el blanco?",
  
  desayuno: "☕ **Desayuno Serrano en Las Acacias:**\n\n✅ **Incluido en todas las cabañas:**\n• Infusiones (té, café, mate)\n• Pan casero\n• Criollos\n• Manteca\n• Mermelada\n\n🍞 **Características:**\n• Desayuno serrano tradicional\n• Productos caseros\n• Incluido en el precio\n\n⏰ **Horario:**\n• Disponible por la mañana\n• En tu cabaña\n\n¿Te gustaría saber más sobre el desayuno?",
  
  visitas: "🚫 **Política de Visitas - Las Acacias:**\n\n❌ **No está permitido:**\n• Recibir visitas\n• Personas externas al establecimiento\n• Entrada de no huéspedes\n\n🏠 **Solo huéspedes registrados:**\n• Personas incluidas en la reserva\n• Máximo según capacidad de la cabaña\n\n📋 **Por seguridad:**\n• Control de acceso\n• Cámaras de seguridad\n• Normas del establecimiento\n\n¿Tienes alguna pregunta sobre esta política?"
};

// Función para consultar disponibilidad real al backend
async function checkAvailability(checkIn, checkOut, guestCount) {
  try {
    console.log(`🔍 Consultando disponibilidad: ${checkIn} - ${checkOut}, ${guestCount} personas`);
    
    const response = await axios.get(`${BACKEND_URL}/cabins/available`, {
      params: {
        checkIn: checkIn,
        checkOut: checkOut,
        guestCount: guestCount
      }
    });
    
    console.log('✅ Respuesta del backend:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error consultando disponibilidad:', error.response?.data || error.message);
    return null;
  }
}

// Función para obtener información de una cabaña específica
async function getCabinInfo(cabinName, checkIn = null, checkOut = null) {
  try {
    console.log(`🔍 Obteniendo información de la cabaña: ${cabinName}`);
    
    const response = await axios.get(`${BACKEND_URL}/cabins`);
    const cabins = response.data;
    const cabin = cabins.find(c => c.name.toLowerCase() === cabinName.toLowerCase());
    
    if (!cabin) {
      return null;
    }

    let pricePerNight = cabin.price; // Precio base por defecto
    let priceType = 'BASE';

    // Si tenemos fechas, buscar precio especial
    if (checkIn && checkOut) {
      try {
        console.log(`🔍 Buscando precio especial para ${cabinName} en fechas: ${checkIn} - ${checkOut}`);
        
        const pricingResponse = await axios.get(`${BACKEND_URL}/cabins/${cabin.id}/pricing`, {
          params: { checkIn, checkOut }
        });
        
        if (pricingResponse.data && pricingResponse.data.price) {
          pricePerNight = pricingResponse.data.price;
          priceType = pricingResponse.data.priceType;
          console.log(`🔍 Precio especial encontrado para ${cabinName}: $${pricePerNight} (${priceType})`);
        } else {
          console.log(`🔍 No hay precio especial para ${cabinName}, usando precio base: $${pricePerNight}`);
        }
      } catch (pricingError) {
        console.log(`⚠️ Error obteniendo precio especial para ${cabinName}, usando precio base:`, pricingError.message);
      }
    }

    console.log(`🔍 Información final de ${cabinName}:`, {
      id: cabin.id,
      name: cabin.name,
      price: pricePerNight,
      priceType: priceType,
      capacity: cabin.capacity
    });

    // Retornar cabaña con el precio correcto (especial o base)
    return {
      ...cabin,
      price: pricePerNight
    };
  } catch (error) {
    console.error('❌ Error obteniendo información de cabaña:', error.response?.data || error.message);
    return null;
  }
}

// Función para parsear fechas en formato español - VERSIÓN MEJORADA
function parseSpanishDate(dateStr) {
  const months = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
    'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
  };
  
  // Múltiples patrones para diferentes formatos
  const patterns = [
    // "16 de agosto" o "16 agosto"
    /(\d{1,2})\s+(?:de\s+)?(\w+)(?:\s+(\d{4}))?/i,
    // "16/08" o "16/08/2025"
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i,
    // "16-08" o "16-08-2025"
    /(\d{1,2})-(\d{1,2})(?:-(\d{4}))?/i,
    // "16.08" o "16.08.2025"
    /(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/i
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.toLowerCase().match(pattern);
    if (match) {
      let day, month, year;
      
      if (pattern.source.includes('\\/') || pattern.source.includes('-') || pattern.source.includes('\\.')) {
        // Formato numérico: 16/08 o 16-08
        day = parseInt(match[1]);
        month = parseInt(match[2]) - 1; // Los meses en JS van de 0-11
        year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
      } else {
        // Formato con nombre de mes: "16 de agosto"
        day = parseInt(match[1]);
        const monthName = match[2];
        year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
        
        if (months[monthName] !== undefined) {
          month = months[monthName];
        } else {
          continue; // Probar el siguiente patrón
        }
      }
      
      // Validar que la fecha sea válida
      const date = new Date(year, month, day);
      if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
        return date;
      }
    }
  }
  
  return null;
}

// Función para formatear fecha para el backend
function formatDateForBackend(date) {
  return date.toISOString().split('T')[0];
}

// Función para obtener imágenes de una cabaña específica
function getCabinImages(cabinName) {
  // URL base - actualiza esto con tu dominio real
  const baseUrl = 'http://localhost:3001'; // Cambia por tu dominio cuando lo subas
  
  const cabinImages = {
    'rosa': [
      `${baseUrl}/images/cabins/rosa/rosa-1.jpg`,
      `${baseUrl}/images/cabins/rosa/rosa-2.jpg`, 
      `${baseUrl}/images/cabins/rosa/rosa-3.jpg`
    ],
    'beige': [
      `${baseUrl}/images/cabins/beige/beige-1.jpg`,
      `${baseUrl}/images/cabins/beige/beige-2.jpg`,
      `${baseUrl}/images/cabins/beige/beige-3.jpg`
    ],
    'turquesa': [
      `${baseUrl}/images/cabins/turquesa/turquesa-1.jpg`,
      `${baseUrl}/images/cabins/turquesa/turquesa-2.jpg`,
      `${baseUrl}/images/cabins/turquesa/turquesa-3.jpg`
    ],
    'perla': [
      `${baseUrl}/images/cabins/perla/perla-1.jpg`,
      `${baseUrl}/images/cabins/perla/perla-2.jpg`,
      `${baseUrl}/images/cabins/perla/perla-3.jpg`
    ],
    'morada': [
      `${baseUrl}/images/cabins/morada/morada-1.jpg`,
      `${baseUrl}/images/cabins/morada/morada-2.jpg`,
      `${baseUrl}/images/cabins/morada/morada-3.jpg`
    ],
    'maiz': [
      `${baseUrl}/images/cabins/maiz/maiz-1.jpg`,
      `${baseUrl}/images/cabins/maiz/maiz-2.jpg`,
      `${baseUrl}/images/cabins/maiz/maiz-3.jpg`
    ]
  };
  
  return cabinImages[cabinName.toLowerCase()] || [];
}

// Función para detectar palabras similares y generar respuesta
function getCabinResponse(messageText) {
  const text = messageText.toLowerCase();
  
  // Detectar precios/tarifas
  if (text.includes('precio') || text.includes('costo') || text.includes('tarifa') || 
      text.includes('cuanto') || text.includes('valor') || text.includes('pagar')) {
    return cabinResponses.precios;
  }
  
  // Detectar servicios
  if (text.includes('servicio') || text.includes('incluye') || text.includes('wifi') || 
      text.includes('tv') || text.includes('desayuno') || text.includes('bar') ||
      text.includes('lavanderia') || text.includes('lavandería')) {
    return cabinResponses.servicios;
  }
  
  // Detectar ubicación (pero no si está preguntando por reservar)
  if ((text.includes('ubicacion') || text.includes('donde') || text.includes('llegar') ||
      text.includes('direccion') || text.includes('ruta') ||
      text.includes('gps') || text.includes('coordenadas')) && 
      !text.includes('reservar') && !text.includes('reserva')) {
    return cabinResponses.ubicacion;
  }
  
  // Detectar reservas (prioridad alta)
  if (text.includes('reservar') || text.includes('reserva') || text.includes('como reservar') || 
      text.includes('como reserva') || text.includes('quiero reservar') || text.includes('necesito reservar')) {
    const baseUrl = 'https://lasacaciasistemafront.vercel.app/';
    return `🏡 **¡Excelente! Te ayudo con la reserva:**\n\n🌐 **Reserva online:**\n• Visita nuestra página web: ${baseUrl}\n• Encuentra el buscador al final de la página\n• Selecciona tus fechas de check-in y check-out\n• Elige la cantidad de personas\n• ¡Reserva tu cabaña directamente!\n\n📧 **Una vez hecha la reserva:**\n• Te llega un email con los datos bancarios\n• Envías el 50% para confirmarla\n• ¡Listo! Tu cabaña queda reservada\n\n¿Te ayudo con algo más?`;
  }
  
  // Detectar otras consultas de reserva
  if (text.includes('cancelacion') || text.includes('pago') || text.includes('deposito') || 
      text.includes('contacto') || text.includes('telefono') || text.includes('whatsapp') || 
      text.includes('email')) {
    return cabinResponses.reserva;
  }
  
  // Detectar actividades
  if (text.includes('actividad') || text.includes('hacer') || text.includes('turismo') ||
      text.includes('piscina') || text.includes('pileta') || text.includes('senderismo') ||
      text.includes('naturaleza') || text.includes('montaña')) {
    return cabinResponses.actividades;
  }
  
  // Detectar check-in/horarios
  if (text.includes('check') || text.includes('horario') || text.includes('llegada') ||
      text.includes('salida') || text.includes('estacionamiento') || text.includes('llaves') ||
      text.includes('acceso') || text.includes('recepcion')) {
    return cabinResponses.checkin;
  }
  
  // Detectar cabañas específicas
  if (text.includes('cabana') || text.includes('cabaña') || text.includes('beige') ||
      text.includes('maiz') || text.includes('morada') || text.includes('perla') ||
      text.includes('rosa') || text.includes('turquesa') || text.includes('capacidad') ||
      text.includes('personas') || text.includes('fotos') || text.includes('dormitorio')) {
    return cabinResponses.cabanas;
  }
  
  // Detectar mascotas
  if (text.includes('mascota') || text.includes('perro') || text.includes('gato') ||
      text.includes('caniche') || text.includes('7kg') || text.includes('kg')) {
    return cabinResponses.mascotas;
  }
  
  // Detectar parrilla
  if (text.includes('parrilla') || text.includes('asador') || text.includes('compartida') ||
      text.includes('individual')) {
    return cabinResponses.parrilla;
  }
  
  // Detectar pileta
  if (text.includes('pileta') || text.includes('piscina') || text.includes('climatizada') ||
      text.includes('compartida') || text.includes('horario')) {
    return cabinResponses.pileta;
  }
  
  // Detectar cochera
  if (text.includes('cochera') || text.includes('estacionamiento') || text.includes('semicubierta') ||
      text.includes('media sombra') || text.includes('cubierta')) {
    return cabinResponses.cochera;
  }
  
  // Detectar vajilla
  if (text.includes('vajilla') || text.includes('utensillo') || text.includes('cocina') ||
      text.includes('plato') || text.includes('cubierto')) {
    return cabinResponses.vajilla;
  }
  
  // Detectar ríos
  if (text.includes('rio') || text.includes('río') || text.includes('agua') ||
      text.includes('turismo') || text.includes('informacion')) {
    return cabinResponses.rios;
  }
  
  // Detectar blanco
  if (text.includes('blanco') || text.includes('sabana') || text.includes('sábana') ||
      text.includes('toalla') || text.includes('toallon') || text.includes('toallón')) {
    return cabinResponses.blanco;
  }
  
  // Detectar desayuno
  if (text.includes('desayuno') || text.includes('pan') || text.includes('criollo') ||
      text.includes('mermelada') || text.includes('infusion')) {
    return cabinResponses.desayuno;
  }
  
  // Detectar visitas
  if (text.includes('visita') || text.includes('recibir') || text.includes('externo') ||
      text.includes('permitido')) {
    return cabinResponses.visitas;
  }
  
     // Detectar si menciona número de personas en el mensaje inicial
   const personPatterns = [
     /(?:estoy\s+buscando\s+para\s+|solo\s+|para\s+|somos\s+|necesito\s+para\s+|quiero\s+para\s+)(\d+)\s*(?:personas?|gente|huéspedes?|pax|pasajeros?)/i,
     /(\d+)\s*(?:personas?|gente|huéspedes?|pax|pasajeros?)\s*(?:estoy\s+buscando|solo|para|somos|necesito|quiero)/i,
     /(?:busco\s+para\s+|buscando\s+para\s+|necesito\s+)(\d+)\s*(?:personas?|gente|huéspedes?|pax|pasajeros?)/i
   ];
   
   for (const pattern of personPatterns) {
     const match = text.match(pattern);
     if (match) {
       const guestCount = parseInt(match[1]);
       
       // Validar que no se soliciten más de 6 personas
       if (guestCount > 6) {
         return `❌ **Lo siento, no tenemos cabañas disponibles para ${guestCount} personas.**\n\n🏡 **Nuestras cabañas tienen capacidad máxima de 6 personas.**\n\n💡 **Te sugiero:**\n• Buscar para 6 personas o menos\n• Contactar directamente para consultas especiales\n\n¿Te gustaría buscar para menos personas?`;
       }
       
       return `👥 **¡Perfecto! Entiendo que buscas para ${guestCount} personas.**\n\n📅 **¿Para qué fechas estás buscando?**\n\nPuedes escribirlo de varias formas:\n• "del 16 de agosto al 18 de agosto"\n• "del 14/10 al 16/10"\n• "del 15 de noviembre al 18 de noviembre"\n• "llegada 16 agosto, salida 18 agosto"`;
     }
   }
  
  // Respuesta por defecto - ir directo a preguntar fechas
  return "🏡 **¡Hola! Soy el asistente de Las Acacias Refugio**\n\n¿Para qué fechas estás buscando y cuántas personas?";
}

// Función para procesar el flujo de reserva
async function processReservationFlow(user, messageText, sock) {
  const session = userSessions.get(user) || { step: 'initial' };
  const text = messageText.toLowerCase().trim();
  
  // Detectar si está preguntando por una cabaña específica
  const cabinNames = ['rosa', 'beige', 'turquesa', 'perla', 'morada', 'maiz', 'maíz'];
  const requestedCabin = cabinNames.find(cabin => text.includes(cabin));
  
  // Si está preguntando por una cabaña específica y está en el paso de mostrar disponibilidad
  if (requestedCabin && session.step === 'showing_availability') {
    const images = getCabinImages(requestedCabin);
    
    if (images.length > 0) {
             // Enviar información detallada de la cabaña específica
       const cabinInfoText = cabinResponses.cabanas;
       await sock.sendMessage(user, { text: cabinInfoText });
      
      // Enviar imágenes de la cabaña específica
      console.log(`📸 Enviando ${images.length} imágenes de la cabaña ${requestedCabin}`);
      
      for (const imageUrl of images) {
        try {
          await sock.sendMessage(user, {
            image: { url: imageUrl },
            caption: `🏡 Cabaña ${requestedCabin.charAt(0).toUpperCase() + requestedCabin.slice(1)} - Las Acacias Refugio`
          });
          // Pequeña pausa entre imágenes para evitar spam
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`❌ Error enviando imagen ${imageUrl}:`, error.message);
        }
      }
      
                           // Mensaje final para cerrar el flujo con link específico
              const baseUrl = 'https://lasacaciasistemafront.vercel.app/reservas/completar';
              
                                             // Obtener información completa de la cabaña desde el backend
                 const cabinInfo = await getCabinInfo(requestedCabin, session.checkIn, session.checkOut);
                const cabinId = cabinInfo ? cabinInfo.id : '';
                
                                 // Calcular el precio total basado en las noches reales
                 const checkInDate = new Date(session.checkIn);
                 const checkOutDate = new Date(session.checkOut);
                 const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
                 const totalPrice = cabinInfo ? cabinInfo.price * nights : 0;
                 
                 console.log('🔍 Bot - Cálculo de precio:', {
                   checkIn: session.checkIn,
                   checkOut: session.checkOut,
                   checkInDate: checkInDate.toISOString(),
                   checkOutDate: checkOutDate.toISOString(),
                   nights: nights,
                   cabinPrice: cabinInfo ? cabinInfo.price : 0,
                   totalPrice: totalPrice
                 });
              
              const specificCabinLink = `${baseUrl}?checkIn=${session.checkIn}&checkOut=${session.checkOut}&guests=${session.guestCount}&cabinId=${cabinId}&cabinName=${cabinInfo ? cabinInfo.name : requestedCabin}&totalPrice=${totalPrice}`;
              
              await sock.sendMessage(user, { 
                text: `¿Te gustaría consultar otras fechas o le interesaría saber cómo reservar?\n\n🏡 **Reservar ${requestedCabin.charAt(0).toUpperCase() + requestedCabin.slice(1)} directamente:**\n• ${specificCabinLink}` 
              });
      
      // Resetear sesión para permitir nueva consulta
      session.step = 'initial';
      userSessions.set(user, session);
      
             return null; // Ya enviamos la respuesta manualmente
     }
   }
   
   // Manejar respuestas después de mostrar disponibilidad
   if (session.step === 'showing_availability') {
     // Si quiere consultar otras fechas
     if (text.includes('consultar') || text.includes('otras fechas') || text.includes('otra fecha')) {
       session.step = 'asking_dates';
       userSessions.set(user, session);
                return "📅 **Perfecto! ¿Para qué fechas estás buscando y cuántas personas?**\n\nPuedes escribirlo de varias formas:\n• \"16 de agosto al 18 de agosto, 4 personas\"\n• \"ingreso 14 octubre, egreso 16 octubre 2025, 4 personas\"\n• \"del 25 de diciembre del 2025 al 01 de enero del 2026, 4 personas\"\n• \"16/08 al 18/08, 4 personas\"";
     }
     
           // Si le interesa saber cómo reservar
      if (text.includes('reservar') || text.includes('interesa') || text.includes('cómo') || text.includes('como') || text.includes('si') || text.includes('sí')) {
        // Generar link dinámico con las fechas actuales
        const baseUrl = 'https://lasacaciasistemafront.vercel.app/';
        const reservationLink = `${baseUrl}?checkIn=${session.checkIn}&checkOut=${session.checkOut}&guests=${session.guestCount}`;
        
        return `🏡 **¡Excelente! Te ayudo con la reserva:**\n\n🌐 **Reserva online con tus fechas:**\n• ${reservationLink}\n\n📋 **O visita nuestra página web:**\n• ${baseUrl}\n• Encuentra el buscador al final de la página\n• Selecciona tus fechas de check-in y check-out\n• Elige la cantidad de personas\n• ¡Reserva tu cabaña directamente!\n\n📧 **Una vez hecha la reserva:**\n• Te llega un email con los datos bancarios\n• Envías el 50% para confirmarla\n• ¡Listo! Tu cabaña queda reservada\n\n¿Te ayudo con algo más?`;
      }
     
     // Si no es ninguna de las opciones anteriores, mantener en el mismo estado
     return "¿Te gustaría consultar otras fechas o le interesaría saber cómo reservar?";
   }
   
   // Si es la primera vez que dice hola o cualquier cosa
  if (session.step === 'initial') {
    session.step = 'asking_dates';
    userSessions.set(user, session);
    
    return "🏡 **¡Hola! Soy el asistente de Las Acacias Refugio**\n\n¿Para qué fechas estás buscando y cuántas personas?";
  }
  
     // Si está en el paso de preguntar fechas
   if (session.step === 'asking_dates') {
     // Si ya tenemos el número de personas guardado, solo buscar fechas
     if (session.guestCount) {
               // Buscar fechas en el mensaje - VERSIÓN MEJORADA
                 const datePatterns = [
           // Patrón para "del 25 de diciembre de 2025 al 02 de enero del 2026" (fechas con años diferentes)
           /(?:del\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:de\s+)?(\d{4})\s+(?:al\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:del\s+)?(\d{4})/gi,
           // Patrón para "del 2 de septiembre al 5" o "del 12 de febrero al 15"
           /(?:del\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:al\s+)?(\d{1,2})(?:\s+de\s+(\w+))?/gi,
           // Patrón para "del 14 al 16 de octubre" o "del 14 al 16 octubre"
           /(?:del\s+)?(\d{1,2})\s+(?:al\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)(?:\s+(\d{4}))?/gi,
           // Patrón original mejorado
           /(\d{1,2})\s+(?:de\s+)?(\w+)(?:\s+(\d{4}))?/gi,
           // Patrón para fechas con separadores
           /(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{4}))?/gi
         ];
       
       const dates = [];
       
       for (const pattern of datePatterns) {
         let match;
         while ((match = pattern.exec(messageText)) !== null) {
           const months = {
             'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
             'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
           };
           
           // Si es el patrón "del 25 de diciembre de 2025 al 02 de enero del 2026" (fechas con años diferentes)
           if (pattern.source.includes('de\\s+\\d{4}\\s+al\\s+\\d{1,2}\\s+de\\s+\\w+\\s+del\\s+\\d{4}')) {
             const day1 = parseInt(match[1]);
             const monthName1 = match[2];
             const year1 = parseInt(match[3]);
             const day2 = parseInt(match[4]);
             const monthName2 = match[5];
             const year2 = parseInt(match[6]);
             
             if (months[monthName1] !== undefined && months[monthName2] !== undefined) {
               const month1 = months[monthName1];
               const month2 = months[monthName2];
               
               const date1 = new Date(year1, month1, day1);
               const date2 = new Date(year2, month2, day2);
               
               if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year1 &&
                   date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year2) {
                 dates.push(date1, date2);
                 break;
               }
             }
           }
           // Si es el patrón "del 20/12 del 2025 al 01/01 del 2026" (fechas numéricas con años diferentes)
           else if (pattern.source.includes('[\\/\\-\\.]\\d{1,2}\\s+del\\s+\\d{4}\\s+al\\s+\\d{1,2}[\\/\\-\\.]\\d{1,2}\\s+del\\s+\\d{4}')) {
             const day1 = parseInt(match[1]);
             const month1 = parseInt(match[2]) - 1; // Los meses en JS van de 0-11
             const year1 = parseInt(match[3]);
             const day2 = parseInt(match[4]);
             const month2 = parseInt(match[5]) - 1; // Los meses en JS van de 0-11
             const year2 = parseInt(match[6]);
             
             const date1 = new Date(year1, month1, day1);
             const date2 = new Date(year2, month2, day2);
             
             if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year1 &&
                 date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year2) {
               dates.push(date1, date2);
               break;
             }
           }
           // Si es el patrón "del X de mes al Y" o "del X al Y de mes"
            else if (pattern.source.includes('del\\s+') && pattern.source.includes('al\\s+')) {
              let day1, day2, month1, month2, year;
              
              // Verificar si es el patrón "del X de mes al Y" (con mes especificado)
              if (pattern.source.includes('(?:de\\s+)?(\\\\w+)\\s+(?:al\\s+)?(\\\\d{1,2})') && match[1] && match[2] && match[3] && months[match[2]]) {
                // Formato: "del 18 de septiembre al 20" o "del 12 de febrero al 15"
                day1 = parseInt(match[1]);
                const monthName1 = match[2];
                day2 = parseInt(match[3]);
                const monthName2 = match[4];
                year = new Date().getFullYear();
                
                if (months[monthName1] !== undefined) {
                  month1 = months[monthName1];
                  // Si no se especifica el segundo mes, asumir que es el mismo mes
                  month2 = months[monthName2] !== undefined ? months[monthName2] : month1;
                  
                  const date1 = new Date(year, month1, day1);
                  const date2 = new Date(year, month2, day2);
                  
                  if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year &&
                      date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year) {
                    dates.push(date1, date2);
                    break; // Ya tenemos las dos fechas, no necesitamos seguir buscando
                  }
                }
              } else {
                // Formato: "del 14 al 16 de octubre"
                day1 = parseInt(match[1]);
                day2 = parseInt(match[2]);
                const monthName = match[3];
                year = match[4] ? parseInt(match[4]) : new Date().getFullYear();
                
                if (months[monthName] !== undefined) {
                  month1 = months[monthName];
                  month2 = months[monthName];
                  
                  const date1 = new Date(year, month1, day1);
                  const date2 = new Date(year, month2, day2);
                  
                  if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year &&
                      date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year) {
                    dates.push(date1, date2);
                    break; // Ya tenemos las dos fechas, no necesitamos seguir buscando
                  }
                }
              }
            } else {
             // Patrón normal
             const date = parseSpanishDate(match[0]);
             if (date) {
               dates.push(date);
             }
           }
         }
       }
       
       
               // Si encontramos fechas, proceder con la consulta
        if (dates.length >= 2) {
          const checkIn = dates[0];
          const checkOut = dates[1];
          
          // Validar que las fechas no sean pasadas
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (checkIn < today) {
            return `❌ **Error en las fechas:** La fecha de llegada (${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}) ya pasó.\n\nPor favor, indícame fechas futuras.`;
          }
          
          // Verificar que check-out sea después de check-in
          if (checkOut <= checkIn) {
            return "❌ **Error en las fechas:** La fecha de salida debe ser después de la fecha de llegada.\n\nPor favor, indícame las fechas correctamente (ejemplo: del 14 al 16 de octubre)";
          }
         
         // Formatear fechas para el backend
         const checkInFormatted = formatDateForBackend(checkIn);
         const checkOutFormatted = formatDateForBackend(checkOut);
         
         // Consultar disponibilidad real
         const availableCabins = await checkAvailability(checkInFormatted, checkOutFormatted, session.guestCount);
         
         if (availableCabins && availableCabins.length > 0) {
           session.step = 'showing_availability';
           session.checkIn = checkInFormatted;
           session.checkOut = checkOutFormatted;
           userSessions.set(user, session);
           
           // Enviar mensaje inicial con fechas
           await sock.sendMessage(user, { 
             text: `✅ **¡Excelente! Encontré disponibilidad para tus fechas:**\n\n📅 **Fechas:** ${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} - ${checkOut.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}\n👥 **Personas:** ${session.guestCount}\n\n🏡 **Cabañas disponibles:**` 
           });
           
           // Ordenar cabañas por capacidad: primero las que coinciden exactamente, luego las de mayor capacidad
           const sortedCabins = availableCabins.sort((a, b) => {
             const aExactMatch = a.capacity === session.guestCount;
             const bExactMatch = b.capacity === session.guestCount;
             
             if (aExactMatch && !bExactMatch) return -1; // a va primero
             if (!aExactMatch && bExactMatch) return 1;  // b va primero
             if (aExactMatch && bExactMatch) return a.capacity - b.capacity; // ambas exactas, ordenar por capacidad
             return a.capacity - b.capacity; // ninguna exacta, ordenar por capacidad
           });
           
           // Enviar cada cabaña con su información y foto
           for (const cabin of sortedCabins) {
            const cabinName = cabin.name.toLowerCase();
            const images = getCabinImages(cabinName);
            
            // Enviar información de la cabaña
            await sock.sendMessage(user, { 
              text: `🏡 **${cabin.name}**\n👥 Capacidad: ${cabin.capacity} personas\n💰 Precio: $${cabin.price}/noche` 
            });
            
            // Enviar solo 1 foto de la cabaña (primera imagen)
            if (images.length > 0) {
              console.log(`📸 Enviando 1 imagen de la cabaña ${cabinName}`);
              
              try {
                await sock.sendMessage(user, {
                  image: { url: images[0] },
                  caption: `🏡 Cabaña ${cabin.name} - Las Acacias Refugio`
                });
              } catch (error) {
                console.error(`❌ Error enviando imagen ${images[0]}:`, error.message);
              }
            }
            
            // Pausa entre cabañas
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // Enviar mensaje final con opciones
          const baseUrl = 'https://lasacaciasistemafront.vercel.app/';
          
          await sock.sendMessage(user, { 
            text: `¿Te gustaría saber más sobre alguna cabaña específica?\n\n🌐 **O ver todas las opciones en la web:**\n• ${baseUrl}` 
          });
         
          return null; // Ya enviamos todo manualmente
         } else {
           session.step = 'initial';
           userSessions.set(user, session);
           
           return `❌ **Lo siento, no hay disponibilidad para esas fechas:**\n\n📅 **Fechas:** ${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} - ${checkOut.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}\n👥 **Personas:** ${session.guestCount}\n\n💡 **Te sugiero:**\n• Probar otras fechas\n• Contactar directamente para verificar\n\n¿Quieres consultar otras fechas?`;
         }
       } else {
         // Si no encontramos fechas, pedir fechas específicas
                   return "📅 **Perfecto! Ya tengo que buscas para " + session.guestCount + " personas.**\n\n¿De qué fecha a qué fecha estás buscando?\n\n**Ejemplos:**\n• \"del 14 al 16 de octubre\"\n• \"del 16/08 al 18/08\"\n• \"del 15 de noviembre al 18 de noviembre\"\n• \"del 25 de diciembre del 2025 al 01 de enero del 2026\"";
       }
     } else {
       // Si no tenemos personas guardadas, buscar tanto fechas como personas
               const datePatterns = [
          // Patrón para "del 25 de diciembre del 2025 al 01 de enero del 2026" (fechas con años diferentes)
          /(?:del\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:del\s+)?(\d{4})\s+(?:al\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:del\s+)?(\d{4})/gi,
          // Patrón para "del 20/12 del 2025 al 01/01 del 2026" (fechas numéricas con años diferentes)
          /(?:del\s+)?(\d{1,2})[\/\-\.](\d{1,2})\s+(?:del\s+)?(\d{4})\s+(?:al\s+)?(\d{1,2})[\/\-\.](\d{1,2})\s+(?:del\s+)?(\d{4})/gi,
          // Patrón para "del 2 de septiembre al 5" o "del 12 de febrero al 15"
          /(?:del\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:al\s+)?(\d{1,2})(?:\s+de\s+(\w+))?/gi,
          // Patrón para "del 14 al 16 de octubre" o "del 14 al 16 octubre"
          /(?:del\s+)?(\d{1,2})\s+(?:al\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)(?:\s+(\d{4}))?/gi,
          // Patrón original mejorado
          /(\d{1,2})\s+(?:de\s+)?(\w+)(?:\s+(\d{4}))?/gi,
          // Patrón para fechas con separadores
          /(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{4}))?/gi
        ];
       
       const dates = [];
       
       for (const pattern of datePatterns) {
         let match;
         while ((match = pattern.exec(messageText)) !== null) {
           const months = {
             'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
             'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
           };
           
           // Si es el patrón "del 25 de diciembre de 2025 al 02 de enero del 2026" (fechas con años diferentes)
           if (pattern.source.includes('de\\s+\\d{4}\\s+al\\s+\\d{1,2}\\s+de\\s+\\w+\\s+del\\s+\\d{4}')) {
             const day1 = parseInt(match[1]);
             const monthName1 = match[2];
             const year1 = parseInt(match[3]);
             const day2 = parseInt(match[4]);
             const monthName2 = match[5];
             const year2 = parseInt(match[6]);
             
             if (months[monthName1] !== undefined && months[monthName2] !== undefined) {
               const month1 = months[monthName1];
               const month2 = months[monthName2];
               
               const date1 = new Date(year1, month1, day1);
               const date2 = new Date(year2, month2, day2);
               
               if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year1 &&
                   date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year2) {
                 dates.push(date1, date2);
                 break;
               }
             }
           }
           // Si es el patrón "del X de mes al Y" o "del X al Y de mes"
           else if (pattern.source.includes('del\\s+') && pattern.source.includes('al\\s+')) {
             let day1, day2, month1, month2, year;
             
             // Verificar si es el patrón "del X de mes al Y" (con mes especificado)
             if (pattern.source.includes('(?:de\\s+)?(\\\\w+)\\s+(?:al\\s+)?(\\\\d{1,2})') && match[1] && match[2] && match[3] && months[match[2]]) {
               // Formato: "del 18 de septiembre al 20" o "del 12 de febrero al 15"
               day1 = parseInt(match[1]);
               const monthName1 = match[2];
               day2 = parseInt(match[3]);
               const monthName2 = match[4];
               year = new Date().getFullYear();
               
               if (months[monthName1] !== undefined) {
                 month1 = months[monthName1];
                 // Si no se especifica el segundo mes, asumir que es el mismo mes
                 month2 = months[monthName2] !== undefined ? months[monthName2] : month1;
                 
                 const date1 = new Date(year, month1, day1);
                 const date2 = new Date(year, month2, day2);
                 
                 if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year &&
                     date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year) {
                   dates.push(date1, date2);
                   break; // Ya tenemos las dos fechas, no necesitamos seguir buscando
                 }
               }
             } else {
               // Formato: "del 14 al 16 de octubre"
               day1 = parseInt(match[1]);
               day2 = parseInt(match[2]);
               const monthName = match[3];
               year = match[4] ? parseInt(match[4]) : new Date().getFullYear();
               
               if (months[monthName] !== undefined) {
                 month1 = months[monthName];
                 month2 = months[monthName];
                 
                 const date1 = new Date(year, month1, day1);
                 const date2 = new Date(year, month2, day2);
                 
                 if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year &&
                     date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year) {
                   dates.push(date1, date2);
                   break; // Ya tenemos las dos fechas, no necesitamos seguir buscando
                 }
               }
             }
           } else {
             // Patrón normal
             const date = parseSpanishDate(match[0]);
             if (date) {
               dates.push(date);
             }
           }
         }
       }
       
                               // Buscar número de personas - VERSIÓN MEJORADA
         const personPatterns = [
           /(\d+)\s*(?:personas?|gente|huéspedes?|pax|pasajeros?)/i,
           /(?:para|con)\s*(\d+)\s*(?:personas?|gente|huéspedes?|pax|pasajeros?)/i,
           /(\d+)\s*(?:personas?|gente|huéspedes?|pax|pasajeros?)\s*(?:para|en)/i
         ];
         
                 let guestCount = null;
          for (const pattern of personPatterns) {
            const personMatch = messageText.match(pattern);
            if (personMatch) {
              guestCount = parseInt(personMatch[1]);
              break;
            }
          }
          
                     // SIEMPRE actualizar el número de personas con el último valor mencionado
           if (guestCount) {
             session.guestCount = guestCount;
             userSessions.set(user, session);
           }
         
         // Validar que no se soliciten más de 6 personas
         if (guestCount && guestCount > 6) {
           return `❌ **Lo siento, no tenemos cabañas disponibles para ${guestCount} personas.**\n\n🏡 **Nuestras cabañas tienen capacidad máxima de 6 personas.**\n\n💡 **Te sugiero:**\n• Buscar para 6 personas o menos\n• Contactar directamente para consultas especiales\n\n¿Te gustaría buscar para menos personas?`;
         }
        
                 // Si encontramos fechas y personas
         if (dates.length >= 2 && guestCount) {
           const checkIn = dates[0];
           const checkOut = dates[1];
           
           // Validar que las fechas no sean pasadas
           const today = new Date();
           today.setHours(0, 0, 0, 0);
           
           if (checkIn < today) {
             return `❌ **Error en las fechas:** La fecha de llegada (${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}) ya pasó.\n\nPor favor, indícame fechas futuras.`;
           }
           
           // Verificar que check-out sea después de check-in
           if (checkOut <= checkIn) {
             return "❌ **Error en las fechas:** La fecha de salida debe ser después de la fecha de llegada.\n\nPor favor, indícame las fechas correctamente (ejemplo: ingreso 14 octubre, egreso 16 octubre 2025, 4 personas)";
           }
          
          // Formatear fechas para el backend
          const checkInFormatted = formatDateForBackend(checkIn);
          const checkOutFormatted = formatDateForBackend(checkOut);
          
          // Consultar disponibilidad real
          const availableCabins = await checkAvailability(checkInFormatted, checkOutFormatted, guestCount);
          
          if (availableCabins && availableCabins.length > 0) {
            session.step = 'showing_availability';
            session.checkIn = checkInFormatted;
            session.checkOut = checkOutFormatted;
            session.guestCount = guestCount;
            userSessions.set(user, session);
            
            // Enviar mensaje inicial con fechas
            await sock.sendMessage(user, { 
              text: `✅ **¡Excelente! Encontré disponibilidad para tus fechas:**\n\n📅 **Fechas:** ${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} - ${checkOut.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}\n👥 **Personas:** ${guestCount}\n\n🏡 **Cabañas disponibles:**` 
            });
            
            // Ordenar cabañas por capacidad: primero las que coinciden exactamente, luego las de mayor capacidad
            const sortedCabins = availableCabins.sort((a, b) => {
              const aExactMatch = a.capacity === guestCount;
              const bExactMatch = b.capacity === guestCount;
              
              if (aExactMatch && !bExactMatch) return -1; // a va primero
              if (!aExactMatch && bExactMatch) return 1;  // b va primero
              if (aExactMatch && bExactMatch) return a.capacity - b.capacity; // ambas exactas, ordenar por capacidad
              return a.capacity - b.capacity; // ninguna exacta, ordenar por capacidad
            });
            
            // Enviar cada cabaña con su información y foto
            for (const cabin of sortedCabins) {
             const cabinName = cabin.name.toLowerCase();
             const images = getCabinImages(cabinName);
             
             // Enviar información de la cabaña
             await sock.sendMessage(user, { 
               text: `🏡 **${cabin.name}**\n👥 Capacidad: ${cabin.capacity} personas\n💰 Precio: $${cabin.price}/noche` 
             });
             
             // Enviar solo 1 foto de la cabaña (primera imagen)
             if (images.length > 0) {
               console.log(`📸 Enviando 1 imagen de la cabaña ${cabinName}`);
               
               try {
                 await sock.sendMessage(user, {
                   image: { url: images[0] },
                   caption: `🏡 Cabaña ${cabin.name} - Las Acacias Refugio`
                 });
               } catch (error) {
                 console.error(`❌ Error enviando imagen ${images[0]}:`, error.message);
               }
             }
             
             // Pausa entre cabañas
             await new Promise(resolve => setTimeout(resolve, 2000));
           }
           
           // Enviar mensaje final con opciones
           const baseUrl = 'https://lasacaciasistemafront.vercel.app/';
           
           await sock.sendMessage(user, { 
             text: `¿Te gustaría saber más sobre alguna cabaña específica?\n\n🌐 **O ver todas las opciones en la web:**\n• ${baseUrl}` 
           });
          
           return null; // Ya enviamos todo manualmente
         } else {
           session.step = 'initial';
           userSessions.set(user, session);
           
           return `❌ **Lo siento, no hay disponibilidad para esas fechas:**\n\n📅 **Fechas:** ${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} - ${checkOut.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}\n👥 **Personas:** ${guestCount}\n\n💡 **Te sugiero:**\n• Probar otras fechas\n• Contactar directamente para verificar\n\n¿Quieres consultar otras fechas?`;
         }
       } else if (guestCount && dates.length === 0) {
         // Si solo encontramos personas, guardar y pedir fechas
         session.guestCount = guestCount;
         userSessions.set(user, session);
         
                   return "📅 **Perfecto! Ya tengo que buscas para " + guestCount + " personas.**\n\n¿De qué fecha a qué fecha estás buscando?\n\n**Ejemplos:**\n• \"del 14 al 16 de octubre\"\n• \"del 16/08 al 18/08\"\n• \"del 15 de noviembre al 18 de noviembre\"\n• \"del 25 de diciembre del 2025 al 01 de enero del 2026\"";
       } else if (dates.length >= 2 && !guestCount) {
         // Si solo encontramos fechas, pedir personas
         return "👥 **Perfecto! Ya tengo las fechas.**\n\n¿Para cuántas personas estás buscando?\n\n**Ejemplos:**\n• \"para 2 personas\"\n• \"somos 4\"\n• \"2 personas\"";
       } else {
         // Si no encontramos la información completa
         return "📝 **Por favor, indícame las fechas y cantidad de personas. Puedes escribirlo de varias formas:**\n\n**Ejemplos válidos:**\n• \"16 de agosto al 18 de agosto, 4 personas\"\n• \"ingreso 14 octubre, egreso 16 octubre 2025, 4 personas\"\n• \"del 25 de diciembre del 2025 al 01 de enero del 2026, 4 personas\"\n• \"llegada 15 noviembre, salida 18 noviembre, 2 personas\"\n• \"16/08 al 18/08, 4 personas\"\n• \"16-08 al 18-08, 4 pax\"\n• \"busco para el 16 de agosto al 18 de agosto, 4 personas\"\n\n¿Para qué fechas estás buscando y cuántas personas?";
       }
     }
         if (dates.length >= 2 && guestCount) {
       const checkIn = dates[0];
       const checkOut = dates[1];
       
       // Validar que las fechas no sean pasadas
       const today = new Date();
       today.setHours(0, 0, 0, 0);
       
       if (checkIn < today) {
         return `❌ **Error en las fechas:** La fecha de llegada (${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}) ya pasó.\n\nPor favor, indícame fechas futuras.`;
       }
       
       // Verificar que check-out sea después de check-in
       if (checkOut <= checkIn) {
         return "❌ **Error en las fechas:** La fecha de salida debe ser después de la fecha de llegada.\n\nPor favor, indícame las fechas correctamente (ejemplo: ingreso 14 octubre, egreso 16 octubre 2025, 4 personas)";
       }
      
      // Formatear fechas para el backend
      const checkInFormatted = formatDateForBackend(checkIn);
      const checkOutFormatted = formatDateForBackend(checkOut);
      
      // Consultar disponibilidad real
      const availableCabins = await checkAvailability(checkInFormatted, checkOutFormatted, guestCount);
      
             if (availableCabins && availableCabins.length > 0) {
         session.step = 'showing_availability';
         session.checkIn = checkInFormatted;
         session.checkOut = checkOutFormatted;
         session.guestCount = guestCount;
         userSessions.set(user, session);
         
         // Enviar mensaje inicial con fechas
         await sock.sendMessage(user, { 
           text: `✅ **¡Excelente! Encontré disponibilidad para tus fechas:**\n\n📅 **Fechas:** ${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} - ${checkOut.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}\n👥 **Personas:** ${guestCount}\n\n🏡 **Cabañas disponibles:**` 
         });
         
                   // Ordenar cabañas por capacidad: primero las que coinciden exactamente, luego las de mayor capacidad
          const sortedCabins = availableCabins.sort((a, b) => {
            const aExactMatch = a.capacity === guestCount;
            const bExactMatch = b.capacity === guestCount;
            
            if (aExactMatch && !bExactMatch) return -1; // a va primero
            if (!aExactMatch && bExactMatch) return 1;  // b va primero
            if (aExactMatch && bExactMatch) return a.capacity - b.capacity; // ambas exactas, ordenar por capacidad
            return a.capacity - b.capacity; // ninguna exacta, ordenar por capacidad
          });
          
          // Enviar cada cabaña con su información y foto
          for (const cabin of sortedCabins) {
           const cabinName = cabin.name.toLowerCase();
           const images = getCabinImages(cabinName);
           
           // Enviar información de la cabaña
           await sock.sendMessage(user, { 
             text: `🏡 **${cabin.name}**\n👥 Capacidad: ${cabin.capacity} personas\n💰 Precio: $${cabin.price}/noche` 
           });
           
                       // Enviar solo 1 foto de la cabaña (primera imagen)
            if (images.length > 0) {
              console.log(`📸 Enviando 1 imagen de la cabaña ${cabinName}`);
              
              try {
                await sock.sendMessage(user, {
                  image: { url: images[0] },
                  caption: `🏡 Cabaña ${cabin.name} - Las Acacias Refugio`
                });
              } catch (error) {
                console.error(`❌ Error enviando imagen ${images[0]}:`, error.message);
              }
            }
           
           // Pausa entre cabañas
           await new Promise(resolve => setTimeout(resolve, 2000));
         }
         
                   // Enviar mensaje final con opciones
          const baseUrl = 'https://lasacaciasistemafront.vercel.app/';
          
          await sock.sendMessage(user, { 
            text: `¿Te gustaría saber más sobre alguna cabaña específica?\n\n🌐 **O ver todas las opciones en la web:**\n• ${baseUrl}` 
          });
         
         return null; // Ya enviamos todo manualmente
      } else {
        session.step = 'initial';
        userSessions.set(user, session);
        
        return `❌ **Lo siento, no hay disponibilidad para esas fechas:**\n\n📅 **Fechas:** ${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} - ${checkOut.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}\n👥 **Personas:** ${guestCount}\n\n💡 **Te sugiero:**\n• Probar otras fechas\n• Contactar directamente para verificar\n• Teléfono: [Tu número]\n• WhatsApp: [Tu número]\n\n¿Quieres consultar otras fechas?`;
      }
    } else {
      // Si no encontramos la información completa
      return "📝 **Por favor, indícame las fechas y cantidad de personas. Puedes escribirlo de varias formas:**\n\n**Ejemplos válidos:**\n• \"16 de agosto al 18 de agosto, 4 personas\"\n• \"ingreso 14 octubre, egreso 16 octubre 2025, 4 personas\"\n• \"del 25 de diciembre del 2025 al 01 de enero del 2026, 4 personas\"\n• \"llegada 15 noviembre, salida 18 noviembre, 2 personas\"\n• \"16/08 al 18/08, 4 personas\"\n• \"16-08 al 18-08, 4 pax\"\n• \"busco para el 16 de agosto al 18 de agosto, 4 personas\"\n\n¿Para qué fechas estás buscando y cuántas personas?";
    }
  }
  
  // Si no está en el flujo de reserva, usar respuestas normales
  return getCabinResponse(messageText);
}

async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_stable');
    
         const sock = makeWASocket({
       auth: state,
       browser: ['Bot Cabañas', 'Chrome', '1.0.0'],
       connectTimeoutMs: 60000,
       defaultQueryTimeoutMs: 60000,
       emitOwnEvents: false,
       generateHighQualityLinkPreview: false,
       markOnlineOnConnect: false
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
        console.log('🏡 Bot de Las Acacias Refugio listo para recibir consultas');
        
        // Verificar estado inicial del bot
        checkBotStatus();
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
        
        // Verificar estado del bot antes de procesar mensajes
        checkBotStatus();
        
        // Control del bot con palabras clave (solo para administradores)
        const messageLower = messageText.toLowerCase().trim();
        
        console.log(`🔍 Verificando palabras clave: "${messageLower}"`);
        
        // Palabras clave para deshabilitar el bot
        if (messageLower === 'deshabilitar bot' || messageLower === 'apagar bot' || messageLower === 'stop bot') {
          console.log('🚨 PALABRA CLAVE DETECTADA: Deshabilitar bot');
          botEnabled = false;
          disabledByKeyword = true; // Marcar que fue deshabilitado por palabra clave
          
          // Limpiar todas las sesiones activas
          userSessions.clear();
          userMessageCounts.clear();
          greetedUsers.clear();
          transferredUsers.clear();
          
          console.log('🤖 Bot deshabilitado por palabra clave - Sesiones limpiadas');
          await sock.sendMessage(user, { 
            text: "🤖 **Bot deshabilitado**\n\nEl bot ya no responderá a ningún mensaje entrante.\n\nPara volver a habilitarlo, envía: 'habilitar bot'" 
          });
          return;
        }
        
        // Palabras clave para habilitar el bot
        if (messageLower === 'habilitar bot' || messageLower === 'encender bot' || messageLower === 'start bot') {
          console.log('🚨 PALABRA CLAVE DETECTADA: Habilitar bot');
          botEnabled = true;
          disabledByKeyword = false; // Resetear la marca de palabra clave
          console.log('🤖 Bot habilitado por palabra clave');
          await sock.sendMessage(user, { 
            text: "🤖 **Bot habilitado**\n\nEl bot ahora responderá normalmente a todos los mensajes.\n\nPara deshabilitarlo nuevamente, envía: 'deshabilitar bot'" 
          });
          return;
        }
        
        // Si el bot está deshabilitado, no responder a ningún otro mensaje
        if (!botEnabled) {
          console.log('🤖 Bot deshabilitado, ignorando mensaje');
          return;
                 }
         
         // Verificar si el usuario ya fue transferido a una persona
         if (transferredUsers.has(user)) {
           console.log("👤 Usuario transferido, ignorando mensaje");
           return; // No responder a usuarios transferidos
         }
         
         // Despedida
         if (messageLower === "adiós" || messageLower === "gracias") {
           console.log("👋 Respondiendo despedida");
           userSessions.delete(user); // Limpiar sesión
           await sock.sendMessage(user, { 
             text: "¡Gracias por contactarnos! 🏡 Si tienes más consultas, no dudes en escribirnos. ¡Que tengas un excelente día!" 
           });
           return;
         }
         
                   // Solicitud de hablar con una persona
          if (messageLower.includes('hablar con una persona') || messageLower.includes('hablar con alguien') || 
              messageLower.includes('atender una persona') || messageLower.includes('atender alguien') ||
              messageLower.includes('transferir con una persona') || messageLower.includes('transferir alguien') ||
              messageLower.includes('quiero hablar con una persona') || messageLower.includes('necesito hablar con una persona') ||
              messageLower.includes('puedo hablar con una persona') || messageLower.includes('hablar con un humano') ||
              messageLower.includes('atender un humano') || messageLower.includes('operador') || messageLower.includes('representante')) {
            console.log("👤 Solicitud de transferencia a persona");
            userSessions.delete(user); // Limpiar sesión
            userMessageCounts.delete(user); // Limpiar contador de mensajes
            greetedUsers.delete(user); // Limpiar usuario saludado
            
                         // Marcar al usuario como transferido para que no reciba más respuestas
             transferredUsers.add(user);
            
            await sock.sendMessage(user, { 
              text: "👤 **En breve serás transferido con una persona.**\n\n⏳ Por favor, espera un momento mientras te conectamos con nuestro equipo de atención al cliente.\n\n📞 Si no recibes respuesta en los próximos minutos, puedes contactarnos directamente al teléfono del establecimiento." 
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
        
                 // Procesar mensaje con el nuevo flujo
         try {
           console.log("🤖 Procesando mensaje...");
           
                       // Verificar si el mensaje contiene número de personas y no estamos en un flujo activo
            const session = userSessions.get(user) || { step: 'initial' };
            const text = messageText.toLowerCase().trim();
            
                        const personPatterns = [
               /(?:estoy\s+buscando\s+para\s+|solo\s+|para\s+|somos\s+|necesito\s+para\s+|quiero\s+para\s+)(\d+)\s*(?:personas?|gente|huéspedes?|pax|pasajeros?)/i,
               /(\d+)\s*(?:personas?|gente|huéspedes?|pax|pasajeros?)\s*(?:estoy\s+buscando|solo|para|somos|necesito|quiero)/i,
               /(?:busco\s+para\s+|buscando\s+para\s+|necesito\s+)(\d+)\s*(?:personas?|gente|huéspedes?|pax|pasajeros?)/i
             ];
             
             let detectedGuestCount = null;
             for (const pattern of personPatterns) {
               const match = text.match(pattern);
               if (match) {
                 detectedGuestCount = parseInt(match[1]);
                 break;
               }
             }
             
             // SIEMPRE actualizar el número de personas con el último valor mencionado
             if (detectedGuestCount) {
               session.guestCount = detectedGuestCount;
               userSessions.set(user, session);
             }
            
            // Validar que no se soliciten más de 6 personas
            if (detectedGuestCount && detectedGuestCount > 6) {
              await sock.sendMessage(user, { 
                text: `❌ **Lo siento, no tenemos cabañas disponibles para ${detectedGuestCount} personas.**\n\n🏡 **Nuestras cabañas tienen capacidad máxima de 6 personas.**\n\n💡 **Te sugiero:**\n• Buscar para 6 personas o menos\n• Contactar directamente para consultas especiales\n\n¿Te gustaría buscar para menos personas?` 
              });
              return;
            }
           
                       // Si detectamos número de personas y no estamos en un flujo activo, verificar si también hay fechas
            if (detectedGuestCount && session.step === 'initial') {
                          // Buscar fechas en el mismo mensaje
            const datePatterns = [
              // Patrón para "del 25 de diciembre de 2025 al 02 de enero del 2026" (fechas con años diferentes)
              /(?:del\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:de\s+)?(\d{4})\s+(?:al\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:del\s+)?(\d{4})/gi,
              // Patrón para "del 20/12 del 2025 al 01/01 del 2026" (fechas numéricas con años diferentes)
              /(?:del\s+)?(\d{1,2})[\/\-\.](\d{1,2})\s+(?:del\s+)?(\d{4})\s+(?:al\s+)?(\d{1,2})[\/\-\.](\d{1,2})\s+(?:del\s+)?(\d{4})/gi,
              // Patrón para "del 12 de febrero al 15" o "del 12 al 15 de febrero"
              /(?:del\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:al\s+)?(\d{1,2})(?:\s+de\s+(\w+))?/gi,
              // Patrón para "del 14 al 16 de octubre" o "del 14 al 16 octubre"
              /(?:del\s+)?(\d{1,2})\s+(?:al\s+)?(\d{1,2})\s+(?:de\s+)?(\w+)(?:\s+(\d{4}))?/gi,
              // Patrón original mejorado
              /(\d{1,2})\s+(?:de\s+)?(\w+)(?:\s+(\d{4}))?/gi,
              // Patrón para fechas con separadores
              /(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{4}))?/gi
            ];
              
              const dates = [];
              
                             for (const pattern of datePatterns) {
                 let match;
                 while ((match = pattern.exec(messageText)) !== null) {
                   const months = {
                     'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
                     'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
                   };
                   
                   // Si es el patrón "del 25 de diciembre de 2025 al 02 de enero del 2026" (fechas con años diferentes)
                   if (pattern.source.includes('de\\s+\\d{4}\\s+al\\s+\\d{1,2}\\s+de\\s+\\w+\\s+del\\s+\\d{4}')) {
                     const day1 = parseInt(match[1]);
                     const monthName1 = match[2];
                     const year1 = parseInt(match[3]);
                     const day2 = parseInt(match[4]);
                     const monthName2 = match[5];
                     const year2 = parseInt(match[6]);
                     
                     if (months[monthName1] !== undefined && months[monthName2] !== undefined) {
                       const month1 = months[monthName1];
                       const month2 = months[monthName2];
                       
                       const date1 = new Date(year1, month1, day1);
                       const date2 = new Date(year2, month2, day2);
                       
                       if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year1 &&
                           date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year2) {
                         dates.push(date1, date2);
                         break;
                       }
                     }
                   }
                   // Si es el patrón "del 20/12 del 2025 al 01/01 del 2026" (fechas numéricas con años diferentes)
                   else if (pattern.source.includes('[\\/\\-\\.]\\d{1,2}\\s+del\\s+\\d{4}\\s+al\\s+\\d{1,2}[\\/\\-\\.]\\d{1,2}\\s+del\\s+\\d{4}')) {
                     const day1 = parseInt(match[1]);
                     const month1 = parseInt(match[2]) - 1; // Los meses en JS van de 0-11
                     const year1 = parseInt(match[3]);
                     const day2 = parseInt(match[4]);
                     const month2 = parseInt(match[5]) - 1; // Los meses en JS van de 0-11
                     const year2 = parseInt(match[6]);
                     
                     const date1 = new Date(year1, month1, day1);
                     const date2 = new Date(year2, month2, day2);
                     
                     if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year1 &&
                         date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year2) {
                       dates.push(date1, date2);
                       break;
                     }
                   }
                                       // Si es el patrón "del X de mes al Y" o "del X al Y de mes"
                    else if (pattern.source.includes('del\\s+') && pattern.source.includes('al\\s+')) {
                      let day1, day2, month1, month2, year;
                      
                      // Verificar si es el patrón "del X de mes al Y" (con mes especificado)
                      if (pattern.source.includes('(?:de\\s+)?(\\\\w+)\\s+(?:al\\s+)?(\\\\d{1,2})') && match[1] && match[2] && match[3] && months[match[2]]) {
                        // Formato: "del 18 de septiembre al 20" o "del 12 de febrero al 15"
                        day1 = parseInt(match[1]);
                        const monthName1 = match[2];
                        day2 = parseInt(match[3]);
                        const monthName2 = match[4];
                        year = new Date().getFullYear();
                        
                        if (months[monthName1] !== undefined) {
                          month1 = months[monthName1];
                          // Si no se especifica el segundo mes, asumir que es el mismo mes
                          month2 = months[monthName2] !== undefined ? months[monthName2] : month1;
                          
                          const date1 = new Date(year, month1, day1);
                          const date2 = new Date(year, month2, day2);
                          
                          if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year &&
                              date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year) {
                            dates.push(date1, date2);
                            break; // Ya tenemos las dos fechas, no necesitamos seguir buscando
                          }
                        }
                      } else {
                        // Formato: "del 14 al 16 de octubre"
                        day1 = parseInt(match[1]);
                        day2 = parseInt(match[2]);
                        const monthName = match[3];
                        year = match[4] ? parseInt(match[4]) : new Date().getFullYear();
                        
                        if (months[monthName] !== undefined) {
                          month1 = months[monthName];
                          month2 = months[monthName];
                          
                          const date1 = new Date(year, month1, day1);
                          const date2 = new Date(year, month2, day2);
                          
                          if (date1.getDate() === day1 && date1.getMonth() === month1 && date1.getFullYear() === year &&
                              date2.getDate() === day2 && date2.getMonth() === month2 && date2.getFullYear() === year) {
                            dates.push(date1, date2);
                            break; // Ya tenemos las dos fechas, no necesitamos seguir buscando
                          }
                        }
                      }
                   } else {
                     // Patrón normal
                     const date = parseSpanishDate(match[0]);
                     if (date) {
                       dates.push(date);
                     }
                   }
                 }
               }
              
              // Si encontramos fechas y personas en el mismo mensaje
              if (dates.length >= 2) {
                const checkIn = dates[0];
                const checkOut = dates[1];
                
                // Validar que las fechas no sean pasadas
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                if (checkIn < today) {
                  await sock.sendMessage(user, { 
                    text: `❌ **Error en las fechas:** La fecha de llegada (${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}) ya pasó.\n\nPor favor, indícame fechas futuras.` 
                  });
                  return;
                }
                
                // Verificar que check-out sea después de check-in
                if (checkOut <= checkIn) {
                  await sock.sendMessage(user, { 
                    text: "❌ **Error en las fechas:** La fecha de salida debe ser después de la fecha de llegada.\n\nPor favor, indícame las fechas correctamente (ejemplo: del 14 al 16 de octubre)" 
                  });
                  return;
                }
                
                // Formatear fechas para el backend
                const checkInFormatted = formatDateForBackend(checkIn);
                const checkOutFormatted = formatDateForBackend(checkOut);
                
                // Consultar disponibilidad real
                const availableCabins = await checkAvailability(checkInFormatted, checkOutFormatted, detectedGuestCount);
                
                if (availableCabins && availableCabins.length > 0) {
                  session.step = 'showing_availability';
                  session.checkIn = checkInFormatted;
                  session.checkOut = checkOutFormatted;
                  session.guestCount = detectedGuestCount;
                  userSessions.set(user, session);
                  
                  // Enviar mensaje inicial con fechas
                  await sock.sendMessage(user, { 
                    text: `✅ **¡Excelente! Encontré disponibilidad para tus fechas:**\n\n📅 **Fechas:** ${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} - ${checkOut.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}\n👥 **Personas:** ${detectedGuestCount}\n\n🏡 **Cabañas disponibles:**` 
                  });
                  
                  // Ordenar cabañas por capacidad
                  const sortedCabins = availableCabins.sort((a, b) => {
                    const aExactMatch = a.capacity === detectedGuestCount;
                    const bExactMatch = b.capacity === detectedGuestCount;
                    
                    if (aExactMatch && !bExactMatch) return -1;
                    if (!aExactMatch && bExactMatch) return 1;
                    if (aExactMatch && bExactMatch) return a.capacity - b.capacity;
                    return a.capacity - b.capacity;
                  });
                  
                  // Enviar cada cabaña con su información y foto
                  for (const cabin of sortedCabins) {
                    const cabinName = cabin.name.toLowerCase();
                    const images = getCabinImages(cabinName);
                    
                    await sock.sendMessage(user, { 
                      text: `🏡 **${cabin.name}**\n👥 Capacidad: ${cabin.capacity} personas\n💰 Precio: $${cabin.price}/noche` 
                    });
                    
                    if (images.length > 0) {
                      try {
                        await sock.sendMessage(user, {
                          image: { url: images[0] },
                          caption: `🏡 Cabaña ${cabin.name} - Las Acacias Refugio`
                        });
                      } catch (error) {
                        console.error(`❌ Error enviando imagen ${images[0]}:`, error.message);
                      }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                  
                  const baseUrl = 'https://lasacaciasistemafront.vercel.app/';
                  await sock.sendMessage(user, { 
                    text: `¿Te gustaría saber más sobre alguna cabaña específica?\n\n🌐 **O ver todas las opciones en la web:**\n• ${baseUrl}` 
                  });
                  
                  return;
                } else {
                  session.step = 'initial';
                  userSessions.set(user, session);
                  
                  await sock.sendMessage(user, { 
                    text: `❌ **Lo siento, no hay disponibilidad para esas fechas:**\n\n📅 **Fechas:** ${checkIn.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} - ${checkOut.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}\n👥 **Personas:** ${detectedGuestCount}\n\n💡 **Te sugiero:**\n• Probar otras fechas\n• Contactar directamente para verificar\n\n¿Quieres consultar otras fechas?` 
                  });
                  return;
                }
              } else {
                // Solo detectamos personas, preguntar por fechas
                session.guestCount = detectedGuestCount;
                session.step = 'asking_dates';
                userSessions.set(user, session);
                
                                 const response = `👥 **¡Perfecto! Entiendo que buscas para ${detectedGuestCount} personas.**\n\n📅 **¿Para qué fechas estás buscando?**\n\nPuedes escribirlo de varias formas:\n• "del 16 de agosto al 18 de agosto"\n• "del 14/10 al 16/10"\n• "del 15 de noviembre al 18 de noviembre"\n• "del 25 de diciembre del 2025 al 01 de enero del 2026"\n• "llegada 16 agosto, salida 18 agosto"`;
                
                await sock.sendMessage(user, { text: response });
                return;
              }
            }
           
           const response = await processReservationFlow(user, messageText, sock);
           console.log("✅ Respuesta generada");
           
           if (response) {
             await sock.sendMessage(user, { text: response });
           }
         } catch (error) {
           console.error("❌ Error al procesar mensaje:", error);
           try {
             await sock.sendMessage(user, { 
               text: "Lo siento, hubo un error al procesar tu consulta. Por favor, contacta directamente al establecimiento para obtener la información que necesitas. 📞" 
             });
           } catch (sendError) {
             console.error("❌ Error enviando mensaje de error:", sendError);
           }
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
console.log('🚀 Iniciando bot de WhatsApp para Las Acacias Refugio...');
connectToWhatsApp().catch(err => {
  console.log("❌ Error inesperado:", err);
  console.log("🔄 Reiniciando en 2 minutos...");
  setTimeout(() => {
    connectToWhatsApp();
  }, 120000);
});
