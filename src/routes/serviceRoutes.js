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

// GET /api/services - Obtener todos los servicios
router.get('/', async (req, res) => {
  try {
    const { category, isActive } = req.query;
    
    const where = {};
    
    if (category) {
      where.category = category;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const services = await prisma.service.findMany({
      where,
      orderBy: {
        name: 'asc'
      }
    });

    res.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

// GET /api/services/:id - Obtener servicio por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        reservationServices: {
          include: {
            reservation: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    lastName: true,
                    email: true
                  }
                },
                cabin: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!service) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    res.json(service);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Error al obtener servicio' });
  }
});

// POST /api/services - Crear nuevo servicio
router.post('/', [
  body('name').notEmpty().trim(),
  body('description').optional().trim(),
  body('price').isFloat({ min: 0 }),
  body('category').isIn(['FOOD', 'BEVERAGE', 'ACTIVITY', 'TRANSPORT', 'CLEANING', 'OTHER']),
  body('isActive').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { name, description, price, category, isActive } = req.body;

    const service = await prisma.service.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        category,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({
      message: 'Servicio creado exitosamente',
      service
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
});

// PUT /api/services/:id - Actualizar servicio
router.put('/:id', [
  body('name').optional().notEmpty().trim(),
  body('description').optional().trim(),
  body('price').optional().isFloat({ min: 0 }),
  body('category').optional().isIn(['FOOD', 'BEVERAGE', 'ACTIVITY', 'TRANSPORT', 'CLEANING', 'OTHER']),
  body('isActive').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price) updateData.price = parseFloat(price);
    if (category) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedService = await prisma.service.update({
      where: { id },
      data: updateData
    });

    res.json({
      message: 'Servicio actualizado exitosamente',
      service: updatedService
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
});

// DELETE /api/services/:id - Eliminar servicio
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el servicio está siendo usado en reservaciones
    const serviceInUse = await prisma.reservationService.findFirst({
      where: { serviceId: id }
    });

    if (serviceInUse) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el servicio porque está siendo usado en reservaciones' 
      });
    }

    await prisma.service.delete({
      where: { id }
    });

    res.json({
      message: 'Servicio eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
});

// GET /api/services/categories - Obtener categorías de servicios
router.get('/categories/list', async (req, res) => {
  try {
    const categories = [
      { value: 'FOOD', label: 'Comida' },
      { value: 'BEVERAGE', label: 'Bebidas' },
      { value: 'ACTIVITY', label: 'Actividades' },
      { value: 'TRANSPORT', label: 'Transporte' },
      { value: 'CLEANING', label: 'Limpieza' },
      { value: 'OTHER', label: 'Otros' }
    ];

    res.json(categories);
  } catch (error) {
    console.error('Error fetching service categories:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// GET /api/services/stats - Estadísticas de servicios
router.get('/stats/usage', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {};
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const serviceStats = await prisma.reservationService.groupBy({
      by: ['serviceId'],
      where,
      _sum: {
        quantity: true,
        price: true
      },
      _count: {
        id: true
      }
    });

    const serviceDetails = await Promise.all(
      serviceStats.map(async (stat) => {
        const service = await prisma.service.findUnique({
          where: { id: stat.serviceId },
          select: { name: true, category: true }
        });

        return {
          serviceId: stat.serviceId,
          serviceName: service?.name || 'Servicio eliminado',
          category: service?.category,
          totalQuantity: stat._sum.quantity || 0,
          totalRevenue: stat._sum.price || 0,
          usageCount: stat._count.id
        };
      })
    );

    res.json(serviceDetails);
  } catch (error) {
    console.error('Error fetching service stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de servicios' });
  }
});

module.exports = router; 