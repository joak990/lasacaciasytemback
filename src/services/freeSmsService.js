const axios = require('axios');

class FreeSMSService {
  constructor() {
    this.apis = [
      {
        name: 'TextLocal (India)',
        url: 'https://api.textlocal.in/send/',
        format: (phone, message) => ({
          apikey: process.env.TEXTLOCAL_API_KEY,
          numbers: phone,
          message: message,
          sender: 'TXTLCL'
        })
      },
      {
        name: 'SMS Gateway',
        url: 'https://api.smsgateway.me/send/',
        format: (phone, message) => ({
          token: process.env.SMSGATEWAY_TOKEN,
          to: phone,
          message: message
        })
      }
    ];
  }

  async sendSMS(phoneNumber, message) {
    console.log('📱 Intentando enviar SMS gratuito...');
    
    // Por ahora, solo simulamos
    console.log('📱 SMS GRATUITO SIMULADO:');
    console.log('📞 Para:', phoneNumber);
    console.log('💬 Mensaje:', message);
    console.log('✅ SMS simulado enviado');
    
    // En el futuro, aquí irían las llamadas a APIs gratuitas
    return true;
  }

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

module.exports = new FreeSMSService(); 