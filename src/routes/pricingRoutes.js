const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const router = express.Router();

// Verificar que prisma esté disponible
if (!prisma) {
  console.error('❌ Error: Prisma no está disponible');
  throw new Error('Prisma client no está disponible');
}

// Función temporal para usar CabinPricing con SQL directo
async function getCabinPricing(cabinId, isActive = true) {
  try {
    const pricing = await prisma.$queryRaw`
      SELECT * FROM "CabinPricing" 
      WHERE "cabinId" = ${cabinId} 
      AND "isActive" = ${isActive}
      ORDER BY "priority" DESC, "startDate" ASC
    `;
    return pricing;
  } catch (error) {
    console.error('❌ Error en consulta SQL CabinPricing:', error);
    return [];
  }
}

async function createCabinPricing(data) {
  try {
    const result = await prisma.$executeRaw`
      INSERT INTO "CabinPricing" (
        "id", "cabinId", "startDate", "endDate", "price", 
        "priceType", "description", "isActive", "priority", 
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), ${data.cabinId}, ${data.startDate}, ${data.endDate}, ${data.price},
        ${data.priceType}::"CabinPriceType", ${data.description}, ${data.isActive}, ${data.priority},
        NOW(), NOW()
      )
    `;
    return result;
  } catch (error) {
    console.error('❌ Error creando CabinPricing con SQL:', error);
    throw error;
  }
}

async function findConflictingPricing(cabinId, startDate, endDate) {
  try {
    const conflicts = await prisma.$queryRaw`
      SELECT * FROM "CabinPricing" 
      WHERE "cabinId" = ${cabinId} 
      AND "isActive" = true
      AND (
        ("startDate" <= ${startDate} AND "endDate" >= ${startDate}) OR
        ("startDate" <= ${endDate} AND "endDate" >= ${endDate})
      )
    `;
    return conflicts.length > 0 ? conflicts[0] : null;
  } catch (error) {
    console.error('❌ Error buscando conflictos con SQL:', error);
    return null;
  }
}

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/pricing/cabin/:cabinId - Obtener precios de una cabaña
router.get('/cabin/:cabinId', async (req, res) => {
  try {
    const { cabinId } = req.params;
    
    // Usar función temporal con SQL directo
    const pricing = await getCabinPricing(cabinId);
    
    res.json(pricing);
  } catch (error) {
    console.error('Error obteniendo precios:', error);
    res.status(500).json({ error: 'Error al obtener precios' });
  }
});

