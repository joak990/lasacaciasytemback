const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function applyCabinPricingMigration() {
  try {
    console.log('🔧 Aplicando migración de CabinPricing...');
    
    // Verificar si la tabla ya existe
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'CabinPricing'
      );
    `;
    
    if (tableExists[0].exists) {
      console.log('✅ La tabla CabinPricing ya existe');
      return;
    }
    
    // Crear el enum CabinPriceType
    console.log('📝 Creando enum CabinPriceType...');
    await prisma.$executeRaw`
      CREATE TYPE "CabinPriceType" AS ENUM ('BASE', 'SEASONAL', 'HOLIDAY', 'WEEKEND', 'CUSTOM');
    `;
    
    // Crear la tabla CabinPricing
    console.log('📝 Creando tabla CabinPricing...');
    await prisma.$executeRaw`
      CREATE TABLE "CabinPricing" (
        "id" TEXT NOT NULL,
        "cabinId" TEXT NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "price" DOUBLE PRECISION NOT NULL,
        "priceType" "CabinPriceType" NOT NULL DEFAULT 'CUSTOM',
        "description" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "priority" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CabinPricing_pkey" PRIMARY KEY ("id")
      );
    `;
    
    // Crear índices
    console.log('📝 Creando índices...');
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX "CabinPricing_cabinId_startDate_endDate_key" ON "CabinPricing"("cabinId", "startDate", "endDate");
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX "CabinPricing_cabinId_startDate_endDate_idx" ON "CabinPricing"("cabinId", "startDate", "endDate");
    `;
    
    // Agregar foreign key
    console.log('📝 Agregando foreign key...');
    await prisma.$executeRaw`
      ALTER TABLE "CabinPricing" ADD CONSTRAINT "CabinPricing_cabinId_fkey" 
      FOREIGN KEY ("cabinId") REFERENCES "Cabin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `;
    
    console.log('✅ Migración de CabinPricing aplicada exitosamente');
    
  } catch (error) {
    console.error('❌ Error aplicando migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la migración
applyCabinPricingMigration()
  .then(() => {
    console.log('🎉 Migración completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error en migración:', error);
    process.exit(1);
  });
