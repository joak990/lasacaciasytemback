const express = require('express');
const notificationService = require('../services/notificationService');
const prisma = require('../utils/prisma');

const router = express.Router();

// Mock data para testing
const mockReservation = {
  id: 'test-reservation-123',
  guestName: 'Juan',
  guestLastName: 'Pérez',
  guestEmail: 'joakhaidar@gmail.com',
  guestPhone: '+54 9 11 1234-5678',
  checkIn: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 días desde ahora
  checkOut: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 días desde ahora
  guestCount: 2,
  totalPrice: 150000,
  status: 'PENDING',
  isBreakfast: true
};

const mockCabin = {
  id: 'cabin-123',
  name: 'Cabaña Turquesa',
  capacity: 4,
  price: 60000
};

// GET /api/test-emails - Listar todos los tests disponibles
router.get('/', (req, res) => {
  res.json({
    message: 'Endpoints de prueba de emails disponibles',
    endpoints: [
      {
        method: 'GET',
        path: '/api/test-emails/guest-confirmation',
        description: 'Envía email de pre-reserva al usuario'
      },
      {
        method: 'GET',
        path: '/api/test-emails/reminder',
        description: 'Envía email de recordatorio urgente al usuario (40 min)'
      },
      {
        method: 'GET',
        path: '/api/test-emails/admin-reminder',
        description: 'Envía email de recordatorio al admin (45 min)'
      },
      {
        method: 'GET',
        path: '/api/test-emails/guest-cancellation',
        description: 'Envía email de cancelación al usuario'
      },
      {
        method: 'GET',
        path: '/api/test-emails/admin-cancellation',
        description: 'Envía email de cancelación al admin'
      },
      {
        method: 'GET',
        path: '/api/test-emails/payment-confirmation',
        description: 'Envía email de confirmación de pago al usuario'
      },
      {
        method: 'GET',
        path: '/api/test-emails/send-all',
        description: 'Envía TODOS los emails de prueba'
      }
    ],
    mockData: {
      reservation: mockReservation,
      cabin: mockCabin
    }
  });
});

// GET /api/test-emails/guest-confirmation - Email de pre-reserva
router.get('/guest-confirmation', async (req, res) => {
  try {
    console.log('📧 Enviando email de pre-reserva de prueba...');
    const result = await notificationService.sendGuestConfirmationEmail(mockReservation, mockCabin);
    
    res.json({
      success: true,
      message: '✅ Email de pre-reserva enviado exitosamente',
      type: 'guest-confirmation',
      recipient: mockReservation.guestEmail,
      mockData: { reservation: mockReservation, cabin: mockCabin }
    });
  } catch (error) {
    console.error('❌ Error enviando email de pre-reserva:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error enviando email de pre-reserva',
      error: error.message
    });
  }
});

// GET /api/test-emails/reminder - Email de recordatorio urgente
router.get('/reminder', async (req, res) => {
  try {
    console.log('📧 Enviando email de recordatorio urgente de prueba...');
    const result = await notificationService.sendReminderEmail(mockReservation, mockCabin);
    
    res.json({
      success: true,
      message: '✅ Email de recordatorio urgente enviado exitosamente',
      type: 'reminder',
      recipient: mockReservation.guestEmail,
      mockData: { reservation: mockReservation, cabin: mockCabin }
    });
  } catch (error) {
    console.error('❌ Error enviando email de recordatorio:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error enviando email de recordatorio',
      error: error.message
    });
  }
});

// GET /api/test-emails/admin-reminder - Email de recordatorio al admin
router.get('/admin-reminder', async (req, res) => {
  try {
    console.log('📧 Enviando email de recordatorio al admin de prueba...');
    const result = await notificationService.sendAdminReminderEmail(mockReservation, mockCabin);
    
    res.json({
      success: true,
      message: '✅ Email de recordatorio al admin enviado exitosamente',
      type: 'admin-reminder',
      recipient: process.env.ADMIN_EMAIL || 'lasacaciasrefugio@gmail.com',
      mockData: { reservation: mockReservation, cabin: mockCabin }
    });
  } catch (error) {
    console.error('❌ Error enviando email de recordatorio al admin:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error enviando email de recordatorio al admin',
      error: error.message
    });
  }
});