// POST /api/pricing - Crear nuevo precio
router.post('/', [
  body('cabinId').notEmpty().withMessage('ID de cabaña requerido'),
  body('startDate').isISO8601().withMessage('Fecha inicio inválida'),
  body('endDate').isISO8601().withMessage('Fecha fin inválida'),
  body('price').isFloat({ min: 0 }).withMessage('Precio debe ser positivo'),
  body('priceType').isIn(['BASE', 'SEASONAL', 'HOLIDAY', 'WEEKEND', 'CUSTOM']).withMessage('Tipo de precio inválido'),
  body('description').optional().isString(),
  body('priority').optional().isInt({ min: 1 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { cabinId, startDate, endDate, price, priceType, description, priority = 1 } = req.body;

    console.log('📝 Creando precio:', { cabinId, startDate, endDate, price, priceType, description, priority });

    // Verificar que prisma esté disponible
    if (!prisma || !prisma.cabin) {
      console.error('❌ Error: Prisma o cabin no está disponible');
      return res.status(500).json({ error: 'Error de configuración de base de datos' });
    }

    // Verificar que la cabaña existe - solo seleccionar campos que existen
    const cabin = await prisma.cabin.findUnique({ 
      where: { id: cabinId },
      select: {
        id: true,
        name: true,
        price: true
      }
    });
    
    if (!cabin) {
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    // Verificar conflictos de fechas usando SQL directo
    const conflictingPricing = await findConflictingPricing(cabinId, new Date(startDate), new Date(endDate));

    if (conflictingPricing) {
      return res.status(400).json({ 
        error: 'Ya existe un precio configurado para este período' 
      });
    }

    // Crear precio usando SQL directo
    await createCabinPricing({
      cabinId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      price: parseFloat(price),
      priceType,
      description: description || null,
      isActive: true,
      priority: parseInt(priority)
    });

    console.log('✅ Precio creado exitosamente');
    res.status(201).json({ 
      message: 'Precio creado exitosamente',
      cabinId,
      startDate,
      endDate,
      price,
      priceType
    });
  } catch (error) {
    console.error('❌ Error creando precio:', error);
    res.status(500).json({ error: 'Error al crear precio' });
  }
});

// PUT /api/pricing/:id - Actualizar precio
router.put('/:id', [
  body('price').optional().isFloat({ min: 0 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('priceType').optional().isIn(['BASE', 'SEASONAL', 'HOLIDAY', 'WEEKEND', 'CUSTOM']),
  body('description').optional().isString(),
  body('priority').optional().isInt({ min: 1 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('📝 Actualizando precio:', { id, updateData });

    // Convertir tipos de datos si están presentes
    if (updateData.price) updateData.price = parseFloat(updateData.price);
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
    if (updateData.priority) updateData.priority = parseInt(updateData.priority);

    const updatedPricing = await prisma.cabinPricing.update({
      where: { id },
      data: updateData
    });

    console.log('✅ Precio actualizado:', updatedPricing);
    res.json(updatedPricing);
  } catch (error) {
    console.error('❌ Error actualizando precio:', error);
    res.status(500).json({ error: 'Error al actualizar precio' });
  }
});

// DELETE /api/pricing/:id - Eliminar precio
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Eliminando precio:', id);

    await prisma.cabinPricing.delete({
      where: { id }
    });

    console.log('✅ Precio eliminado correctamente');
    res.json({ message: 'Precio eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error eliminando precio:', error);
    res.status(500).json({ error: 'Error al eliminar precio' });
  }
});

// GET /api/pricing/calculate - Calcular precio para fechas específicas
router.get('/calculate', async (req, res) => {
  try {
    const { cabinId, checkIn, checkOut } = req.query;

    if (!cabinId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Parámetros requeridos: cabinId, checkIn, checkOut' });
    }

    const price = await calculateCabinPrice(cabinId, new Date(checkIn), new Date(checkOut));
    
    res.json({ 
      cabinId,
      checkIn,
      checkOut,
      totalPrice: price,
      pricePerNight: price / Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
    });
  } catch (error) {
    console.error('Error calculando precio:', error);
    res.status(500).json({ error: 'Error al calcular precio' });
  }
});

// Función auxiliar para calcular precio
async function calculateCabinPrice(cabinId, checkIn, checkOut) {
  const cabin = await prisma.cabin.findUnique({
    where: { id: cabinId },
    include: {
      pricing: {
        where: {
          isActive: true,
          OR: [
            {
              AND: [
                { startDate: { lte: checkOut } },
                { endDate: { gte: checkIn } }
              ]
            }
          ]
        },
        orderBy: { priority: 'desc' }
      }
    }
  });

  if (!cabin) throw new Error('Cabaña no encontrada');

  let totalPrice = 0;
  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  
  // Si no hay precios específicos, usar precio base
  if (cabin.pricing.length === 0) {
    return cabin.price * nights;
  }

  // Calcular precio día por día
  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(checkIn);
    currentDate.setDate(currentDate.getDate() + i);
    
    // Buscar precio específico para esta fecha
    const specificPricing = cabin.pricing.find(p => 
      currentDate >= p.startDate && currentDate <= p.endDate
    );
    
    totalPrice += specificPricing ? specificPricing.price : cabin.price;
  }

  return totalPrice;
}

module.exports = router;