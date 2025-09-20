const notificationService = require('./src/services/notificationService');

// Datos de prueba para el email con PDF
const testReservation = {
  id: 'test-reservation-456',
  guestName: 'María',
  guestLastName: 'González',
  guestEmail: 'maria.gonzalez@example.com', // Cambia por tu email para probar
  guestPhone: '+54 9 11 9876-5432',
  guestCount: 3,
  checkIn: new Date('2025-11-20'),
  checkOut: new Date('2025-11-22'),
  totalPrice: 25000,
  createdAt: new Date(),
  status: 'CONFIRMED'
};

const testCabin = {
  id: 'cabin-2',
  name: 'Cabaña Perla',
  capacity: 6,
  price: 12500,
  description: 'Cabaña con vista al mar y jacuzzi'
};

async function testEmailWithPDF() {
  try {
    console.log('🧪 Probando envío de email con PDF...');
    console.log('📧 Email de destino:', testReservation.guestEmail);
    
    // Enviar email con PDF
    const result = await notificationService.sendPaymentConfirmationEmail(
      testReservation, 
      testCabin
    );
    
    if (result) {
      console.log('✅ Email con PDF enviado exitosamente!');
      console.log('📄 El PDF debería estar adjunto al email');
    } else {
      console.log('❌ Error enviando email');
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

// Ejecutar prueba
testEmailWithPDF();
