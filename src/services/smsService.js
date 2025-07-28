const twilio = require('twilio');
require('dotenv').config();

class SMSService {
  constructor() {
    this.client = null;
    this.init();
  }

  init() {
    // Twilio - Configuración real
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    console.log('🔧 Inicializando SMS Service...');
    console.log('Account SID:', accountSid ? '✅ Configurado' : '❌ No configurado');
    console.log('Auth Token:', authToken ? '✅ Configurado' : '❌ No configurado');
    console.log('Phone Number:', process.env.TWILIO_PHONE_NUMBER || '❌ No configurado');
    
    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
      console.log('✅ SMS Service (Twilio) inicializado correctamente');
    } else {
      console.log('⚠️ Twilio no configurado - usando SMS simulado');
    }
  }

  async sendSMS(phoneNumber, message) {
    try {
      if (!this.client) {
        // SMS simulado para desarrollo
        console.log('📱 SMS SIMULADO:');
        console.log('📞 Para:', phoneNumber);
        console.log('💬 Mensaje:', message);
        console.log('✅ SMS simulado enviado');
        return true;
      }

      // SMS real con Twilio
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      console.log('✅ SMS enviado via Twilio:', result.sid);
      return true;
    } catch (error) {
      console.error('❌ Error enviando SMS:', error.message);
      return false;
    }
  }

  // Enviar notificación de reserva
  async sendReservationNotification(reservation, cabin) {
    const message = `🏠 NUEVA RESERVA - Las Acacias Refugio

📋 Detalles:
• Huésped: ${reservation.guestName} ${reservation.guestLastName}
• Cabaña: ${cabin.name}
• Fechas: ${new Date(reservation.checkIn).toLocaleDateString('es-ES')} - ${new Date(reservation.checkOut).toLocaleDateString('es-ES')}
• Huéspedes: ${reservation.guestCount}
• Total: $${reservation.totalPrice}
• Teléfono: ${reservation.guestPhone}
${reservation.guestEmail ? `• Email: ${reservation.guestEmail}` : ''}

💻 Creada desde la plataforma web
🕐 ${new Date().toLocaleString('es-ES')}`;

    const adminPhone = process.env.ADMIN_SMS || '+543548507646';
    return await this.sendSMS(adminPhone, message);
  }
}

module.exports = new SMSService(); 