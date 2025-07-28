const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function insertCabins() {
  try {
    console.log('🏠 Insertando cabañas...');

    const cabins = [
      {
        id: 'cabin-turquesa',
        name: 'Turquesa',
        description: 'Hermosa cabaña con vista al lago, perfecta para 4 personas',
        capacity: 4,
        price: 35000.00,
        status: 'AVAILABLE',
        amenities: ['WiFi', 'Cocina completa', 'Terraza', 'Estacionamiento', 'Vista al lago'],
        images: []
      },
      {
        id: 'cabin-maiz',
        name: 'Maíz',
        description: 'Cabaña espaciosa ideal para grupos de 6 personas',
        capacity: 6,
        price: 40000.00,
        status: 'AVAILABLE',
        amenities: ['WiFi', 'Cocina completa', 'Terraza', 'Estacionamiento', 'Juegos de mesa'],
        images: []
      },
      {
        id: 'cabin-perla',
        name: 'Perla',
        description: 'Cabaña romántica perfecta para 2 personas',
        capacity: 2,
        price: 20000.00,
        status: 'AVAILABLE',
        amenities: ['WiFi', 'Cocina completa', 'Terraza', 'Chimenea'],
        images: []
      },
      {
        id: 'cabin-rosa',
        name: 'Rosa',
        description: 'Cabaña acogedora para 3 personas con ambiente familiar',
        capacity: 3,
        price: 20000.00,
        status: 'AVAILABLE',
        amenities: ['WiFi', 'Cocina completa', 'Terraza', 'Jardín'],
        images: []
      },
      {
        id: 'cabin-beige',
        name: 'Beige',
        description: 'Cabaña moderna y elegante para 5 personas',
        capacity: 5,
        price: 40000.00,
        status: 'AVAILABLE',
        amenities: ['WiFi', 'Cocina completa', 'Terraza', 'Estacionamiento', 'Jacuzzi'],
        images: []
      }
    ];

    for (const cabin of cabins) {
      await prisma.cabin.upsert({
        where: { id: cabin.id },
        update: cabin,
        create: cabin
      });
      console.log(`✅ Cabaña "${cabin.name}" insertada/actualizada`);
    }

    console.log('\n🎉 ¡Todas las cabañas han sido insertadas exitosamente!');
    
    // Mostrar las cabañas insertadas
    const insertedCabins = await prisma.cabin.findMany({
      where: {
        name: {
          in: ['Turquesa', 'Maíz', 'Perla', 'Rosa', 'Beige']
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log('\n📊 Cabañas en la base de datos:');
    insertedCabins.forEach(cabin => {
      console.log(`- ${cabin.name}: ${cabin.capacity} personas, $${cabin.price}/noche`);
    });

  } catch (error) {
    console.error('❌ Error insertando cabañas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

insertCabins(); 