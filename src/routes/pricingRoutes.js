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
        ("startDate" < ${endDate} AND "endDate" > ${startDate})
      )
    `;
    return conflicts.length > 0 ? conflicts[0] : null;
  } catch (error) {
    console.error('❌ Error buscando conflictos con SQL:', error);
    return null;
  }
}

// Función auxiliar para parsear fechas correctamente
const parseDate = (dateString) => {
  const [year, month, day] = dateString.split('-');
  // Usar Date.UTC para evitar problemas de zona horaria
  return new Date(Date.UTC(year, parseInt(month) - 1, day, 0, 0, 0));
};

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
    
    // Redondear precios a 2 decimales para evitar errores de punto flotante
    const pricingWithRoundedPrices = pricing.map(p => ({
      ...p,
      price: Math.round(p.price * 100) / 100
    }));
    
    res.json(pricingWithRoundedPrices);
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
        price: true,
        capacity: true,
        pricing: {
          where: {
            isActive: true
          },
          orderBy: { priority: 'desc' }
        }
      }
    });
    
    if (!cabin) {
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    const conflictingPricing = await findConflictingPricing(cabinId, parseDate(startDate), parseDate(endDate));

    if (conflictingPricing) {
      return res.status(400).json({ 
        error: 'Ya existe un precio configurado para este período' 
      });
    }

    // Crear precio usando SQL directo
    await createCabinPricing({
      cabinId,
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
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

    // Construir la consulta SQL dinámicamente
    const setClauses = [];
    const values = [];

    if (updateData.price !== undefined) {
      setClauses.push(`"price" = $${values.length + 1}`);
      values.push(parseFloat(updateData.price));
    }
    if (updateData.startDate !== undefined) {
      setClauses.push(`"startDate" = $${values.length + 1}`);
      values.push(parseDate(updateData.startDate));
    }
    if (updateData.endDate !== undefined) {
      setClauses.push(`"endDate" = $${values.length + 1}`);
      values.push(parseDate(updateData.endDate));
    }
    if (updateData.priceType !== undefined) {
      setClauses.push(`"priceType" = $${values.length + 1}::"CabinPriceType"`);
      values.push(updateData.priceType);
    }
    if (updateData.description !== undefined) {
      setClauses.push(`"description" = $${values.length + 1}`);
      values.push(updateData.description);
    }
    if (updateData.priority !== undefined) {
      setClauses.push(`"priority" = $${values.length + 1}`);
      values.push(parseInt(updateData.priority));
    }
    if (updateData.isActive !== undefined) {
      setClauses.push(`"isActive" = $${values.length + 1}`);
      values.push(updateData.isActive);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    setClauses.push(`"updatedAt" = NOW()`);
    values.push(id);

    const query = `
      UPDATE "CabinPricing" 
      SET ${setClauses.join(', ')}
      WHERE "id" = $${values.length}
      RETURNING *
    `;

    const result = await prisma.$queryRawUnsafe(query, ...values);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Precio no encontrado' });
    }

    // Redondear precio a 2 decimales para evitar errores de punto flotante
    const updatedPricing = {
      ...result[0],
      price: Math.round(result[0].price * 100) / 100
    };

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

    // Usar SQL directo para eliminar el precio
    const result = await prisma.$executeRaw`
      DELETE FROM "CabinPricing" 
      WHERE "id" = ${id}
    `;

    if (result === 0) {
      return res.status(404).json({ error: 'Precio no encontrado' });
    }

    console.log('✅ Precio eliminado correctamente');
    res.json({ message: 'Precio eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error eliminando precio:', error);
    res.status(500).json({ error: 'Error al eliminar precio' });
  }
});

router.get('/calculate', async (req, res) => {
  try {
    const { cabinId, checkIn, checkOut } = req.query;

    if (!cabinId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Parámetros requeridos: cabinId, checkIn, checkOut' });
    }

    const checkInDate = parseDate(checkIn);
    const checkOutDate = parseDate(checkOut);

    console.log(' /pricing/calculate - Fechas parseadas:', {
      checkIn: checkInDate.toISOString().split('T')[0],
      checkOut: checkOutDate.toISOString().split('T')[0]
    });

    const { totalPrice, specialPrice } = await calculateCabinPriceWithSpecial(cabinId, checkInDate, checkOutDate);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const averagePricePerNight = Math.round((totalPrice / nights) * 100) / 100;
    
    res.json({ 
      cabinId,
      checkIn,
      checkOut,
      totalPrice: totalPrice,
      pricePerNight: averagePricePerNight,
      specialPrice: specialPrice,
      nights: nights
    });
  } catch (error) {
    console.error('Error calculando precio:', error);
    res.status(500).json({ error: 'Error al calcular precio' });
  }
});

// Función auxiliar para calcular precio con precio especial
async function calculateCabinPriceWithSpecial(cabinId, checkIn, checkOut) {
  console.log('🔍 calculateCabinPriceWithSpecial - Parámetros:', { cabinId, checkIn, checkOut });
  
  const cabin = await prisma.cabin.findUnique({
    where: { id: cabinId },
    include: {
      pricing: {
        where: {
          isActive: true
        },
        orderBy: { priority: 'desc' }
      }
    }
  });

  if (!cabin) throw new Error('Cabaña no encontrada');

  console.log('🔍 Cabaña encontrada:', { id: cabin.id, name: cabin.name, basePrice: cabin.price });
  console.log('🔍 Precios especiales disponibles:', cabin.pricing.length);

  let totalPrice = 0;
  let specialPrices = []; // Guardar todos los precios especiales encontrados
  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  
  console.log('🔍 Noches a calcular:', nights);
  
  // Si no hay precios específicos, usar precio base
  if (cabin.pricing.length === 0) {
    console.log('⚠️ No hay precios especiales, usando precio base');
    const totalPrice = cabin.price * nights;
    const roundedTotalPrice = Math.round(totalPrice * 100) / 100;
    return { totalPrice: roundedTotalPrice, specialPrice: null };
  }

  // Calcular precio día por día
  for (let i = 0; i < nights; i++) {
    // Crear una nueva fecha basada en checkIn + i días (sin desfase de zona horaria)
    const currentDate = new Date(Date.UTC(
      checkIn.getUTCFullYear(),
      checkIn.getUTCMonth(),
      checkIn.getUTCDate() + i,
      0, 0, 0, 0
    ));
    
    console.log(`🔍 Día ${i + 1}: ${currentDate.toISOString().split('T')[0]}`);
    
    // Buscar precio específico para esta fecha (con mayor prioridad primero)
    // Filtrar todos los precios que coinciden con esta fecha
    const matchingPricings = cabin.pricing.filter(p => {
      const pStartDate = new Date(p.startDate);
      const pEndDate = new Date(p.endDate);
      pStartDate.setUTCHours(0, 0, 0, 0);
      pEndDate.setUTCHours(0, 0, 0, 0);
      
      console.log(`    📅 Comparando: ${currentDate.toISOString().split('T')[0]} con rango ${pStartDate.toISOString().split('T')[0]} - ${pEndDate.toISOString().split('T')[0]}`);
      
      // Rango exclusivo en el final: startDate <= currentDate < endDate
      return currentDate >= pStartDate && currentDate < pEndDate;
    });
    
    // Tomar el primero (ya está ordenado por prioridad DESC)
    const specificPricing = matchingPricings.length > 0 ? matchingPricings[0] : null;
    if (specificPricing) {
      console.log(`  ✅ Coincide con precio especial: $${specificPricing.price} (${specificPricing.priceType}, prioridad: ${specificPricing.priority})`);
    }
    
    const dayPrice = specificPricing ? specificPricing.price : cabin.price;
    console.log(`  💰 Precio del día: $${dayPrice} ${specificPricing ? '(especial)' : '(base)'}`);
    
    // Guardar todos los precios especiales encontrados (sin duplicados)
    if (specificPricing && !specialPrices.find(sp => sp.price === specificPricing.price)) {
      specialPrices.push({
        price: specificPricing.price,
        type: specificPricing.priceType,
        priority: specificPricing.priority
      });
    }
    totalPrice += dayPrice;
  }

  // Redondear precio a 2 decimales para evitar errores de punto flotante
  const roundedTotalPrice = Math.round(totalPrice * 100) / 100;
  const specialPrice = specialPrices.length > 0 ? Math.round(specialPrices[0].price * 100) / 100 : null;
  
  console.log('✅ Precio total calculado:', roundedTotalPrice, 'con', specialPrices.length, 'precios especiales encontrados');
  return { totalPrice: roundedTotalPrice, specialPrice };
}

module.exports = router;
module.exports.calculateCabinPriceWithSpecial = calculateCabinPriceWithSpecial;