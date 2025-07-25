#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Iniciando setup del Sistema de Administración de Cabañas...\n');

// Verificar si existe el archivo .env
if (!fs.existsSync('.env')) {
  console.log('📝 Creando archivo .env...');
  try {
    fs.copyFileSync('env.example', '.env');
    console.log('✅ Archivo .env creado exitosamente');
  } catch (error) {
    console.error('❌ Error al crear .env:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ Archivo .env ya existe');
}

// Verificar si Docker está instalado
try {
  execSync('docker --version', { stdio: 'ignore' });
  console.log('✅ Docker está instalado');
} catch (error) {
  console.error('❌ Docker no está instalado. Por favor instala Docker primero.');
  process.exit(1);
}

// Verificar si Docker Compose está instalado
try {
  execSync('docker-compose --version', { stdio: 'ignore' });
  console.log('✅ Docker Compose está instalado');
} catch (error) {
  console.error('❌ Docker Compose no está instalado. Por favor instala Docker Compose primero.');
  process.exit(1);
}

console.log('\n📦 Instalando dependencias...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencias instaladas');
} catch (error) {
  console.error('❌ Error al instalar dependencias:', error.message);
  process.exit(1);
}

console.log('\n🐳 Levantando servicios de Docker...');
try {
  execSync('npm run docker:up', { stdio: 'inherit' });
  console.log('✅ Servicios de Docker levantados');
} catch (error) {
  console.error('❌ Error al levantar servicios de Docker:', error.message);
  process.exit(1);
}

// Esperar un poco para que la base de datos esté lista
console.log('\n⏳ Esperando que la base de datos esté lista...');
setTimeout(() => {
  console.log('\n🔧 Generando cliente de Prisma...');
  try {
    execSync('npm run db:generate', { stdio: 'inherit' });
    console.log('✅ Cliente de Prisma generado');
  } catch (error) {
    console.error('❌ Error al generar cliente de Prisma:', error.message);
    process.exit(1);
  }

  console.log('\n🗄️ Ejecutando migraciones...');
  try {
    execSync('npm run db:migrate', { stdio: 'inherit' });
    console.log('✅ Migraciones ejecutadas');
  } catch (error) {
    console.error('❌ Error al ejecutar migraciones:', error.message);
    process.exit(1);
  }

  console.log('\n🎉 ¡Setup completado exitosamente!');
  console.log('\n📋 Próximos pasos:');
  console.log('1. Ejecuta: npm run dev');
  console.log('2. Accede a la API en: http://localhost:3000');
  console.log('3. Accede a pgAdmin en: http://localhost:5050');
  console.log('   - Email: admin@cabinsystem.com');
  console.log('   - Password: admin123');
  console.log('\n📚 Revisa el README.md para más información');
}, 10000); // Esperar 10 segundos 