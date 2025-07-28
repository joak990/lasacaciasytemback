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
    // Consulta simple sin includes ni filtros para diagnosticar
    const cabins = await prisma.cabin.findMany({
      select: {
        id: true,
        name: true,
        capacity: true,
        price: true,
        status: true,
        createdAt: true
      }
    });

    console.log('✅ Cabins found:', cabins.length);
    res.json(cabins);
  } catch (error) {
    console.error('❌ Error fetching cabins:', error);
    res.status(500).json({ 
      error: 'Error al obtener cabañas', 
      details: error.message 
    });
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

// POST /api/cabins/:id/images - Agregar imágenes a una cabaña
router.post('/:id/images', [
  body('images').isArray().withMessage('Images debe ser un array'),
  body('images.*').isURL().withMessage('Cada imagen debe ser una URL válida'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { images } = req.body;

    const cabin = await prisma.cabin.findUnique({
      where: { id }
    });

    if (!cabin) {
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    // Agregar nuevas imágenes al array existente
    const updatedCabin = await prisma.cabin.update({
      where: { id },
      data: {
        images: {
          push: images
        }
      }
    });

    res.json({
      message: 'Imágenes agregadas exitosamente',
      cabin: updatedCabin
    });
  } catch (error) {
    console.error('Error adding images:', error);
    res.status(500).json({ error: 'Error al agregar imágenes' });
  }
});

// GET /api/cabins/:id/images - Obtener imágenes de una cabaña
router.get('/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    
    const cabin = await prisma.cabin.findUnique({
      where: { id },
      select: { images: true }
    });

    if (!cabin) {
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    res.json({ images: cabin.images });
  } catch (error) {
    console.error('Error getting images:', error);
    res.status(500).json({ error: 'Error al obtener imágenes' });
  }
});

// DELETE /api/cabins/:id/images/:imageIndex - Eliminar imagen específica
router.delete('/:id/images/:imageIndex', async (req, res) => {
  try {
    const { id, imageIndex } = req.params;
    const index = parseInt(imageIndex);

    const cabin = await prisma.cabin.findUnique({
      where: { id }
    });

    if (!cabin) {
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    if (index < 0 || index >= cabin.images.length) {
      return res.status(400).json({ error: 'Índice de imagen inválido' });
    }

    // Remover la imagen del array
    const updatedImages = cabin.images.filter((_, i) => i !== index);
    
    const updatedCabin = await prisma.cabin.update({
      where: { id },
      data: { images: updatedImages }
    });

    res.json({
      message: 'Imagen eliminada exitosamente',
      cabin: updatedCabin
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
});

// PUT /api/cabins/:id/images - Reemplazar todas las imágenes
router.put('/:id/images', [
  body('images').isArray().withMessage('Images debe ser un array'),
  body('images.*').isURL().withMessage('Cada imagen debe ser una URL válida'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { images } = req.body;

    const cabin = await prisma.cabin.findUnique({
      where: { id }
    });

    if (!cabin) {
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    const updatedCabin = await prisma.cabin.update({
      where: { id },
      data: { images }
    });

    res.json({
      message: 'Imágenes actualizadas exitosamente',
      cabin: updatedCabin
    });
  } catch (error) {
    console.error('Error updating images:', error);
    res.status(500).json({ error: 'Error al actualizar imágenes' });
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
  body('images').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { name, description, capacity, price, status, amenities, images } = req.body;

    const cabin = await prisma.cabin.create({
      data: {
        name,
        description,
        capacity: parseInt(capacity),
        price: parseFloat(price),
        status: status || 'AVAILABLE',
        amenities: amenities || [],
        images: images || []
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
  body('images').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, capacity, price, status, amenities, images } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (capacity) updateData.capacity = parseInt(capacity);
    if (price) updateData.price = parseFloat(price);
    if (status) updateData.status = status;
    if (amenities) updateData.amenities = amenities;
    if (images) updateData.images = images;

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