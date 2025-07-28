require('dotenv').config();

console.log('🔍 Verificando configuración de Twilio...');

const config = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  adminSms: process.env.ADMIN_SMS
};

console.log('📋 Configuración actual:');
console.log('Account SID:', config.accountSid ? '✅ Configurado' : '❌ No configurado');
console.log('Auth Token:', config.authToken ? '✅ Configurado' : '❌ No configurado');
console.log('Phone Number:', config.phoneNumber || '❌ No configurado');
console.log('Admin SMS:', config.adminSms || '❌ No configurado');

if (config.accountSid && config.authToken && config.phoneNumber) {
  console.log('\n✅ Twilio está configurado correctamente');
  console.log('📱 Puedes probar con: node test-sms.js');
} else {
  console.log('\n❌ Twilio no está configurado completamente');
  console.log('📝 Agrega las variables a tu archivo .env:');
  console.log('TWILIO_ACCOUNT_SID="tu_account_sid"');
  console.log('TWILIO_AUTH_TOKEN="tu_auth_token"');
  console.log('TWILIO_PHONE_NUMBER="tu_numero_de_twilio"');
  console.log('ADMIN_SMS="+543548507646"');
} 