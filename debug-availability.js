const axios = require('axios');

async function debugAvailability() {
  try {
    console.log('🔍 DEBUG: Investigando por qué "perla" aparece como disponible...\n');
    
    // 1. Obtener todas las cabañas
    console.log('1️⃣ Obteniendo todas las cabañas...');
    const allCabinsResponse = await axios.get('https://lasacaciasytemback-1.onrender.com/api/cabins');
    console.log('✅ Total cabañas:', allCabinsResponse.data.length);
    console.log('📋 Cabañas:', allCabinsResponse.data.map(c => `${c.name} (${c.status})`));
    
    // 2. Buscar la cabaña "perla" específicamente
    const perlaCabin = allCabinsResponse.data.find(c => c.name === 'perla');
    if (perlaCabin) {
      console.log('\n2️⃣ Cabaña "perla" encontrada:', {
        id: perlaCabin.id,
        name: perlaCabin.name,
        status: perlaCabin.status
      });
    } else {
      console.log('\n❌ Cabaña "perla" NO encontrada');
      return;
    }
    
    // 3. Obtener todas las reservaciones de "perla"
    console.log('\n3️⃣ Obteniendo todas las reservaciones...');
    const reservationsResponse = await axios.get('https://lasacaciasytemback-1.onrender.com/api/reservations');
    const perlaReservations = reservationsResponse.data.filter(r => r.cabinId === perlaCabin.id);
    console.log('✅ Total reservaciones de "perla":', perlaReservations.length);
    
    if (perlaReservations.length > 0) {
      console.log('📋 Reservaciones de "perla":');
      perlaReservations.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.guestName} ${r.guestLastName} - ${r.checkIn} → ${r.checkOut} (${r.status})`);
      });
    }
    
    // 4. Verificar reservaciones para las fechas específicas
    console.log('\n4️⃣ Verificando reservaciones para 2025-07-29 → 2025-07-30...');
    const targetCheckIn = new Date('2025-07-29T00:00:00.000Z');
    const targetCheckOut = new Date('2025-07-30T00:00:00.000Z');
    
    const conflictingReservations = perlaReservations.filter(r => {
      const rCheckIn = new Date(r.checkIn);
      const rCheckOut = new Date(r.checkOut);
      
      // Verificar si hay superposición
      const hasConflict = (
        (rCheckIn <= targetCheckIn && rCheckOut > targetCheckIn) ||
        (rCheckIn < targetCheckOut && rCheckOut >= targetCheckOut) ||
        (rCheckIn >= targetCheckIn && rCheckOut <= targetCheckOut)
      );
      
      console.log(`   Reservación ${r.guestName}: ${rCheckIn.toISOString()} → ${rCheckOut.toISOString()} - Conflicto: ${hasConflict}`);
      return hasConflict;
    });
    
    console.log(`\n✅ Reservaciones conflictivas encontradas: ${conflictingReservations.length}`);
    
    // 5. Probar el endpoint de disponibilidad
    console.log('\n5️⃣ Probando endpoint /api/cabins/available...');
    try {
      const availableResponse = await axios.get('https://lasacaciasytemback-1.onrender.com/api/cabins/available', {
        params: {
          checkIn: '2025-07-29',
          checkOut: '2025-07-30'
        }
      });
      
      console.log('✅ Cabañas disponibles:', availableResponse.data.length);
      const perlaInAvailable = availableResponse.data.find(c => c.name === 'perla');
      
      if (perlaInAvailable) {
        console.log('❌ PROBLEMA: "perla" aparece en la lista de disponibles');
        console.log('   Datos de "perla" en disponibles:', perlaInAvailable);
      } else {
        console.log('✅ CORRECTO: "perla" NO aparece en la lista de disponibles');
      }
      
    } catch (error) {
      console.error('❌ Error en endpoint /api/cabins/available:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.response?.data || error.message);
  }
}

debugAvailability(); 