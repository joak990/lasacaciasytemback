const express = require('express');
const { body, validationResult, query } = require('express-validator');
const prisma = require('../utils/prisma');

const router = express.Router();

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
    console.log('🔍 Availability check - Headers:', req.headers);
    
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

    // Obtener fecha actual sin hora (solo fecha)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validar fechas
    if (checkInDate >= checkOutDate) {
      console.log('❌ Availability check - Invalid date range');
      return res.status(400).json({ 
        error: 'La fecha de check-out debe ser posterior al check-in' 
      });
    }

    // Normalizar checkInDate para comparar solo fechas
    const checkInDateOnly = new Date(checkInDate);
    checkInDateOnly.setHours(0, 0, 0, 0);

    if (checkInDateOnly < today) {
      console.log('❌ Availability check - Check-in in past');
      console.log('🔍 Debug - Today:', today);
      console.log('🔍 Debug - CheckInDateOnly:', checkInDateOnly);
      return res.status(400).json({ 
        error: 'La fecha de check-in no puede ser en el pasado' 
      });
    }

    // Verificar si la cabaña existe
    const cabin = await prisma.cabin.findUnique({
      where: { id: cabinId }
    });

    if (!cabin) {
      console.log('❌ Availability check - Cabin not found:', cabinId);
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    console.log('🔍 Availability check - Cabin found:', cabin.name);

    // Buscar reservaciones conflictivas
    const conflictingReservation = await prisma.reservation.findFirst({
      where: {
        cabinId,
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
      },
      include: {
        cabin: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const isAvailable = !conflictingReservation;

    console.log('🔍 Availability check - Result:', { 
      isAvailable, 
      conflictingReservation: conflictingReservation ? conflictingReservation.id : null 
    });

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
      conflictingReservation: conflictingReservation ? {
        id: conflictingReservation.id,
        checkIn: conflictingReservation.checkIn,
        checkOut: conflictingReservation.checkOut,
        guestName: conflictingReservation.guestName,
        guestLastName: conflictingReservation.guestLastName
      } : null
    });

  } catch (error) {
    console.error('❌ Error checking availability:', error);
    res.status(500).json({ error: 'Error al verificar disponibilidad' });
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
            amenities: true,
            imageUrl: true
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
  (req, res, next) => {
    console.log('🔍 Middleware de validación - Datos recibidos:', req.body);
    next();
  },
  body('cabinId').notEmpty(),
  body('checkIn').isISO8601(),
  body('checkOut').isISO8601(),
  body('guestCount').isInt({ min: 1 }),
  body('guestName').notEmpty().trim(),
  body('guestLastName').notEmpty().trim(),
  body('guestPhone').notEmpty().trim(),
  body('guestEmail').optional().custom((value) => {
    if (value && value.trim() !== '') {
      // Si hay un valor, debe ser un email válido
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Email debe ser válido');
      }
    }
    return true;
  }),
  body('specialRequests').optional().trim(),
  body('paymentStatus').optional().isIn(['PENDING', 'PARTIAL', 'PAID', 'REFUNDED']),
  body('amountPaid').optional().isFloat({ min: 0 }),
  body('paymentMethod').optional().isIn(['CASH', 'CARD', 'TRANSFER', 'DEPOSIT', 'OTHER']),
  body('services').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    console.log('🔍 Backend recibiendo datos:', req.body);
    console.log('🔍 Tipos de datos recibidos:');
    console.log('  - cabinId:', typeof req.body.cabinId, req.body.cabinId);
    console.log('  - guestCount:', typeof req.body.guestCount, req.body.guestCount);
    console.log('  - amountPaid:', typeof req.body.amountPaid, req.body.amountPaid);
    console.log('  - checkIn:', typeof req.body.checkIn, req.body.checkIn);
    console.log('  - checkOut:', typeof req.body.checkOut, req.body.checkOut);
    
    const { 
      cabinId, 
      checkIn, 
      checkOut, 
      guestCount, 
      guestName,
      guestLastName,
      guestPhone,
      guestEmail,
      specialRequests,
      paymentStatus = 'PENDING',
      amountPaid = 0,
      paymentMethod,
      paymentNotes,
      services 
    } = req.body;

    // Procesar fechas de forma segura para evitar problemas de zona horaria
    const checkInDate = new Date(checkIn + 'T00:00:00');
    const checkOutDate = new Date(checkOut + 'T00:00:00');
    
    console.log('🔍 Debug - Fechas procesadas:');
    console.log('  - checkIn original:', checkIn);
    console.log('  - checkInDate procesada:', checkInDate);
    console.log('  - checkOut original:', checkOut);
    console.log('  - checkOutDate procesada:', checkOutDate);

    // Obtener fecha actual sin hora (solo fecha)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validar fechas
    if (checkInDate >= checkOutDate) {
      return res.status(400).json({ 
        error: 'La fecha de check-out debe ser posterior al check-in' 
      });
    }

    // Normalizar checkInDate para comparar solo fechas
    const checkInDateOnly = new Date(checkInDate);
    checkInDateOnly.setHours(0, 0, 0, 0);

    if (checkInDateOnly < today) {
      console.log('❌ Create reservation - Check-in in past');
      console.log('🔍 Debug - Today:', today);
      console.log('🔍 Debug - CheckInDateOnly:', checkInDateOnly);
      return res.status(400).json({ 
        error: 'La fecha de check-in no puede ser en el pasado' 
      });
    }

    // Verificar disponibilidad de la cabaña
    const conflictingReservation = await prisma.reservation.findFirst({
      where: {
        cabinId,
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

    if (conflictingReservation) {
      return res.status(400).json({ 
        error: 'La cabaña no está disponible para las fechas seleccionadas' 
      });
    }

    // Obtener información de la cabaña para calcular el precio
    const cabin = await prisma.cabin.findUnique({
      where: { id: cabinId }
    });

    if (!cabin) {
      return res.status(404).json({ error: 'Cabaña no encontrada' });
    }

    // Calcular días de estadía
    const daysDiff = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const cabinPrice = parseFloat(cabin.price) * daysDiff;

    // Calcular precio total de servicios
    let servicesPrice = 0;
    if (services && services.length > 0) {
      for (const serviceItem of services) {
        const service = await prisma.service.findUnique({
          where: { id: serviceItem.serviceId }
        });
        if (service) {
          servicesPrice += parseFloat(service.price) * serviceItem.quantity;
        }
      }
    }

    const totalPrice = cabinPrice + servicesPrice;

    // Crear la reservación
    const reservation = await prisma.reservation.create({
      data: {
        cabinId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalPrice,
        guestCount,
        guestName,
        guestLastName,
        guestPhone,
        guestEmail,
        specialRequests,
        paymentStatus,
        amountPaid,
        paymentMethod,
        paymentNotes
      },
      include: {
        cabin: {
          select: {
            id: true,
            name: true,
            price: true
          }
        }
      }
    });

    // Agregar servicios a la reservación si se proporcionaron
    if (services && services.length > 0) {
      const reservationServices = [];
      
      for (const serviceItem of services) {
        const service = await prisma.service.findUnique({
          where: { id: serviceItem.serviceId }
        });
        
        if (service) {
          reservationServices.push({
            reservationId: reservation.id,
            serviceId: serviceItem.serviceId,
            quantity: serviceItem.quantity,
            price: parseFloat(service.price) * serviceItem.quantity
          });
        }
      }

      if (reservationServices.length > 0) {
        await prisma.reservationService.createMany({
          data: reservationServices
        });
      }
    }

    // Si hay un pago inicial, crear un registro en la tabla payments
    if (amountPaid && amountPaid > 0) {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          amount: parseFloat(amountPaid),
          method: paymentMethod || 'CASH',
          note: paymentNotes || 'Pago inicial de la reserva'
        }
      });
    }

    // Obtener la reservación completa con servicios y pagos
    const completeReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
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
        },
        payments: true
      }
    });

    res.status(201).json({
      message: 'Reservación creada exitosamente',
      reservation: completeReservation
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Error al crear reservación' });
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