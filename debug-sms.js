require('dotenv').config();
const twilio = require('twilio');

console.log('🔍 Diagnosticando problema de SMS...');

// Verificar variables de entorno
const config = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  adminSms: process.env.ADMIN_SMS
};

console.log('\n📋 Variables de entorno:');
console.log('TWILIO_ACCOUNT_SID:', config.accountSid ? '✅ Configurado' : '❌ FALTA');
console.log('TWILIO_AUTH_TOKEN:', config.authToken ? '✅ Configurado' : '❌ FALTA');
console.log('TWILIO_PHONE_NUMBER:', config.phoneNumber || '❌ FALTA');
console.log('ADMIN_SMS:', config.adminSms || '❌ FALTA');

if (!config.accountSid || !config.authToken || !config.phoneNumber) {
  console.log('\n❌ PROBLEMA: Faltan variables de Twilio');
  console.log('📝 Solución: Agrega estas líneas a tu archivo .env:');
  console.log('TWILIO_ACCOUNT_SID="tu_account_sid"');
  console.log('TWILIO_AUTH_TOKEN="tu_auth_token"');
  console.log('TWILIO_PHONE_NUMBER="tu_numero_de_twilio"');
  return;
}

// Intentar crear cliente de Twilio
try {
  console.log('\n🔧 Creando cliente de Twilio...');
  const client = twilio(config.accountSid, config.authToken);
  console.log('✅ Cliente de Twilio creado exitosamente');
  
  // Intentar enviar SMS de prueba
  console.log('\n📤 Intentando enviar SMS de prueba...');
  const testMessage = '🧪 Prueba de SMS - Las Acacias Sistema';
  
  client.messages.create({
    body: testMessage,
    from: config.phoneNumber,
    to: config.adminSms
  })
  .then(message => {
    console.log('✅ SMS enviado exitosamente!');
    console.log('📱 SID:', message.sid);
    console.log('📞 Para:', config.adminSms);
    console.log('💬 Mensaje:', testMessage);
    console.log('\n🎉 ¡El SMS debería llegar a tu teléfono!');
  })
  .catch(error => {
    console.log('❌ Error enviando SMS:');
    console.log('Código:', error.code);
    console.log('Mensaje:', error.message);
    console.log('Más info:', error.moreInfo);
  });
  
} catch (error) {
  console.log('❌ Error creando cliente de Twilio:', error.message);
} 