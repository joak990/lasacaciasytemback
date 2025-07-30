const nodemailer = require('nodemailer');
const smsService = require('./smsService');

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.initEmailService();
  }

  // Inicializar servicio de email
  initEmailService() {
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'lasacaciasrefugio@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'tu_app_password'
      }
    });
  }

  // Enviar email de notificación
  async sendEmailNotification(reservation, cabin) {
    try {
      console.log('📧 Configurando email...');
      console.log('📧 EMAIL_USER:', process.env.EMAIL_USER);
      console.log('📧 ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'lasacaciasrefugio@gmail.com',
        to: process.env.ADMIN_EMAIL || 'analia@lasacacias.com',
        subject: '🏠 Nueva Reserva - Las Acacias Refugio',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb; text-align: center;">🏠 Nueva Reserva Recibida</h2>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin-top: 0;">📋 Detalles de la Reserva</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Huésped:</td>
                  <td style="padding: 8px 0; color: #6b7280;">${reservation.guestName} ${reservation.guestLastName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Cabaña:</td>
                  <td style="padding: 8px 0; color: #6b7280;">${cabin.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Fechas:</td>
                  <td style="padding: 8px 0; color: #6b7280;">${new Date(reservation.checkIn).toLocaleDateString('es-ES')} - ${new Date(reservation.checkOut).toLocaleDateString('es-ES')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Huéspedes:</td>
                  <td style="padding: 8px 0; color: #6b7280;">${reservation.guestCount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Total:</td>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">$${reservation.totalPrice}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Teléfono:</td>
                  <td style="padding: 8px 0; color: #6b7280;">${reservation.guestPhone}</td>
                </tr>
                ${reservation.guestEmail ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Email:</td>
                  <td style="padding: 8px 0; color: #6b7280;">${reservation.guestEmail}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #1e40af; font-weight: bold;">💡 Esta reserva fue creada desde la plataforma web</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #6b7280; font-size: 14px;">
                Las Acacias Refugio<br>
                Sistema de Administración
              </p>
            </div>
          </div>
        `
      };

      console.log('📧 Enviando email...');
      const info = await this.emailTransporter.sendMail(mailOptions);
      console.log('✅ Email enviado:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      return false;
    }
  }

  // Enviar SMS de notificación
  async sendSMSNotification(reservation, cabin) {
    try {
      const result = await smsService.sendReservationNotification(reservation, cabin);
      return result;
    } catch (error) {
      console.error('❌ Error enviando SMS:', error);
      return false;
    }
  }

  // Notificar nueva reserva desde plataforma
  async notifyNewPlatformReservation(reservation, cabin) {
    console.log('🔔 Enviando notificaciones para nueva reserva de plataforma...');
    
    let emailSent = false;
    let smsSent = false;
    
    try {
      emailSent = await this.sendEmailNotification(reservation, cabin);
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      emailSent = false;
    }
    
    try {
      smsSent = await this.sendSMSNotification(reservation, cabin);
    } catch (error) {
      console.error('❌ Error enviando SMS:', error);
      smsSent = false;
    }
    
    console.log('📊 Resultado de notificaciones:', { emailSent, smsSent });
    
    return {
      email: emailSent,
      sms: smsSent
    };
  }
}

module.exports = new NotificationService(); 