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

// ============================================
// ENDPOINTS PÚBLICOS DE PRE-CHECKIN (deben ir antes de /:id)
// ============================================

// GET /api/reservations/precheckin/:token - Obtener datos de reserva con token (público)
router.get('/precheckin/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('🔍 Buscando link de pre-checkin con token:', token);
    
    // Primero buscar el link sin includes para verificar que existe
    let preCheckInLink = await prisma.preCheckInLink.findUnique({
      where: { token },
    });
    
    console.log('🔍 Resultado búsqueda inicial:', preCheckInLink ? 'Encontrado' : 'No encontrado');
    
    if (!preCheckInLink) {
      console.log('❌ Link no encontrado en la base de datos para token:', token.substring(0, 20) + '...');
      return res.status(404).json({ error: 'Link no encontrado o inválido' });
    }
    
    // Ahora obtener con todos los includes
    preCheckInLink = await prisma.preCheckInLink.findUnique({
      where: { token },
      include: {
        reservation: {
          include: {
            cabin: {
              select: {
                id: true,
                name: true,
                capacity: true
              }
            },
            guests: true
          }
        }
      }
    });
    
    console.log('🔍 Resultado de búsqueda:', preCheckInLink ? 'Encontrado' : 'No encontrado');
    
    if (!preCheckInLink) {
      console.log('❌ Link no encontrado en la base de datos');
      return res.status(404).json({ error: 'Link no encontrado o inválido' });
    }
    
    console.log('🔍 Link encontrado:', {
      id: preCheckInLink.id,
      reservationId: preCheckInLink.reservationId,
      expiresAt: preCheckInLink.expiresAt,
      isUsed: preCheckInLink.isUsed,
      preCheckInCompleted: preCheckInLink.reservation.preCheckInCompleted
    });
    
    // Verificar si está expirado
    const now = new Date();
    console.log('🔍 Verificando expiración:', {
      expiresAt: preCheckInLink.expiresAt,
      now: now,
      expired: preCheckInLink.expiresAt < now
    });
    if (preCheckInLink.expiresAt < now) {
      console.log('❌ Link expirado');
      return res.status(400).json({ error: 'El link ha expirado' });
    }
    
    // Verificar si ya fue usado
    console.log('🔍 Verificando si fue usado:', preCheckInLink.isUsed);
    if (preCheckInLink.isUsed) {
      console.log('❌ Link ya fue utilizado');
      return res.status(400).json({ error: 'Este link ya fue utilizado' });
    }
    
    // Verificar si ya completó el pre-checkin
    console.log('🔍 Verificando si completó pre-checkin:', preCheckInLink.reservation.preCheckInCompleted);
    if (preCheckInLink.reservation.preCheckInCompleted) {
      console.log('❌ Pre-checkin ya completado');
      return res.status(400).json({ 
        error: 'El formulario de pre-checkin ya fue completado',
        completed: true
      });
    }
    
    console.log('✅ Link válido, devolviendo datos');
    
    res.json({
      reservation: {
        id: preCheckInLink.reservation.id,
        guestName: preCheckInLink.reservation.guestName,
        guestLastName: preCheckInLink.reservation.guestLastName,
        checkIn: preCheckInLink.reservation.checkIn,
        checkOut: preCheckInLink.reservation.checkOut,
        guestCount: preCheckInLink.reservation.guestCount,
        cabin: preCheckInLink.reservation.cabin,
        guests: preCheckInLink.reservation.guests || []
      },
      expiresAt: preCheckInLink.expiresAt
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo datos de pre-checkin:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error completo:', JSON.stringify(error, null, 2));
    res.status(500).json({ 
      error: 'Error al obtener datos de pre-checkin',
      details: error.message 
    });
  }
});

