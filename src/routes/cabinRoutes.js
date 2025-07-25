const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');

const router = express.Router();

// Middleware para validar errores
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/cabins - Obtener todas las cabañas
router.get('/', async (req, res) => {
  try {
    const { status, minPrice, maxPrice, capacity } = req.query;
    
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    
    if (capacity) {
      where.capacity = {
        gte: parseInt(capacity)
      };
    }

    const cabins = await prisma.cabin.findMany({
      where,
      include: {
        reservations: {
          where: {
            status: {
              in: ['PENDING', 'CONFIRMED']
            }
          },
          select: {
            checkIn: true,
            checkOut: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(cabins);
  } catch (error) {
    console.error('Error fetching cabins:', error);
    res.status(500).json({ error: 'Error al obtener cabañas' });
  }
});

// GET /api/cabins/:id - Obtener cabaña por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const cabin = await prisma.cabin.findUnique({
      where: { id },
      include: {
        reservations: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastName: true,
                email: true
              }
            },
            reservationServices: {
              include: {
                service: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!cabin) {
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    res.json(cabin);
  } catch (error) {
    console.error('Error fetching cabin:', error);
    res.status(500).json({ error: 'Error al obtener cabaña' });
  }
});

// POST /api/cabins - Crear nueva cabaña (solo admin)
router.post('/', [
  body('name').notEmpty().trim(),
  body('description').optional().trim(),
  body('capacity').isInt({ min: 1 }),
  body('price').isFloat({ min: 0 }),
  body('status').optional().isIn(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED']),
  body('amenities').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { name, description, capacity, price, status, amenities, imageUrl } = req.body;

    const cabin = await prisma.cabin.create({
      data: {
        name,
        description,
        capacity: parseInt(capacity),
        price: parseFloat(price),
        status: status || 'AVAILABLE',
        amenities: amenities || [],
        imageUrl
      }
    });

    res.status(201).json({
      message: 'Cabaña creada exitosamente',
      cabin
    });
  } catch (error) {
    console.error('Error creating cabin:', error);
    res.status(500).json({ error: 'Error al crear cabaña' });
  }
});

// PUT /api/cabins/:id - Actualizar cabaña
router.put('/:id', [
  body('name').optional().notEmpty().trim(),
  body('description').optional().trim(),
  body('capacity').optional().isInt({ min: 1 }),
  body('price').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED']),
  body('amenities').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, capacity, price, status, amenities, imageUrl } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (capacity) updateData.capacity = parseInt(capacity);
    if (price) updateData.price = parseFloat(price);
    if (status) updateData.status = status;
    if (amenities) updateData.amenities = amenities;
    if (imageUrl) updateData.imageUrl = imageUrl;

    const updatedCabin = await prisma.cabin.update({
      where: { id },
      data: updateData
    });

    res.json({
      message: 'Cabaña actualizada exitosamente',
      cabin: updatedCabin
    });
  } catch (error) {
    console.error('Error updating cabin:', error);
    res.status(500).json({ error: 'Error al actualizar cabaña' });
  }
});

// DELETE /api/cabins/:id - Eliminar cabaña
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la cabaña tiene reservaciones activas
    const activeReservations = await prisma.reservation.findFirst({
      where: {
        cabinId: id,
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      }
    });

    if (activeReservations) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la cabaña porque tiene reservaciones activas' 
      });
    }

    await prisma.cabin.delete({
      where: { id }
    });

    res.json({
      message: 'Cabaña eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error deleting cabin:', error);
    res.status(500).json({ error: 'Error al eliminar cabaña' });
  }
});

// GET /api/cabins/:id/availability - Verificar disponibilidad de cabaña
router.get('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({ 
        error: 'Se requieren fechas de check-in y check-out' 
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Verificar si hay reservaciones que se superponen
    const conflictingReservations = await prisma.reservation.findFirst({
      where: {
        cabinId: id,
        status: {
          in: ['PENDING', 'CONFIRMED']
        },
        OR: [
          {
            AND: [
              { checkIn: { lte: checkInDate } },
              { checkOut: { gt: checkInDate } }
            ]
          },
          {
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gte: checkOutDate } }
            ]
          },
          {
            AND: [
              { checkIn: { gte: checkInDate } },
              { checkOut: { lte: checkOutDate } }
            ]
          }
        ]
      }
    });

    const isAvailable = !conflictingReservations;

    res.json({
      cabinId: id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      isAvailable,
      conflictingReservations: conflictingReservations ? [conflictingReservations] : []
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Error al verificar disponibilidad' });
  }
});

module.exports = router; 