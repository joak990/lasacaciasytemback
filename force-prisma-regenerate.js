const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  console.log('🔧 Forzando regeneración del cliente de Prisma...');
  
  // Eliminar el directorio del cliente generado
  const clientPath = path.join(__dirname, 'node_modules', '.prisma', 'client');
  if (fs.existsSync(clientPath)) {
    console.log('🗑️ Eliminando cliente existente...');
    fs.rmSync(clientPath, { recursive: true, force: true });
  }
  
  // Generar el cliente de Prisma
  console.log('📝 Generando nuevo cliente...');
  execSync('npx prisma generate', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  
  console.log('✅ Cliente de Prisma regenerado exitosamente');
  
  // Verificar que el modelo esté disponible
  console.log('🔍 Verificando modelos disponibles...');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  const models = Object.keys(prisma).filter(key => 
    !key.startsWith('_') && 
    !key.startsWith('$') && 
    typeof prisma[key] === 'object' &&
    prisma[key] !== null
  );
  
  console.log('📋 Modelos disponibles:', models);
  
  if (models.includes('cabinPricing')) {
    console.log('✅ Modelo cabinPricing encontrado!');
  } else {
    console.log('❌ Modelo cabinPricing NO encontrado');
  }
  
  await prisma.$disconnect();
  
} catch (error) {
  console.error('❌ Error regenerando cliente de Prisma:', error);
  process.exit(1);
}