// GET /api/test-emails/guest-cancellation - Email de cancelación al usuario
router.get('/guest-cancellation', async (req, res) => {
  try {
    console.log('📧 Enviando email de cancelación al usuario de prueba...');
    const result = await notificationService.sendCancellationEmail(mockReservation, mockCabin);
    
    res.json({
      success: true,
      message: '✅ Email de cancelación al usuario enviado exitosamente',
      type: 'guest-cancellation',
      recipient: mockReservation.guestEmail,
      mockData: { reservation: mockReservation, cabin: mockCabin }
    });
  } catch (error) {
    console.error('❌ Error enviando email de cancelación:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error enviando email de cancelación',
      error: error.message
    });
  }
});

// GET /api/test-emails/admin-cancellation - Email de cancelación al admin
router.get('/admin-cancellation', async (req, res) => {
  try {
    console.log('📧 Enviando email de cancelación al admin de prueba...');
    const result = await notificationService.sendAdminCancellationEmail(mockReservation, mockCabin);
    
    res.json({
      success: true,
      message: '✅ Email de cancelación al admin enviado exitosamente',
      type: 'admin-cancellation',
      recipient: process.env.ADMIN_EMAIL || 'lasacaciasrefugio@gmail.com',
      mockData: { reservation: mockReservation, cabin: mockCabin }
    });
  } catch (error) {
    console.error('❌ Error enviando email de cancelación al admin:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error enviando email de cancelación al admin',
      error: error.message
    });
  }
});

// GET /api/test-emails/payment-confirmation - Email de confirmación de pago
router.get('/payment-confirmation', async (req, res) => {
  try {
    console.log('📧 Enviando email de confirmación de pago de prueba...');
    const result = await notificationService.sendPaymentConfirmationEmail(mockReservation, mockCabin);
    
    res.json({
      success: true,
      message: '✅ Email de confirmación de pago enviado exitosamente',
      type: 'payment-confirmation',
      recipient: mockReservation.guestEmail,
      mockData: { reservation: mockReservation, cabin: mockCabin }
    });
  } catch (error) {
    console.error('❌ Error enviando email de confirmación de pago:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error enviando email de confirmación de pago',
      error: error.message
    });
  }
});

// GET /api/test-emails/send-all - Enviar TODOS los emails
router.get('/send-all', async (req, res) => {
  try {
    console.log('📧 Enviando TODOS los emails de prueba...');
    
    const results = {
      guestConfirmation: null,
      reminder: null,
      adminReminder: null,
      guestCancellation: null,
      adminCancellation: null,
      paymentConfirmation: null
    };
    
    // Email 1: Pre-reserva
    try {
      console.log('1️⃣ Enviando email de pre-reserva...');
      await notificationService.sendGuestConfirmationEmail(mockReservation, mockCabin);
      results.guestConfirmation = '✅ Enviado';
    } catch (e) {
      results.guestConfirmation = `❌ Error: ${e.message}`;
    }
    
    // Email 2: Recordatorio urgente
    try {
      console.log('2️⃣ Enviando email de recordatorio urgente...');
      await notificationService.sendReminderEmail(mockReservation, mockCabin);
      results.reminder = '✅ Enviado';
    } catch (e) {
      results.reminder = `❌ Error: ${e.message}`;
    }
    
    // Email 3: Recordatorio al admin
    try {
      console.log('3️⃣ Enviando email de recordatorio al admin...');
      await notificationService.sendAdminReminderEmail(mockReservation, mockCabin);
      results.adminReminder = '✅ Enviado';
    } catch (e) {
      results.adminReminder = `❌ Error: ${e.message}`;
    }
    
    // Email 4: Cancelación usuario
    try {
      console.log('4️⃣ Enviando email de cancelación al usuario...');
      await notificationService.sendCancellationEmail(mockReservation, mockCabin);
      results.guestCancellation = '✅ Enviado';
    } catch (e) {
      results.guestCancellation = `❌ Error: ${e.message}`;
    }
    
    // Email 5: Cancelación admin
    try {
      console.log('5️⃣ Enviando email de cancelación al admin...');
      await notificationService.sendAdminCancellationEmail(mockReservation, mockCabin);
      results.adminCancellation = '✅ Enviado';
    } catch (e) {
      results.adminCancellation = `❌ Error: ${e.message}`;
    }
    
    // Email 6: Confirmación de pago
    try {
      console.log('6️⃣ Enviando email de confirmación de pago...');
      await notificationService.sendPaymentConfirmationEmail(mockReservation, mockCabin);
      results.paymentConfirmation = '✅ Enviado';
    } catch (e) {
      results.paymentConfirmation = `❌ Error: ${e.message}`;
    }
    
    res.json({
      success: true,
      message: '✅ Prueba de envío de todos los emails completada',
      results: results,
      summary: {
        guestEmail: mockReservation.guestEmail,
        adminEmail: process.env.ADMIN_EMAIL || 'lasacaciasrefugio@gmail.com',
        totalEmailsSent: 6,
        mockData: { reservation: mockReservation, cabin: mockCabin }
      }
    });
  } catch (error) {
    console.error('❌ Error en prueba de envío de todos los emails:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error en prueba de envío de todos los emails',
      error: error.message
    });
  }
});

