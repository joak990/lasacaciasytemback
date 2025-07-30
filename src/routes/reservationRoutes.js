const express = require('express');
const { body, validationResult, query } = require('express-validator');
const prisma = require('../utils/prisma');
const notificationService = require('../services/notificationService');

const router = express.Router();

// GET /api/reservations/test - Endpoint de prueba
router.get('/test', (req, res) => {
  console.log('🧪 Test endpoint called');
  res.json({ 
    message: 'Reservation API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Middleware para validar errores
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/reservations/availability - Verificar disponibilidad de cabaña
router.get('/availability', [
  query('cabinId').notEmpty().withMessage('ID de cabaña es requerido'),
  query('checkIn').isISO8601().withMessage('Fecha de check-in debe ser válida'),
  query('checkOut').isISO8601().withMessage('Fecha de check-out debe ser válida'),
  handleValidationErrors
], async (req, res) => {
  try {
    console.log('🔍 Availability check - Query params:', req.query);
    
    const { cabinId, checkIn, checkOut } = req.query;
    
    console.log('🔍 Availability check - Extracted params:', { cabinId, checkIn, checkOut });
    
    if (!cabinId || !checkIn || !checkOut) {
      console.log('❌ Availability check - Missing required params');
      return res.status(400).json({ 
        error: 'Se requieren cabinId, checkIn y checkOut' 
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    console.log('🔍 Availability check - Parsed dates:', { checkInDate, checkOutDate });

    // Verificar si la cabaña existe (consulta simple)
    const cabin = await prisma.cabin.findUnique({
      where: { id: cabinId },
      select: {
        id: true,
        name: true,
        capacity: true,
        price: true
      }
    });

    if (!cabin) {
      console.log('❌ Availability check - Cabin not found:', cabinId);
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    console.log('✅ Availability check - Cabin found:', cabin.name);

    // Consulta simple de reservaciones para diagnosticar
    const reservations = await prisma.reservation.findMany({
      where: {
        cabinId: cabinId
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        status: true
      }
    });

    console.log('✅ Availability check - Reservations found:', reservations.length);

    // Por ahora, asumir que está disponible
    const isAvailable = true;

    res.json({
      available: isAvailable,
      cabin: {
        id: cabin.id,
        name: cabin.name,
        capacity: cabin.capacity,
        price: cabin.price
      },
      requestedDates: {
        checkIn: checkInDate,
        checkOut: checkOutDate
      },
      conflictingReservation: null,
      debug: {
        reservationsFound: reservations.length,
        cabinId: cabinId
      }
    });

  } catch (error) {
    console.error('❌ Error checking availability:', error);
    res.status(500).json({ 
      error: 'Error al verificar disponibilidad',
      details: error.message 
    });
  }
});

// GET /api/reservations - Obtener todas las reservaciones
router.get('/', async (req, res) => {
  try {
    const { status, userId, cabinId, startDate, endDate } = req.query;
    
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    // Removed userId filter since we no longer have users
    
    if (cabinId) {
      where.cabinId = cabinId;
    }
    
    if (startDate && endDate) {
      where.OR = [
        {
          checkIn: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        {
          checkOut: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        {
          AND: [
            { checkIn: { lte: new Date(startDate) } },
            { checkOut: { gte: new Date(endDate) } }
          ]
        }
      ];
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        cabin: {
          select: {
            id: true,
            name: true,
            capacity: true,
            price: true
          }
        },
        reservationServices: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                price: true,
                category: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Error al obtener reservaciones' });
  }
});

// GET /api/reservations/:id - Obtener reservación por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        payments: true,
        cabin: {
          select: {
            id: true,
            name: true,
            description: true,
            capacity: true,
            price: true,
            status: true
          }
        },
        reservationServices: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                category: true
              }
            }
          }
        }
      }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservación no encontrada' });
    }

    res.json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ error: 'Error al obtener reservación' });
  }
});

