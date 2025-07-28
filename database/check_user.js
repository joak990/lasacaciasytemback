const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const email = 'punillapublicidad@yahoo.com.ar';
    const password = 'anita1503';

    console.log('🔍 Verificando usuario:', email);

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email: email }
    });

    if (!user) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    console.log('✅ Usuario encontrado:');
    console.log('   - ID:', user.id);
    console.log('   - Email:', user.email);
    console.log('   - Name:', user.name);
    console.log('   - Password hash:', user.password);
    console.log('   - Password hash length:', user.password.length);

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('   - Password válida:', isValidPassword);

    // Crear hash de la contraseña para comparar
    const newHash = await bcrypt.hash(password, 12);
    console.log('   - Nuevo hash:', newHash);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser(); 