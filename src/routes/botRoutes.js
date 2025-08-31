const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Archivo para almacenar el estado del bot
const BOT_STATUS_FILE = path.join(__dirname, '../../bot/bot-status.json');

// Asegurar que el directorio existe
const dataDir = path.dirname(BOT_STATUS_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Función para leer el estado del bot
function getBotStatus() {
  try {
    if (fs.existsSync(BOT_STATUS_FILE)) {
      const data = fs.readFileSync(BOT_STATUS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error leyendo estado del bot:', error);
  }
  
  // Estado por defecto: habilitado
  return { enabled: true };
}

// Función para guardar el estado del bot
function saveBotStatus(status) {
  try {
    fs.writeFileSync(BOT_STATUS_FILE, JSON.stringify(status, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando estado del bot:', error);
    return false;
  }
}

// GET /api/bot/status - Obtener estado del bot
router.get('/status', (req, res) => {
  try {
    const status = getBotStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error obteniendo estado del bot:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// POST /api/bot/enable - Habilitar el bot
router.post('/enable', (req, res) => {
  try {
    const success = saveBotStatus({ enabled: true });
    
    if (success) {
      console.log('🤖 Bot habilitado');
      res.json({
        success: true,
        message: 'Bot habilitado exitosamente',
        data: { enabled: true }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error al habilitar el bot'
      });
    }
  } catch (error) {
    console.error('Error habilitando bot:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// POST /api/bot/disable - Deshabilitar el bot
router.post('/disable', (req, res) => {
  try {
    const success = saveBotStatus({ enabled: false });
    
    if (success) {
      console.log('🤖 Bot deshabilitado');
      res.json({
        success: true,
        message: 'Bot deshabilitado exitosamente',
        data: { enabled: false }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error al deshabilitar el bot'
      });
    }
  } catch (error) {
    console.error('Error deshabilitando bot:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// POST /api/bot/toggle - Cambiar estado del bot
router.post('/toggle', (req, res) => {
  try {
    const currentStatus = getBotStatus();
    const newStatus = { enabled: !currentStatus.enabled };
    const success = saveBotStatus(newStatus);
    
    if (success) {
      const action = newStatus.enabled ? 'habilitado' : 'deshabilitado';
      console.log(`🤖 Bot ${action}`);
      res.json({
        success: true,
        message: `Bot ${action} exitosamente`,
        data: newStatus
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error al cambiar el estado del bot'
      });
    }
  } catch (error) {
    console.error('Error cambiando estado del bot:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;