// POST /api/reservations - Crear nueva reservación
router.post('/', [
  body('cabinId').notEmpty().withMessage('ID de cabaña es requerido'),
  body('checkIn').isISO8601().withMessage('Fecha de check-in debe ser válida'),
  body('checkOut').isISO8601().withMessage('Fecha de check-out debe ser válida'),
  body('totalPrice').isFloat({ min: 0 }).withMessage('Precio total debe ser un número válido'),
  body('guestCount').isInt({ min: 1 }).withMessage('Número de huéspedes debe ser un entero válido'),
  body('guestName').notEmpty().trim().withMessage('Nombre del huésped es requerido'),
  body('guestLastName').notEmpty().trim().withMessage('Apellido del huésped es requerido'),
  body('guestPhone').notEmpty().trim().withMessage('Teléfono del huésped es requerido'),
  body('guestEmail').optional().isEmail().withMessage('Email debe ser válido'),
  body('amountPaid').optional().isFloat({ min: 0 }).withMessage('Monto pagado debe ser un número válido'),
  body('paymentMethod').optional().isIn(['CASH', 'CARD', 'TRANSFER', 'DEPOSIT', 'OTHER']).withMessage('Método de pago inválido'),
  handleValidationErrors
], async (req, res) => {
  try {
    console.log('🔍 Iniciando creación de reservación...');
    
    const {
      cabinId,
      checkIn,
      checkOut,
      totalPrice,
      guestCount,
      guestName,
      guestLastName,
      guestPhone,
      guestEmail,
      amountPaid = 0,
      paymentMethod = 'TRANSFER'
    } = req.body;

    console.log('🔍 Datos parseados:', {
      cabinId,
      checkIn,
      checkOut,
      totalPrice,
      guestCount,
      guestName,
      guestLastName,
      guestPhone,
      guestEmail,
      amountPaid,
      paymentMethod
    });

    // Validar datos requeridos
    if (!cabinId || !checkIn || !checkOut || !guestName || !guestLastName || !guestPhone) {
      console.log('❌ Datos requeridos faltantes');
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    console.log('✅ Validación de datos requeridos pasada');

    // Parsear fechas
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    console.log('🔍 Fechas parseadas:', {
      checkInDate: checkInDate.toISOString(),
      checkOutDate: checkOutDate.toISOString()
    });

    // Validar fechas
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      console.log('❌ Fechas inválidas');
      return res.status(400).json({ error: 'Fechas inválidas' });
    }

    if (checkInDate >= checkOutDate) {
      console.log('❌ Fecha de salida debe ser posterior a la de llegada');
      return res.status(400).json({ error: 'Fecha de salida debe ser posterior a la de llegada' });
    }

    console.log('✅ Validación de fechas pasada');

    // Verificar disponibilidad
    console.log('🔍 Verificando disponibilidad...');
    console.log('🔍 Buscando conflictos para:', {
      cabinId,
      checkInDate: checkInDate.toISOString(),
      checkOutDate: checkOutDate.toISOString()
    });

    // Buscar reservaciones que se superpongan con las fechas solicitadas
    const conflictingReservation = await prisma.reservation.findFirst({
      where: {
        cabinId,
        status: {
          in: ['PENDING', 'CONFIRMED']
        },
        OR: [
          // Caso 1: La reservación existente empieza antes y termina después del check-in solicitado
          {
            checkIn: { lte: checkInDate },
            checkOut: { gt: checkInDate }
          },
          // Caso 2: La reservación existente empieza antes del check-out solicitado y termina después
          {
            checkIn: { lt: checkOutDate },
            checkOut: { gte: checkOutDate }
          },
          // Caso 3: La reservación existente está completamente contenida en las fechas solicitadas
          {
            checkIn: { gte: checkInDate },
            checkOut: { lte: checkOutDate }
          }
        ]
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        guestName: true,
        guestLastName: true,
        status: true
      }
    });

    if (conflictingReservation) {
      console.log('❌ Conflicto de disponibilidad encontrado:', {
        conflictingId: conflictingReservation.id,
        conflictingCheckIn: conflictingReservation.checkIn,
        conflictingCheckOut: conflictingReservation.checkOut,
        conflictingGuest: `${conflictingReservation.guestName} ${conflictingReservation.guestLastName}`,
        conflictingStatus: conflictingReservation.status
      });
      return res.status(400).json({ 
        error: 'La cabaña no está disponible para las fechas seleccionadas',
        conflictingReservation
      });
    }

    console.log('✅ Verificación de disponibilidad pasada - No hay conflictos');

    // Verificar que la cabaña existe
    console.log('🔍 Verificando que la cabaña existe...');
    const cabin = await prisma.cabin.findUnique({
      where: { id: cabinId },
      select: {
        id: true,
        name: true,
        capacity: true,
        price: true,
        status: true
      }
    });

    console.log('🔍 Cabaña encontrada:', cabin ? cabin.name : 'NO ENCONTRADA');

    if (!cabin) {
      console.log('❌ Cabaña no encontrada');
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    console.log('✅ Cabaña verificada');

    // Crear la reservación
    console.log('🔍 Intentando crear la reservación en la base de datos...');
    const reservation = await prisma.reservation.create({
      data: {
        cabinId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalPrice: parseFloat(totalPrice),
        guestCount: guestCount,
        guestName,
        guestLastName,
        guestEmail: guestEmail || '',
        guestPhone,
        paymentStatus: 'PENDING',
        amountPaid: parseFloat(amountPaid),
        paymentMethod,
        status: 'PENDING'
      },
      include: {
        cabin: {
          select: {
            id: true,
            name: true,
            capacity: true,
            price: true
          }
        }
      }
    });

    console.log('✅ Reservación creada exitosamente:', reservation.id);

    // Enviar notificaciones por email y SMS
    try {
      console.log('🔔 Enviando notificaciones...');
      const notificationResult = await notificationService.notifyNewPlatformReservation(reservation, reservation.cabin);
      console.log('✅ Notificaciones enviadas:', notificationResult);
    } catch (notificationError) {
      console.error('❌ Error enviando notificaciones:', notificationError);
      // No fallar la creación de la reserva si fallan las notificaciones
    }

    res.status(201).json({
      message: 'Reservación creada exitosamente',
      reservation
    });

  } catch (error) {
    console.error('❌ Error creating reservation:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Error al crear la reservación' });
  }
});

