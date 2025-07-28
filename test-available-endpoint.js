const axios = require('axios');

async function testAvailableEndpoint() {
  try {
    console.log('🔍 Probando endpoint de cabañas disponibles...');
    
    const response = await axios.get('https://lasacaciasytemback-1.onrender.com/api/cabins/available', {
      params: {
        checkIn: '2025-07-29',
        checkOut: '2025-07-30'
      }
    });
    
    console.log('✅ Response status:', response.status);
    console.log('✅ Available cabins:', response.data);
    console.log('✅ Number of available cabins:', response.data.length);
    
    // Verificar que "perla" NO esté en la lista
    const perlaCabin = response.data.find(cabin => cabin.name === 'perla');
    if (perlaCabin) {
      console.log('❌ ERROR: Cabaña "perla" aparece como disponible cuando debería estar ocupada');
    } else {
      console.log('✅ CORRECTO: Cabaña "perla" NO aparece en la lista (está ocupada)');
    }
    
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.response?.data || error.message);
  }
}

testAvailableEndpoint(); 