// POST /api/reservations/precheckin/:token - Enviar datos de huéspedes (público)
router.post('/precheckin/:token', [
  body('guests').isArray({ min: 1 }).withMessage('Debe haber al menos un huésped'),
  body('guests.*.name').notEmpty().trim().withMessage('Nombre del huésped es requerido'),
  body('guests.*.lastName').notEmpty().trim().withMessage('Apellido del huésped es requerido'),
  body('guests.*.dni').notEmpty().trim().withMessage('DNI del huésped es requerido'),
  body('guests.*.dateOfBirth').isISO8601().withMessage('Fecha de nacimiento debe ser válida'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { token } = req.params;
    const { guests } = req.body;
    
    const preCheckInLink = await prisma.preCheckInLink.findUnique({
      where: { token },
      include: {
        reservation: {
          include: {
            cabin: true,
            guests: true
          }
        }
      }
    });
    
    if (!preCheckInLink) {
      return res.status(404).json({ error: 'Link no encontrado o inválido' });
    }
    
    // Verificar si está expirado
    const now = new Date();
    if (preCheckInLink.expiresAt < now) {
      return res.status(400).json({ error: 'El link ha expirado' });
    }
    
    // Verificar si ya fue usado
    if (preCheckInLink.isUsed) {
      return res.status(400).json({ error: 'Este link ya fue utilizado' });
    }
    
    // Verificar si ya completó el pre-checkin
    if (preCheckInLink.reservation.preCheckInCompleted) {
      return res.status(400).json({ error: 'El formulario de pre-checkin ya fue completado' });
    }
    
    // Validar cantidad de huéspedes
    if (guests.length !== preCheckInLink.reservation.guestCount) {
      return res.status(400).json({ 
        error: `Debe proporcionar información para ${preCheckInLink.reservation.guestCount} huésped(es)` 
      });
    }
    
    // Crear huéspedes en la base de datos
    const createdGuests = await Promise.all(
      guests.map((guest, index) => 
        prisma.guest.create({
          data: {
            reservationId: preCheckInLink.reservation.id,
            name: guest.name,
            lastName: guest.lastName,
            dni: guest.dni,
            dateOfBirth: new Date(guest.dateOfBirth),
            isMainGuest: index === 0 // Marcar el primer huésped como principal
          }
        })
      )
    );
    
    // Marcar link como usado y reserva como completada
    await prisma.$transaction([
      prisma.preCheckInLink.update({
        where: { id: preCheckInLink.id },
        data: {
          isUsed: true,
          usedAt: now
        }
      }),
      prisma.reservation.update({
        where: { id: preCheckInLink.reservation.id },
        data: {
          preCheckInCompleted: true
        }
      })
    ]);
    
    res.json({
      success: true,
      message: 'Datos de huéspedes guardados exitosamente',
      guests: createdGuests
    });
    
  } catch (error) {
    console.error('Error guardando datos de pre-checkin:', error);
    res.status(500).json({ error: 'Error al guardar datos de pre-checkin' });
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
        guests: true, // Incluir huéspedes
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
  body('guestDNI').optional({ nullable: true }).trim(),
  body('guestPhone').notEmpty().trim().withMessage('Teléfono del huésped es requerido'),
  body('guestEmail').notEmpty().isEmail().withMessage('Email del huésped es requerido y debe ser válido'),
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
      guestDNI,
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

    // 🔒 VALIDACIÓN CRÍTICA: Verificar que el precio enviado coincide con el precio real
    console.log('🔒 Validando precio de la reserva...');
    console.log('🔒 Precio enviado desde frontend:', totalPrice);
    console.log('🔒 Precio real de la cabaña:', cabin.price);
    
    // Calcular el precio real basado en las noches
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const expectedTotalPrice = cabin.price * nights;
    
    console.log('🔒 Noches calculadas:', nights);
    console.log('🔒 Precio esperado:', expectedTotalPrice);
    
    // Permitir una pequeña diferencia por redondeo (máximo 5 pesos)
    const priceDifference = Math.abs(parseFloat(totalPrice) - expectedTotalPrice);
    if (priceDifference > 5) {
      console.log('❌ Precio manipulado detectado!');
      console.log('❌ Diferencia de precio:', priceDifference);
      return res.status(400).json({ 
        error: 'El precio de la reserva no coincide con el precio real de la cabaña',
        details: {
          sentPrice: parseFloat(totalPrice),
          expectedPrice: expectedTotalPrice,
          cabinPrice: cabin.price,
          nights: nights
        }
      });
    }
    
    console.log('✅ Validación de precio exitosa');

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
        guestDNI: guestDNI || null,
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
  body('guestDNI').optional({ nullable: true }).trim(),
  body('guestPhone').notEmpty().trim().withMessage('Teléfono del huésped es requerido'),
  body('guestEmail').notEmpty().isEmail().withMessage('Email del huésped es requerido y debe ser válido'),
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
      guestDNI,
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
        guestDNI: guestDNI || null,
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
          sms: false,
          guestEmail: false
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

// PUT /api/reservations/:id/status - Actualizar estado de reserva
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido. Debe ser PENDING, CONFIRMED o CANCELLED' });
    }
    
    const reservation = await prisma.reservation.update({
      where: { id },
      data: { status },
      include: {
        cabin: {
          select: {
            id: true,
            name: true,
            description: true,
            capacity: true,
            price: true,
            status: true
          }
        }
      }
    });
    
    res.json(reservation);
  } catch (error) {
    console.error('Error actualizando estado de reserva:', error);
    res.status(500).json({ error: 'Error al actualizar estado de reserva' });
  }
});