// POST /api/reservations/platform - Crear reservación desde plataforma web
router.post('/platform', [
  body('cabinId').notEmpty().withMessage('ID de cabaña es requerido'),
  body('checkIn').isISO8601().withMessage('Fecha de check-in debe ser válida'),
  body('checkOut').isISO8601().withMessage('Fecha de check-out debe ser válida'),
  body('totalPrice').isFloat({ min: 0 }).withMessage('Precio total debe ser un número válido'),
  body('guestCount').isInt({ min: 1 }).withMessage('Número de huéspedes debe ser un entero válido'),
  body('guestName').notEmpty().trim().withMessage('Nombre del huésped es requerido'),
  body('guestLastName').notEmpty().trim().withMessage('Apellido del huésped es requerido'),
  body('guestPhone').notEmpty().trim().withMessage('Teléfono del huésped es requerido'),
  body('guestEmail').optional().isEmail().withMessage('Email debe ser válido'),
  handleValidationErrors
], async (req, res) => {
  try {
    console.log('🔍 Iniciando creación de reservación desde plataforma web...');
    console.log('🔍 Request body:', req.body);
    console.log('🔍 Environment:', process.env.NODE_ENV);
    
    const {
      cabinId,
      checkIn,
      checkOut,
      totalPrice,
      guestCount,
      guestName,
      guestLastName,
      guestPhone,
      guestEmail
    } = req.body;

    console.log('🔍 Datos de reserva desde plataforma:', {
      cabinId,
      checkIn,
      checkOut,
      totalPrice,
      guestCount,
      guestName,
      guestLastName,
      guestPhone,
      guestEmail
    });

    // Validar datos requeridos
    if (!cabinId || !checkIn || !checkOut || !guestName || !guestLastName || !guestPhone) {
      console.log('❌ Datos requeridos faltantes');
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Parsear fechas
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validar fechas
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      console.log('❌ Fechas inválidas');
      return res.status(400).json({ error: 'Fechas inválidas' });
    }

    if (checkInDate >= checkOutDate) {
      console.log('❌ Fecha de salida debe ser posterior a la de llegada');
      return res.status(400).json({ error: 'Fecha de salida debe ser posterior a la de llegada' });
    }

    // Verificar disponibilidad
    console.log('🔍 Verificando disponibilidad...');
    const conflictingReservation = await prisma.reservation.findFirst({
      where: {
        cabinId,
        status: {
          in: ['PENDING', 'CONFIRMED']
        },
        OR: [
          {
            checkIn: { lte: checkInDate },
            checkOut: { gt: checkInDate }
          },
          {
            checkIn: { lt: checkOutDate },
            checkOut: { gte: checkOutDate }
          },
          {
            checkIn: { gte: checkInDate },
            checkOut: { lte: checkOutDate }
          }
        ]
      }
    });

    if (conflictingReservation) {
      console.log('❌ Conflicto de disponibilidad encontrado');
      return res.status(400).json({ 
        error: 'La cabaña no está disponible para las fechas seleccionadas',
        conflictingReservation
      });
    }

    // Verificar que la cabaña existe
    const cabin = await prisma.cabin.findUnique({
      where: { id: cabinId },
      select: {
        id: true,
        name: true,
        capacity: true,
        price: true,
        status: true
      }
    });

    if (!cabin) {
      console.log('❌ Cabaña no encontrada');
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    // Crear la reservación
    console.log('🔍 Creando reservación...');
    const reservation = await prisma.reservation.create({
      data: {
        cabinId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalPrice: parseFloat(totalPrice),
        guestCount: guestCount,
        guestName,
        guestLastName,
        guestEmail: guestEmail || '',
        guestPhone,
        paymentStatus: 'PENDING',
        amountPaid: 0,
        paymentMethod: 'TRANSFER',
        status: 'PENDING'
        // channel: 'PLATFORM' // Comentado temporalmente hasta que se haga la migración
      },
      include: {
        cabin: {
          select: {
            id: true,
            name: true,
            capacity: true,
            price: true
          }
        }
      }
    });

    console.log('✅ Reservación creada exitosamente:', reservation.id);

    // Enviar notificaciones por email y SMS
    try {
      console.log('🔔 Enviando notificaciones...');
      const notificationResult = await notificationService.notifyNewPlatformReservation(reservation, reservation.cabin);
      console.log('✅ Notificaciones enviadas:', notificationResult);
      
      res.status(201).json({
        message: 'Reservación creada exitosamente desde la plataforma web',
        reservation,
        notifications: notificationResult
      });
      
    } catch (notificationError) {
      console.error('❌ Error enviando notificaciones:', notificationError);
      // No fallar la creación de la reserva si fallan las notificaciones
      res.status(201).json({
        message: 'Reservación creada exitosamente desde la plataforma web (notificaciones fallaron)',
        reservation,
        notifications: {
          email: false,
          sms: false
        },
        notificationError: notificationError.message
      });
    }

  } catch (error) {
    console.error('❌ Error creating platform reservation:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    res.status(500).json({ error: 'Error al crear la reservación' });
  }
});

// PUT /api/reservations/:id - Actualizar reservación
router.put('/:id', [
  body('status').optional().isIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']),
  body('specialRequests').optional().trim(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { status, specialRequests } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (specialRequests !== undefined) updateData.specialRequests = specialRequests;

    const updatedReservation = await prisma.reservation.update({
      where: { id },
      data: updateData,
      include: {
        cabin: {
          select: {
            id: true,
            name: true,
            price: true
          }
        },
        reservationServices: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                price: true,
                category: true
              }
            }
          }
        }
      }
    });

    res.json({
      message: 'Reservación actualizada exitosamente',
      reservation: updatedReservation
    });
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ error: 'Error al actualizar reservación' });
  }
});

