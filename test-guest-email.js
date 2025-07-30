const notificationService = require('./src/services/notificationService');

const testReservation = {
  id: 'test-reservation-id',
  guestName: 'Juan',
  guestLastName: 'Pérez',
  guestEmail: 'joaquinxhacken@gmail.com', // Email real para prueba
  guestPhone: '+5491112345678',
  checkIn: new Date('2025-01-15'),
  checkOut: new Date('2025-01-17'),
  guestCount: 2,
  totalPrice: 15000
};

const testCabin = {
  id: 'test-cabin-id',
  name: 'Cabaña Beige',
  capacity: 4,
  price: 7500
};

async function testGuestEmail() {
  try {
    console.log('🧪 Probando email de confirmación al huésped...');
    console.log('📧 Email de destino:', testReservation.guestEmail);
    
    const result = await notificationService.sendGuestConfirmationEmail(testReservation, testCabin);
    
    console.log('✅ Resultado:', result);
    
    if (result) {
      console.log('📧 Email enviado exitosamente');
    } else {
      console.log('❌ Error enviando email');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testGuestEmail(); 