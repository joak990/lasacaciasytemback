const axios = require('axios');

const testReservation = {
  cabinId: '601e3fa3-51ff-4c2d-9d2a-f7b68f24afba', // ID real de cabaña beige
  guestName: 'Juan',
  guestLastName: 'Pérez',
  guestEmail: 'juan@test.com',
  guestPhone: '+5491112345678',
  checkIn: '2024-01-15',
  checkOut: '2024-01-17',
  guestCount: 2,
  totalPrice: 15000
};

async function testProductionEndpoint() {
  try {
    console.log('🧪 Probando endpoint de test...');
    const testResponse = await axios.get('https://lasacaciasytemback-1.onrender.com/api/reservations/test');
    console.log('✅ Test endpoint funciona:', testResponse.data);
    
    console.log('🧪 Probando endpoint /platform en producción...');
    console.log('📤 Datos de prueba:', testReservation);
    
    const response = await axios.post('https://lasacaciasytemback-1.onrender.com/api/reservations/platform', testReservation);
    
    console.log('✅ Respuesta exitosa:', response.status);
    console.log('📋 Datos de respuesta:', response.data);
    
  } catch (error) {
    console.error('❌ Error en la prueba:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testProductionEndpoint(); 