// POST /api/reservations/:id/services - Agregar servicios a una reservación
router.post('/:id/services', [
  body('services').isArray(),
  body('services.*.serviceId').notEmpty(),
  body('services.*.quantity').isInt({ min: 1 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { services } = req.body;

    // Verificar que la reservación existe
    const reservation = await prisma.reservation.findUnique({
      where: { id }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservación no encontrada' });
    }

    // Verificar que la reservación no esté completada o cancelada
    if (reservation.status === 'COMPLETED' || reservation.status === 'CANCELLED') {
      return res.status(400).json({ 
        error: 'No se pueden agregar servicios a una reservación completada o cancelada' 
      });
    }

    const reservationServices = [];
    let totalServicesPrice = 0;

    for (const serviceItem of services) {
      const service = await prisma.service.findUnique({
        where: { id: serviceItem.serviceId }
      });

      if (!service) {
        return res.status(404).json({ 
          error: `Servicio con ID ${serviceItem.serviceId} no encontrado` 
        });
      }

      if (!service.isActive) {
        return res.status(400).json({ 
          error: `El servicio ${service.name} no está disponible` 
        });
      }

      const servicePrice = parseFloat(service.price) * serviceItem.quantity;
      totalServicesPrice += servicePrice;

      reservationServices.push({
        reservationId: id,
        serviceId: serviceItem.serviceId,
        quantity: serviceItem.quantity,
        price: servicePrice
      });
    }

    // Crear los servicios de reservación
    await prisma.reservationService.createMany({
      data: reservationServices
    });

    // Actualizar el precio total de la reservación
    await prisma.reservation.update({
      where: { id },
      data: {
        totalPrice: {
          increment: totalServicesPrice
        }
      }
    });

    // Obtener la reservación actualizada
    const updatedReservation = await prisma.reservation.findUnique({
      where: { id },
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
            name: true,
            price: true
          }
        },
        reservationServices: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                price: true,
                category: true
              }
            }
          }
        }
      }
    });

    res.json({
      message: 'Servicios agregados exitosamente',
      reservation: updatedReservation
    });
  } catch (error) {
    console.error('Error adding services to reservation:', error);
    res.status(500).json({ error: 'Error al agregar servicios a la reservación' });
  }
});

