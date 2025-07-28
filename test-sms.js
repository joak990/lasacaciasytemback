const smsService = require('./src/services/smsService');

async function testSMS() {
  console.log('📱 Probando servicio de SMS...');
  
  // Simular una reserva de prueba
  const testReservation = {
    guestName: 'Juan',
    guestLastName: 'Pérez',
    guestEmail: 'juan@example.com',
    guestPhone: '+543548507646',
    guestCount: 2,
    checkIn: new Date('2025-08-01'),
    checkOut: new Date('2025-08-03'),
    totalPrice: 15000
  };

  const testCabin = {
    name: 'Cabaña Turquesa',
    capacity: 4,
    price: 7500
  };

  console.log('📤 Enviando SMS de prueba...');
  const result = await smsService.sendReservationNotification(testReservation, testCabin);
  
  if (result) {
    console.log('✅ SMS enviado exitosamente!');
    console.log('📱 Revisa tu teléfono para el mensaje');
  } else {
    console.log('❌ Error enviando SMS');
  }
}

testSMS(); 