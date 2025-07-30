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

  // Enviar email de confirmación al huésped
  async sendGuestConfirmationEmail(reservation, cabin) {
    try {
      console.log('📧 Enviando email de confirmación al huésped...');
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'lasacaciasrefugio@gmail.com',
        to: reservation.guestEmail,
        subject: '✅ Confirmación de Reserva - Las Acacias Refugio',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🏠 Las Acacias Refugio</h1>
              <p style="color: #dbeafe; margin: 10px 0 0 0; font-size: 16px;">Tu reserva ha sido confirmada</p>
            </div>

            <!-- Main Content -->
            <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              
              <!-- Success Message -->
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="background-color: #dcfce7; border: 2px solid #22c55e; border-radius: 50%; width: 80px; height: 80px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                  <span style="font-size: 40px; color: #22c55e;">✅</span>
                </div>
                <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">¡Reserva Confirmada!</h2>
                <p style="color: #6b7280; margin: 0; font-size: 16px;">Hola ${reservation.guestName}, tu reserva ha sido procesada exitosamente.</p>
              </div>

              <!-- Reservation Details -->
              <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 30px;">
                <h3 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">📋 Detalles de tu Reserva</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                  <div>
                    <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px; font-weight: bold;">CABAÑA</p>
                    <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: bold;">${cabin.name}</p>
                  </div>
                  <div>
                    <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px; font-weight: bold;">HUÉSPEDES</p>
                    <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: bold;">${reservation.guestCount} personas</p>
                  </div>
                  <div>
                    <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px; font-weight: bold;">CHECK-IN</p>
                    <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: bold;">${new Date(reservation.checkIn).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div>
                    <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px; font-weight: bold;">CHECK-OUT</p>
                    <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: bold;">${new Date(reservation.checkOut).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>

                <div style="background-color: white; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                  <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: bold;">💰 Total de la Reserva</p>
                  <p style="margin: 0; color: #059669; font-size: 24px; font-weight: bold;">ARS ${reservation.totalPrice.toLocaleString()}</p>
                </div>
              </div>

              <!-- Payment Information -->
              <div style="background-color: #fef3c7; padding: 25px; border-radius: 10px; margin-bottom: 30px; border-left: 4px solid #f59e0b;">
                <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">💳 Información de Pago</h3>
                <p style="margin: 0 0 15px 0; color: #92400e; font-size: 14px;">Para confirmar tu reserva, necesitas realizar el depósito del 50%:</p>
                
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                  <p style="margin: 0 0 5px 0; color: #92400e; font-size: 14px; font-weight: bold;">Monto a depositar:</p>
                  <p style="margin: 0; color: #92400e; font-size: 20px; font-weight: bold;">ARS ${Math.round(reservation.totalPrice * 0.5).toLocaleString()}</p>
                </div>

                <div style="background-color: white; padding: 15px; border-radius: 8px;">
                  <p style="margin: 0 0 5px 0; color: #92400e; font-size: 14px; font-weight: bold;">Datos para la transferencia:</p>
                  <p style="margin: 0 0 5px 0; color: #92400e; font-size: 14px;"><strong>Banco:</strong> Santander</p>
                  <p style="margin: 0 0 5px 0; color: #92400e; font-size: 14px;"><strong>Alias:</strong> LASACACIASREFUGIO</p>
                  <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Titular:</strong> Analía González</p>
                </div>
              </div>

              <!-- Important Notes -->
              <div style="background-color: #fef2f2; padding: 20px; border-radius: 10px; margin-bottom: 30px; border-left: 4px solid #ef4444;">
                <h3 style="color: #991b1b; margin: 0 0 15px 0; font-size: 18px;">⚠️ Información Importante</h3>
                <ul style="margin: 0; padding-left: 20px; color: #991b1b; font-size: 14px;">
                  <li style="margin-bottom: 8px;">Tienes <strong>24 horas</strong> para realizar el pago y confirmar tu reserva</li>
                  <li style="margin-bottom: 8px;">Enviar comprobante de pago por WhatsApp al +54 3548 63-1824</li>
                  <li style="margin-bottom: 8px;">El check-in es a partir de las 15:00 hs</li>
                  <li style="margin-bottom: 8px;">El check-out es hasta las 11:00 hs</li>
                  <li style="margin-bottom: 8px;">Llevar ropa de cama y toallas</li>
                  <li style="margin-bottom: 0;">No se permiten mascotas</li>
                </ul>
              </div>

              <!-- Contact Information -->
              <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-radius: 10px;">
                <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">📞 Contacto</h3>
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Si tienes alguna pregunta, no dudes en contactarnos:</p>
                <p style="margin: 0 0 5px 0; color: #1f2937; font-size: 14px;"><strong>WhatsApp:</strong> +54 3548 63-1824</p>
                <p style="margin: 0; color: #1f2937; font-size: 14px;"><strong>Email:</strong> analia@lasacacias.com</p>
              </div>

            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
              <p style="margin: 0;">Las Acacias Refugio - Villa General Belgrano, Córdoba</p>
              <p style="margin: 5px 0 0 0;">Gracias por elegirnos para tu estadía</p>
            </div>
          </div>
        `
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      console.log('✅ Email de confirmación enviado al huésped:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email de confirmación al huésped:', error);
      return false;
    }
  }

  // Notificar nueva reserva desde plataforma
  async notifyNewPlatformReservation(reservation, cabin) {
    console.log('🔔 Enviando notificaciones para nueva reserva de plataforma...');
    
    let emailSent = false;
    let smsSent = false;
    let guestEmailSent = false;
    
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
    
    // Enviar email de confirmación al huésped
    try {
      if (reservation.guestEmail) {
        guestEmailSent = await this.sendGuestConfirmationEmail(reservation, cabin);
      } else {
        console.log('⚠️ No se envió email de confirmación al huésped - email no proporcionado');
        guestEmailSent = false;
      }
    } catch (error) {
      console.error('❌ Error enviando email de confirmación al huésped:', error);
      guestEmailSent = false;
    }
    
    console.log('📊 Resultado de notificaciones:', { emailSent, smsSent, guestEmailSent });
    
    return {
      email: emailSent,
      sms: smsSent,
      guestEmail: guestEmailSent
    };
  }
}

module.exports = new NotificationService(); 