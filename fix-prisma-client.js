const { execSync } = require('child_process');

try {
  console.log('🔧 Regenerando cliente de Prisma...');
  
  // Generar el cliente de Prisma
  execSync('npx prisma generate', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  
  console.log('✅ Cliente de Prisma regenerado exitosamente');
  
} catch (error) {
  console.error('❌ Error regenerando cliente de Prisma:', error);
  process.exit(1);
}
