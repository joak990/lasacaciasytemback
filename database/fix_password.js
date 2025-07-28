const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixPassword() {
  try {
    const email = 'punillapublicidad@yahoo.com.ar';
    const password = 'anita1503';

    console.log('🔧 Hasheando contraseña para:', email);

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ Contraseña hasheada:', hashedPassword);

    // Actualizar el usuario en la base de datos
    const updatedUser = await prisma.user.update({
      where: { email: email },
      data: {
        password: hashedPassword
      }
    });

    console.log('✅ Usuario actualizado:', updatedUser.email);

    // Verificar que funciona
    const user = await prisma.user.findUnique({
      where: { email: email }
    });

    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('✅ Verificación de contraseña:', isValidPassword);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPassword(); 