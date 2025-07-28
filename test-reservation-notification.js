const notificationService = require('./src/services/notificationService');

async function testReservationNotification() {
  console.log('🧪 Probando notificaciones completas de reserva...');
  
  // Simular una reserva de prueba
  const testReservation = {
    id: 'test-123',
    guestName: 'María',
    guestLastName: 'González',
    guestEmail: 'maria@example.com',
    guestPhone: '+543548507646',
    guestCount: 3,
    checkIn: new Date('2025-08-15'),
    checkOut: new Date('2025-08-17'),
    totalPrice: 18000,
    channel: 'PLATFORM'
  };

  const testCabin = {
    name: 'Cabaña Esmeralda',
    capacity: 4,
    price: 9000
  };

  console.log('📤 Enviando notificaciones...');
  const result = await notificationService.notifyNewPlatformReservation(testReservation, testCabin);
  
  console.log('\n📊 Resultados:');
  console.log('📧 Email:', result.email ? '✅ Enviado' : '❌ Error');
  console.log('📱 SMS:', result.sms ? '✅ Enviado' : '❌ Error');
  
  if (result.email && result.sms) {
    console.log('\n🎉 ¡Todas las notificaciones enviadas exitosamente!');
    console.log('📧 Revisa tu email en:', process.env.ADMIN_EMAIL);
    console.log('📱 Revisa tu teléfono para el SMS');
  } else {
    console.log('\n⚠️ Algunas notificaciones fallaron');
  }
}

testReservationNotification(); 