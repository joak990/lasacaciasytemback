const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Middleware para manejar errores de conexión
prisma.$on('error', (e) => {
  console.error('❌ Prisma error:', e);
});

// Manejar desconexión cuando la aplicación se cierre
process.on('beforeExit', async () => {
  console.log('🔌 Disconnecting from database...');
  await prisma.$disconnect();
});

module.exports = prisma; 