// POST /api/reservations/:id/send-confirmation - Enviar correo de confirmación
router.post('/:id/send-confirmation', async (req, res) => {
  try {
    const { id } = req.params;
    
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        cabin: {
          select: {
            id: true,
            name: true,
            description: true,
            capacity: true,
            price: true,
            status: true
          }
        }
      }
    });
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservación no encontrada' });
    }
    
    if (!reservation.guestEmail) {
      return res.status(400).json({ error: 'La reserva no tiene un correo electrónico asociado' });
    }
    
    const result = await notificationService.sendPaymentConfirmationEmail(reservation, reservation.cabin);
    
    if (result) {
      res.json({ success: true, message: 'Correo de confirmación enviado exitosamente' });
    } else {
      res.status(500).json({ error: 'Error al enviar correo de confirmación' });
    }
  } catch (error) {
    console.error('Error enviando correo de confirmación:', error);
    res.status(500).json({ error: 'Error al enviar correo de confirmación' });
  }
});

// POST /api/reservations/:id/send-cancellation - Enviar correo de cancelación
router.post('/:id/send-cancellation', async (req, res) => {
  try {
    const { id } = req.params;
    
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        cabin: {
          select: {
            id: true,
            name: true,
            description: true,
            capacity: true,
            price: true,
            status: true
          }
        }
      }
    });
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservación no encontrada' });
    }
    
    if (!reservation.guestEmail) {
      return res.status(400).json({ error: 'La reserva no tiene un correo electrónico asociado' });
    }
    
    const result = await notificationService.sendCancellationEmail(reservation, reservation.cabin);
    
    if (result) {
      res.json({ success: true, message: 'Correo de cancelación enviado exitosamente' });
    } else {
      res.status(500).json({ error: 'Error al enviar correo de cancelación' });
    }
  } catch (error) {
    console.error('Error enviando correo de cancelación:', error);
    res.status(500).json({ error: 'Error al enviar correo de cancelación' });
  }
});

// ... existing code ...
// ============================================
// ENDPOINTS DE PRE-CHECKIN
// ============================================

// POST /api/reservations/:id/generate-precheckin-link - Generar link temporal de pre-checkin
router.post('/:id/generate-precheckin-link', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔗 Generando link de pre-checkin para reservación:', id);
    
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        cabin: true,
        preCheckInLink: true
      }
    });
    
    if (!reservation) {
      console.log('❌ Reservación no encontrada:', id);
      return res.status(404).json({ error: 'Reservación no encontrada' });
    }
    
    console.log('✅ Reservación encontrada, preCheckInLink existente:', !!reservation.preCheckInLink);
    
    // Si ya existe un link, verificar si está expirado
    if (reservation.preCheckInLink) {
      const now = new Date();
      console.log('🔍 Verificando link existente:', {
        expiresAt: reservation.preCheckInLink.expiresAt,
        now: now,
        isUsed: reservation.preCheckInLink.isUsed,
        token: reservation.preCheckInLink.token.substring(0, 20) + '...'
      });
      if (reservation.preCheckInLink.expiresAt > now && !reservation.preCheckInLink.isUsed) {
        // Link válido existente
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        console.log('✅ Link existente válido, devolviendo:', `${baseUrl}/precheckin/${reservation.preCheckInLink.token.substring(0, 20)}...`);
        return res.json({
          link: `${baseUrl}/precheckin/${reservation.preCheckInLink.token}`,
          expiresAt: reservation.preCheckInLink.expiresAt,
          token: reservation.preCheckInLink.token
        });
      }
      console.log('⚠️ Link existente expirado o usado, generando nuevo');
    }
    
    // Generar nuevo token único
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    console.log('🔑 Token generado:', token.substring(0, 20) + '...');
    
    // Link expira en 7 días
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    console.log('📅 Link expira en:', expiresAt);
    
    // Crear o actualizar el link
    console.log('💾 Guardando link en base de datos...');
    const preCheckInLink = await prisma.preCheckInLink.upsert({
      where: { reservationId: id },
      update: {
        token,
        expiresAt,
        isUsed: false,
        usedAt: null
      },
      create: {
        reservationId: id,
        token,
        expiresAt
      }
    });
    
    console.log('✅ Link guardado exitosamente:', {
      id: preCheckInLink.id,
      token: preCheckInLink.token.substring(0, 20) + '...',
      expiresAt: preCheckInLink.expiresAt
    });
    
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const finalLink = `${baseUrl}/precheckin/${preCheckInLink.token}`;
    console.log('🔗 Link final generado:', finalLink);
    
    res.json({
      link: finalLink,
      expiresAt: preCheckInLink.expiresAt,
      token: preCheckInLink.token
    });
    
  } catch (error) {
    console.error('Error generando link de pre-checkin:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Error al generar link de pre-checkin',
      details: error.message 
    });
  }
});

module.exports = router;