// GET /api/test-emails/monitor - Monitorear reservas pendientes
router.get('/monitor', async (req, res) => {
  try {
    console.log('📊 Obteniendo reservas pendientes para monitoreo...');
    
    const pendingReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        cabin: {
          select: {
            id: true,
            name: true,
            price: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Calcular tiempos para cada reserva
    const reservationsWithTimings = pendingReservations.map(reservation => {
      const createdAt = new Date(reservation.createdAt);
      const now = new Date();
      const elapsedMinutes = Math.floor((now - createdAt) / (1000 * 60));
      
      return {
        id: reservation.id,
        guestName: reservation.guestName,
        guestLastName: reservation.guestLastName,
        guestEmail: reservation.guestEmail,
        cabin: reservation.cabin.name,
        createdAt: reservation.createdAt,
        elapsedMinutes: elapsedMinutes,
        status: reservation.status,
        timeline: {
          created: '0 min',
          reminderSent: elapsedMinutes >= 40 ? `✅ ${elapsedMinutes} min` : `⏳ Falta ${40 - elapsedMinutes} min`,
          adminNotified: elapsedMinutes >= 45 ? `✅ ${elapsedMinutes} min` : `⏳ Falta ${45 - elapsedMinutes} min`,
          willBeCancelled: elapsedMinutes >= 60 ? `✅ CANCELADA (${elapsedMinutes} min)` : `⏳ Falta ${60 - elapsedMinutes} min`,
          willBeDeleted: elapsedMinutes >= 60 ? `✅ ELIMINADA (${elapsedMinutes} min)` : `⏳ Falta ${60 - elapsedMinutes} min`
        }
      };
    });
    
    res.json({
      success: true,
      message: `📊 Monitoreo de ${pendingReservations.length} reserva(s) pendiente(s)`,
      totalPending: pendingReservations.length,
      reservations: reservationsWithTimings,
      instructions: {
        info: 'Actualiza esta página para ver el progreso en tiempo real',
        timeline: {
          'Minuto 0': 'Reserva creada - Email inicial enviado',
          'Minuto 40': 'Email de recordatorio urgente enviado al usuario',
          'Minuto 45': 'Email de alerta enviado al admin',
          'Minuto 60': 'Reserva cancelada y eliminada de la BD'
        }
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo reservas pendientes:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error obteniendo reservas pendientes',
      error: error.message
    });
  }
});

// GET /api/test-emails/create-test-reservation - Crear una reserva de prueba real
router.get('/create-test-reservation', async (req, res) => {
  try {
    console.log('🔍 Buscando una cabaña disponible...');
    
    // Obtener la primera cabaña disponible
    const cabin = await prisma.cabin.findFirst({
      where: {
        status: 'AVAILABLE'
      }
    });
    
    if (!cabin) {
      return res.status(400).json({
        success: false,
        message: '❌ No hay cabañas disponibles'
      });
    }
    
    console.log('✅ Cabaña encontrada:', cabin.name);
    
    // Crear fechas de prueba
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 2);
    
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 3);
    
    // Crear la reserva
    const reservation = await prisma.reservation.create({
      data: {
        cabinId: cabin.id,
        checkIn: checkIn,
        checkOut: checkOut,
        totalPrice: cabin.price * 3,
        guestCount: 2,
        guestName: 'Test',
        guestLastName: 'Usuario',
        guestDNI: '12345678',
        guestEmail: 'joakhaidar@gmail.com',
        guestPhone: '+54 9 11 1234-5678',
        paymentStatus: 'PENDING',
        amountPaid: 0,
        paymentMethod: 'TRANSFER',
        status: 'PENDING',
        isBreakfast: true
      },
      include: {
        cabin: true
      }
    });
    
    console.log('✅ Reserva de prueba creada:', reservation.id);
    
    // Enviar notificaciones
    const notificationService = require('../services/notificationService');
    await notificationService.notifyNewPlatformReservation(reservation, reservation.cabin);
    
    // Programar los timers
    console.log('⏰ Programando timers automáticos...');
    
    // 40 minutos
    setTimeout(async () => {
      try {
        const updated = await prisma.reservation.findUnique({
          where: { id: reservation.id },
          include: { cabin: true }
        });
        if (updated && updated.status !== 'CONFIRMED') {
          console.log('📧 [TEST] Enviando recordatorio urgente...');
          await notificationService.sendReminderEmail(updated, updated.cabin);
        }
      } catch (e) {
        console.error('❌ Error en recordatorio:', e.message);
      }
    }, 40 * 60 * 1000);
    
    // 45 minutos
    setTimeout(async () => {
      try {
        const updated = await prisma.reservation.findUnique({
          where: { id: reservation.id },
          include: { cabin: true }
        });
        if (updated && updated.status !== 'CONFIRMED') {
          console.log('📧 [TEST] Enviando alerta al admin...');
          await notificationService.sendAdminReminderEmail(updated, updated.cabin);
        }
      } catch (e) {
        console.error('❌ Error en alerta admin:', e.message);
      }
    }, 45 * 60 * 1000);
    
    // 60 minutos - CANCELACIÓN
    setTimeout(async () => {
      try {
        const updated = await prisma.reservation.findUnique({
          where: { id: reservation.id },
          include: { cabin: true }
        });
        if (updated && updated.status !== 'CONFIRMED') {
          console.log('❌ [TEST] CANCELANDO RESERVA AUTOMÁTICAMENTE...');
          
          // Enviar emails de cancelación
          if (updated.guestEmail) {
            await notificationService.sendCancellationEmail(updated, updated.cabin);
          }
          await notificationService.sendAdminCancellationEmail(updated, updated.cabin);
          
          // ELIMINAR LA RESERVA
          await prisma.reservation.delete({
            where: { id: reservation.id }
          });
          
          console.log('✅ [TEST] Reserva eliminada de la base de datos');
        }
      } catch (e) {
        console.error('❌ Error en cancelación:', e.message);
      }
    }, 60 * 60 * 1000);
    
    res.json({
      success: true,
      message: '✅ Reserva de prueba creada exitosamente',
      reservation: {
        id: reservation.id,
        guestName: reservation.guestName,
        guestEmail: reservation.guestEmail,
        cabin: reservation.cabin.name,
        createdAt: reservation.createdAt,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        totalPrice: reservation.totalPrice
      },
      timeline: {
        now: '✅ Reserva creada - Email inicial enviado',
        'in_40_minutes': '⏳ Email de recordatorio urgente',
        'in_45_minutes': '⏳ Email de alerta al admin',
        'in_60_minutes': '⏳ CANCELACIÓN AUTOMÁTICA Y ELIMINACIÓN'
      },
      monitoring: {
        message: 'Usa este endpoint para monitorear el progreso:',
        url: '/api/test-emails/monitor'
      }
    });
    
  } catch (error) {
    console.error('❌ Error creando reserva de prueba:', error);
    res.status(500).json({
      success: false,
      message: '❌ Error creando reserva de prueba',
      error: error.message
    });
  }
});

module.exports = router;
