// 🔧 FIX: Regenerar cliente de Prisma para incluir modelo CabinPricing
// Este cambio fuerza un nuevo build en Render para regenerar el cliente de Prisma
// después de agregar el modelo CabinPricing al schema

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://127.0.0.1:3001',
    'https://lasacaciasistemafront.vercel.app',
    'https://lasacaciasistemafront.vercel.app/',
    'https://*.vercel.app',
    'https://vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle preflight requests
app.options('*', cors());

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Sistema de Administración de Cabañas API',
    version: '1.0.0',
    status: 'running'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Import routes
const authRoutes = require('./routes/userRoutes');
const cabinRoutes = require('./routes/cabinRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const botRoutes = require('./routes/botRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/cabins', cabinRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/bot', botRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

// Función para iniciar el bot
function startBot() {
  try {
    console.log('🤖 Iniciando bot de WhatsApp...');
    const { spawn } = require('child_process');
    const path = require('path');
    
    const botPath = path.join(__dirname, '../bot/stable-bot.js');
    const botProcess = spawn('node', [botPath], {
      stdio: 'inherit',
      detached: false
    });
    
    botProcess.on('error', (error) => {
      console.error('❌ Error iniciando bot:', error);
    });
    
    botProcess.on('exit', (code) => {
      console.log(`🤖 Bot terminado con código: ${code}`);
      // Reiniciar el bot después de 5 segundos si se cierra
      setTimeout(() => {
        console.log('🔄 Reiniciando bot...');
        startBot();
      }, 5000);
    });
    
    console.log('✅ Bot iniciado correctamente');
    return botProcess;
  } catch (error) {
    console.error('❌ Error iniciando bot:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
  
  // Iniciar el bot solo si ENABLE_BOT está configurado en .env
  const enableBot = process.env.ENABLE_BOT === 'true' || process.env.ENABLE_BOT === '1';
  if (enableBot) {
    console.log('🤖 Iniciando bot de WhatsApp automáticamente...');
    startBot();
  } else {
    console.log('🤖 Bot de WhatsApp deshabilitado (configura ENABLE_BOT=true en .env para habilitarlo)');
  }
});