// DELETE /api/reservations/:id - Eliminar reservación
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservación no encontrada' });
    }

    // Eliminar pagos asociados primero (por las foreign keys)
    await prisma.payment.deleteMany({
      where: { reservationId: id }
    });

    // Eliminar servicios de reservación
    await prisma.reservationService.deleteMany({
      where: { reservationId: id }
    });

    // Eliminar la reservación
    await prisma.reservation.delete({
      where: { id }
    });

    res.json({
      message: 'Reservación eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ error: 'Error al eliminar reservación' });
  }
});

// GET /api/reservations/stats - Estadísticas de reservaciones
router.get('/stats/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {};
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      totalReservations,
      confirmedReservations,
      cancelledReservations,
      totalRevenue,
      averageReservationValue
    ] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.count({ 
        where: { ...where, status: 'CONFIRMED' } 
      }),
      prisma.reservation.count({ 
        where: { ...where, status: 'CANCELLED' } 
      }),
      prisma.reservation.aggregate({
        where: { ...where, status: 'CONFIRMED' },
        _sum: { totalPrice: true }
      }),
      prisma.reservation.aggregate({
        where: { ...where, status: 'CONFIRMED' },
        _avg: { totalPrice: true }
      })
    ]);

    res.json({
      totalReservations,
      confirmedReservations,
      cancelledReservations,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
      averageReservationValue: averageReservationValue._avg.totalPrice || 0,
      confirmationRate: totalReservations > 0 ? (confirmedReservations / totalReservations) * 100 : 0,
      cancellationRate: totalReservations > 0 ? (cancelledReservations / totalReservations) * 100 : 0
    });
  } catch (error) {
    console.error('Error fetching reservation stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de reservaciones' });
  }
});

// PATCH /api/reservations/:id/checkin - Marcar check-in
router.patch('/:id/checkin', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.reservation.update({
      where: { id },
      data: { checkInDone: true },
      include: {
        cabin: { select: { id: true, name: true, price: true } },
        reservationServices: {
          include: { service: { select: { id: true, name: true, price: true, category: true } } }
        }
      }
    });
    res.json({ message: 'Check-in realizado', reservation: updated });
  } catch (error) {
    console.error('Error en check-in:', error);
    res.status(500).json({ error: 'Error al realizar check-in' });
  }
});

// PATCH /api/reservations/:id/checkout - Marcar check-out
router.patch('/:id/checkout', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.reservation.update({
      where: { id },
      data: { checkOutDone: true },
      include: {
        cabin: { select: { id: true, name: true, price: true } },
        reservationServices: {
          include: { service: { select: { id: true, name: true, price: true, category: true } } }
        }
      }
    });
    res.json({ message: 'Check-out realizado', reservation: updated });
  } catch (error) {
    console.error('Error en check-out:', error);
    res.status(500).json({ error: 'Error al realizar check-out' });
  }
});

// POST /api/reservations/:id/payments - Añadir pago a una reserva
router.post('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method, note } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    // Verificar que la reserva existe
    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation) {
      return res.status(404).json({ error: 'Reservación no encontrada' });
    }
    // Crear el pago
    const payment = await prisma.payment.create({
      data: {
        reservationId: id,
        amount: parseFloat(amount),
        method: method || 'Otro',
        note: note || ''
      }
    });
    // Actualizar el amountPaid y paymentStatus en la reserva
    const allPayments = await prisma.payment.findMany({ where: { reservationId: id } });
    const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
    let paymentStatus = 'PENDING';
    if (totalPaid >= reservation.totalPrice) paymentStatus = 'PAID';
    else if (totalPaid > 0) paymentStatus = 'PARTIAL';
    await prisma.reservation.update({
      where: { id },
      data: { amountPaid: totalPaid, paymentStatus }
    });
    // Traer la reserva actualizada con pagos
    const updatedReservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        payments: true,
        cabin: { select: { id: true, name: true, price: true } },
        reservationServices: {
          include: { service: { select: { id: true, name: true, price: true, category: true } } }
        }
      }
    });
    res.status(201).json({ message: 'Pago registrado', payment, reservation: updatedReservation });
  } catch (error) {
    console.error('Error añadiendo pago:', error);
    res.status(500).json({ error: 'Error al añadir pago' });
  }
});

module.exports = router; 