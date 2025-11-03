const nodemailer = require('nodemailer');
const smsService = require('./smsService');
const pdfService = require('./pdfService');

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.initEmailService();
  }

  // Inicializar servicio de email
  initEmailService() {
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    
    if (!emailUser || !emailPassword) {
      console.warn('⚠️ EMAIL_USER o EMAIL_PASSWORD no están configurados en las variables de entorno');
      console.warn('⚠️ Los emails no se podrán enviar hasta que se configuren estas variables');
    }
    
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser || 'lasacaciasrefugio@gmail.com',
        pass: emailPassword || 'tu_app_password'
      }
    });
    
    // Verificar conexión al inicializar (sin await, corre en background)
    this.verifyConnection().catch(err => {
      // Ya se maneja el error en verifyConnection
    });
  }
  
  // Verificar conexión del transporter
  async verifyConnection() {
    try {
      await this.emailTransporter.verify();
      console.log('✅ Servicio de email configurado correctamente');
    } catch (error) {
      console.error('❌ Error verificando conexión de email:', error.message);
      if (error.code === 'EAUTH') {
        console.error('❌ Error de autenticación - Verifica EMAIL_USER y EMAIL_PASSWORD');
      }
    }
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

  // Enviar email de confirmación de pago al huésped
  async sendPaymentConfirmationEmail(reservation, cabin) {
    try {
      console.log('📧 Enviando email de confirmación de pago al huésped...');
      
      // Generar PDF de confirmación solo si está habilitado
      // El PDF es completamente opcional - si está deshabilitado o falla, se envía solo el email HTML
      let pdfAttachment = null;
      const enablePDF = process.env.ENABLE_PDF === 'true' || process.env.ENABLE_PDF === '1';
      
      if (enablePDF) {
        try {
          console.log('📄 Intentando generar PDF de confirmación (máximo 8 segundos)...');
          
          // Timeout más corto de 8 segundos para no bloquear el envío del email
          const pdfPromise = pdfService.generateAndSavePDF(
            reservation, 
            cabin, 
            `confirmacion_${reservation.id.slice(-8)}.pdf`
          );
          const pdfTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: PDF tardó más de 8 segundos')), 8000)
          );
          
          const pdfResult = await Promise.race([pdfPromise, pdfTimeout]);
          
          pdfAttachment = {
            filename: `Confirmacion_Reserva_${reservation.id.slice(-8).toUpperCase()}.pdf`,
            content: pdfResult.buffer,
            contentType: 'application/pdf'
          };
          console.log('✅ PDF generado exitosamente');
        } catch (pdfError) {
          console.warn('⚠️ No se pudo generar el PDF (continúa sin PDF):', pdfError.message || pdfError);
          console.warn('⚠️ El email se enviará sin el archivo PDF adjunto');
          // Continuar sin PDF - no es crítico para el envío del email
        }
      } else {
        console.log('📄 Generación de PDF deshabilitada (ENABLE_PDF=false). Enviando solo email HTML.');
      }
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'lasacaciasrefugio@gmail.com',
        to: reservation.guestEmail,
        subject: '✅ Reserva Confirmada - Las Acacias Refugio',
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
                <p style="color: #6b7280; margin: 0; font-size: 16px;">Hola ${reservation.guestName}, tu pago ha sido procesado y tu reserva está confirmada.</p>
              </div>

              <!-- PDF Notice -->
              ${pdfAttachment ? `
              <div style="background-color: #e0f2fe; border: 2px solid #0288d1; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
                <p style="margin: 0; color: #01579b; font-weight: bold;">
                  📄 <strong>¡Importante!</strong> Adjuntamos tu comprobante de reserva en PDF para que puedas imprimirlo o guardarlo.
                </p>
              </div>
              ` : ''}

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
                    <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: bold;">${new Date(reservation.checkIn).toLocaleDateString('es-ES')}</p>
                  </div>
                  <div>
                    <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px; font-weight: bold;">CHECK-OUT</p>
                    <p style="margin: 0; color: #1f2937; font-size: 16px; font-weight: bold;">${new Date(reservation.checkOut).toLocaleDateString('es-ES')}</p>
                  </div>
                </div>
              </div>
              
              <div style="background-color: #eef2ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <p style="margin: 0; color: #1e40af; font-weight: bold; font-size: 16px;">💰 Precio total: $${reservation.totalPrice}</p>
              </div>
            </div>
            
            <!-- Important Information -->
            <div style="margin-bottom: 30px;">
              <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">ℹ️ Información Importante</h3>
              
              <ul style="color: #4b5563; padding-left: 20px; margin: 0;">
                <li style="margin-bottom: 10px;">El horario de check-in es a partir de las 14:00 hs.</li>
                <li style="margin-bottom: 10px;">El horario de check-out es hasta las 10:00 hs.</li>
                <li style="margin-bottom: 10px;">Por favor, traer toallas y artículos de higiene personal.</li>
                <li style="margin-bottom: 10px;">No se permiten mascotas.</li>
              </ul>
            </div>
            
            <!-- Contact -->
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">📞 ¿Necesitas ayuda?</h3>
              <p style="color: #4b5563; margin: 0 0 10px 0;">Si tienes alguna pregunta o necesitas asistencia, contáctanos:</p>
              <p style="color: #1e40af; margin: 0; font-weight: bold;">WhatsApp: +54 9 11 1234-5678</p>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                Las Acacias Refugio<br>
                Ruta 11, Km 10, Costa del Este<br>
                Buenos Aires, Argentina
              </p>
            </div>
          </div>
        `,
        attachments: pdfAttachment ? [pdfAttachment] : []
      };

      console.log('📧 Enviando email de confirmación...');
      
      // Verificar que el transporter esté configurado
      if (!this.emailTransporter) {
        console.error('❌ Email transporter no está inicializado');
        return false;
      }
      
      const info = await this.emailTransporter.sendMail(mailOptions);
      console.log('✅ Email de confirmación enviado:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email de confirmación:', error.message);
      if (error.code === 'EAUTH') {
        console.error('❌ Error de autenticación Gmail - Verifica que EMAIL_PASSWORD sea una contraseña de aplicación válida');
      } else if (error.code === 'ECONNECTION') {
        console.error('❌ Error de conexión - Verifica tu conexión a internet');
      }
      console.error('❌ Error completo:', error);
      return false;
    }
  }

  // Enviar email de cancelación al huésped
  async sendCancellationEmail(reservation, cabin) {
    try {
      console.log('📧 Enviando email de cancelación al huésped...');
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'lasacaciasrefugio@gmail.com',
        to: reservation.guestEmail,
        subject: '❌ Reserva Cancelada - Las Acacias Refugio',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🏠 Las Acacias Refugio</h1>
              <p style="color: #fecaca; margin: 10px 0 0 0; font-size: 16px;">Tu reserva ha sido cancelada</p>
            </div>
            <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="background-color: #fee2e2; border: 2px solid #dc2626; border-radius: 50%; width: 80px; height: 80px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                  <span style="font-size: 40px; color: #dc2626;">❌</span>
                </div>
                <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">Reserva Cancelada</h2>
                <p style="color: #6b7280; margin: 0; font-size: 16px;">Hola ${reservation.guestName}, lamentamos informarte que tu reserva ha sido cancelada.</p>
              </div>
              <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 30px;">
                <h3 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">📋 Detalles de la Reserva Cancelada</h3>
                <p><strong>Cabaña:</strong> ${cabin.name}</p>
                <p><strong>Fechas:</strong> ${new Date(reservation.checkIn).toLocaleDateString('es-ES')} - ${new Date(reservation.checkOut).toLocaleDateString('es-ES')}</p>
                <p><strong>Huéspedes:</strong> ${reservation.guestCount} personas</p>
                <p><strong>Total:</strong> $${reservation.totalPrice}</p>
              </div>
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">📞 ¿Necesitas ayuda?</h3>
                <p style="color: #4b5563; margin: 0 0 10px 0;">Si tienes alguna pregunta sobre la cancelación, contáctanos:</p>
                <p style="color: #1e40af; margin: 0; font-weight: bold;">WhatsApp: +54 9 11 1234-5678</p>
              </div>
            </div>
          </div>
        `
      };
  
      console.log('📧 Enviando email de cancelación...');
      
      // Verificar que el transporter esté configurado
      if (!this.emailTransporter) {
        console.error('❌ Email transporter no está inicializado');
        return false;
      }
      
      const info = await this.emailTransporter.sendMail(mailOptions);
      console.log('✅ Email de cancelación enviado:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email de cancelación:', error.message);
      if (error.code === 'EAUTH') {
        console.error('❌ Error de autenticación Gmail - Verifica que EMAIL_PASSWORD sea una contraseña de aplicación válida');
      } else if (error.code === 'ECONNECTION') {
        console.error('❌ Error de conexión - Verifica tu conexión a internet');
      }
      console.error('❌ Error completo:', error);
      return false;
    }
  }

  // Enviar email de pre-reserva al huésped
  async sendGuestConfirmationEmail(reservation, cabin) {
    try {
      console.log('📧 Enviando email de pre-reserva al huésped...');
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'lasacaciasrefugio@gmail.com',
        to: reservation.guestEmail,
        subject: '🏠 Pre-Reserva - Las Acacias Refugio - ¡Falta poco para finalizar!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🏠 Las Acacias Refugio</h1>
              <p style="color: #a7f3d0; margin: 10px 0 0 0; font-size: 16px;">¡Falta poco para finalizar tu reserva!</p>
            </div>
            <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="background-color: #d1fae5; border: 2px solid #059669; border-radius: 50%; width: 80px; height: 80px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                  <span style="font-size: 40px; color: #059669;">⏳</span>
                </div>
                <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">Pre-Reserva Recibida</h2>
                <p style="color: #6b7280; margin: 0; font-size: 16px;">¡Hola ${reservation.guestName}! Hemos recibido tu solicitud de reserva.</p>
                <p style="color: #059669; margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">¡Falta poco para finalizar tu reserva!</p>
              </div>
              
              <!-- MARCO ROJO CON RECORDATORIO -->
              <div style="background-color: #fef2f2; border: 3px solid #dc2626; padding: 20px; border-radius: 10px; margin-bottom: 30px; text-align: center;">
                <div style="display: inline-flex; align-items: center; justify-content: center; background-color: #dc2626; color: white; border-radius: 50%; width: 50px; height: 50px; margin-bottom: 15px;">
                  <span style="font-size: 24px;">⚠️</span>
                </div>
                <h3 style="color: #dc2626; margin: 0 0 10px 0; font-size: 18px; font-weight: bold;">¡IMPORTANTE!</h3>
                <p style="color: #dc2626; margin: 0; font-size: 16px; font-weight: bold; line-height: 1.4;">Recordá que tenés 24 hs para enviar el monto de reservación y enviarnos el comprobante para confirmar su estadía!</p>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 30px;">
                <h3 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">📋 Detalles de tu Reserva</h3>
                <p><strong>Cabaña:</strong> ${cabin.name}</p>
                <p><strong>Fechas:</strong> ${new Date(reservation.checkIn).toLocaleDateString('es-ES')} - ${new Date(reservation.checkOut).toLocaleDateString('es-ES')}</p>
                <p><strong>Huéspedes:</strong> ${reservation.guestCount} personas</p>
                <p><strong>Total a pagar:</strong> $${reservation.totalPrice}</p>
              </div>
              
              <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 25px; border-radius: 10px; margin-bottom: 30px;">
                <h3 style="color: #92400e; margin: 0 0 20px 0; font-size: 20px;">💳 Datos para Transferencia Bancaria</h3>
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
                  <p style="margin: 5px 0;"><strong>Alias:</strong> lasacaciasrefugio</p>
                  <p style="margin: 5px 0;"><strong>Banco:</strong> Santander</p>
                  <p style="margin: 5px 0;"><strong>Titular:</strong> Isla Analia Elizabeth</p>
                  <p style="margin: 5px 0;"><strong>CUIT/CUIL:</strong> 27-22539871-8</p>
                </div>
                <p style="color: #92400e; margin: 0; font-size: 14px; font-style: italic;">Por favor, realiza la transferencia por el monto total y envíanos el comprobante por WhatsApp.</p>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px;">📞 Contacto</h3>
                <p style="color: #4b5563; margin: 0 0 10px 0;">Una vez realizada la transferencia, contáctanos para confirmar tu reserva:</p>
                <p style="color: #1e40af; margin: 0; font-weight: bold;">WhatsApp: +54 3548631824</p>
              </div>
              
              <div style="text-align: center; padding: 20px; background-color: #f3f4f6; border-radius: 10px;">
                <p style="color: #6b7280; margin: 0; font-size: 14px;">¡Gracias por elegir Las Acacias Refugio! Esperamos recibirte pronto.</p>
              </div>
            </div>
          </div>
        `
      };
  
      const info = await this.emailTransporter.sendMail(mailOptions);
      console.log('✅ Email de pre-reserva enviado:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email de pre-reserva:', error);
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