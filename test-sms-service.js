const smsService = require('./src/services/smsService');

async function testSmsService() {
  console.log('🔍 Verificando servicio de SMS...');
  
  // Verificar si el cliente se creó correctamente
  console.log('📊 Estado del servicio:');
  console.log('Cliente creado:', smsService.client ? '✅ Sí' : '❌ No');
  
  if (smsService.client) {
    console.log('✅ Servicio de SMS inicializado correctamente');
    
    // Probar envío directo
    const testMessage = '🧪 Prueba del servicio de SMS - Las Acacias';
    const adminPhone = process.env.ADMIN_SMS || '+543548507646';
    
    console.log('\n📤 Probando envío directo...');
    console.log('📞 Para:', adminPhone);
    console.log('💬 Mensaje:', testMessage);
    
    try {
      const result = await smsService.sendSMS(adminPhone, testMessage);
      console.log('✅ Resultado del envío:', result);
      
      if (result) {
        console.log('🎉 ¡SMS enviado exitosamente!');
      } else {
        console.log('❌ No se pudo enviar el SMS');
      }
    } catch (error) {
      console.log('❌ Error en el servicio:', error.message);
    }
  } else {
    console.log('❌ Servicio de SMS no se inicializó correctamente');
    console.log('💡 Verifica las variables de entorno:');
    console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✅' : '❌');
    console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✅' : '❌');
    console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER || '❌');
  }
}

testSmsService(); 