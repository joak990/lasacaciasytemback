// config.js
// Configuración del bot de WhatsApp para cabañas

module.exports = {
  // API Key de Gemini (Google AI)
  // Obtén tu API key en: https://makersuite.google.com/app/apikey
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'tu_api_key_de_gemini_aqui',
  
  // Configuración del servidor
  PORT: process.env.PORT || 3001,
  
  // Configuración del bot
  BOT_NAME: 'Bot de Cabañas',
  BOT_VERSION: '1.0.0',
  
  // Límites
  MAX_MESSAGES_PER_HOUR: 15,
  
  // Timeouts
  CONNECTION_TIMEOUT: 60000,
  RECONNECT_DELAY: 30000
};



