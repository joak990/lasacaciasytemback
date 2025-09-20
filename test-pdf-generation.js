const pdfService = require('./src/services/pdfService');

// Datos de prueba para generar PDF
const testReservation = {
  id: 'test-reservation-123',
  guestName: 'Juan',
  guestLastName: 'Pérez',
  guestEmail: 'juan.perez@example.com',
  guestPhone: '+54 9 11 1234-5678',
  guestCount: 2,
  checkIn: new Date('2025-10-15'),
  checkOut: new Date('2025-10-17'),
  totalPrice: 15000,
  createdAt: new Date(),
  status: 'CONFIRMED'
};

const testCabin = {
  id: 'cabin-1',
  name: 'Cabaña Turquesa',
  capacity: 4,
  price: 7500,
  description: 'Hermosa cabaña con vista al mar'
};

async function testPDFGeneration() {
  try {
    console.log('🧪 Iniciando prueba de generación de PDF...');
    
    // Generar PDF
    const result = await pdfService.generateAndSavePDF(
      testReservation, 
      testCabin, 
      'test_confirmacion.pdf'
    );
    
    console.log('✅ PDF generado exitosamente!');
    console.log('📁 Ubicación:', result.path);
    console.log('📊 Tamaño:', result.buffer.length, 'bytes');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

// Ejecutar prueba
testPDFGeneration();
