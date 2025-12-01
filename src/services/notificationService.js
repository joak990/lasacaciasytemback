const nodemailer = require('nodemailer');
const axios = require('axios');
const smsService = require('./smsService');
const pdfService = require('./pdfService');
const prisma = require('../utils/prisma');
const crypto = require('crypto');

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.initEmailService();
  }

  // Inicializar servicio de email
  initEmailService() {
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    const brevoApiKey = process.env.BREVO_API_KEY;
    
    // Detectar qué método de email se usará
    if (brevoApiKey) {
      console.log('✅ Brevo API configurado - se usará para envío de emails (recomendado para Render)');
    } else if (emailUser && emailPassword) {
      console.log('✅ Gmail SMTP configurado - se usará para envío de emails');
      console.warn('⚠️ Nota: SMTP puede tener problemas en Render. Considera usar Brevo API.');
    } else {
      console.warn('⚠️ EMAIL_USER o EMAIL_PASSWORD no están configurados en las variables de entorno');
      console.warn('⚠️ BREVO_API_KEY tampoco está configurado');
      console.warn('⚠️ Los emails no se podrán enviar hasta que se configuren estas variables');
    }
    
    // Configuración SMTP de Gmail optimizada para Render
    // Probar primero con puerto 465 (SMTPS) que es más común en plataformas cloud
    // Si falla, intentaremos con 587 (STARTTLS)
    const smtpConfig = {
      host: 'smtp.gmail.com',
      port: 465, // Usar puerto 465 (SMTPS) que funciona mejor en Render
      secure: true, // true para puerto 465, requiere SSL desde el inicio
      auth: {
        user: emailUser || 'notificationsacaciasrefugio@gmail.com',
        pass: emailPassword || 'tu_app_password'
      },
      // Timeouts aumentados para Render (conexiones más lentas)
      connectionTimeout: 60000, // 60 segundos para establecer conexión
      greetingTimeout: 30000, // 30 segundos para saludo SMTP
      socketTimeout: 60000, // 60 segundos de timeout de socket
      // Opciones adicionales para Render
      pool: false, // No usar pool de conexiones
      maxConnections: 1,
      maxMessages: 1,
      requireTLS: true,
      tls: {
        // No rechazar certificados no autorizados (necesario para Render)
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      // Opciones de debug (solo en desarrollo)
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    };
    
    this.emailTransporter = nodemailer.createTransport(smtpConfig);
    
    // Verificar conexión al inicializar (sin await, corre en background)
    this.verifyConnection().catch(err => {
      // Ya se maneja el error en verifyConnection
    });
  }
  
  // Crear transporter con configuración específica
  createTransporter(port, secure) {
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: port,
      secure: secure,
      auth: {
        user: emailUser || 'notificationsacaciasrefugio@gmail.com',
        pass: emailPassword || 'tu_app_password'
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      pool: false,
      maxConnections: 1,
      maxMessages: 1,
      requireTLS: !secure, // Solo para STARTTLS (puerto 587)
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    });
  }

  // Verificar conexión del transporter con timeout
  async verifyConnection() {
    try {
      // Timeout de verificación aumentado a 30 segundos para Render
      const verifyPromise = this.emailTransporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout verificando conexión SMTP')), 30000)
      );
      
      await Promise.race([verifyPromise, timeoutPromise]);
      console.log('✅ Servicio de email configurado correctamente (puerto 465)');
    } catch (error) {
      console.error('❌ Error verificando conexión de email:', error.message);
      console.error('📋 Detalles del error:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
      
      if (error.code === 'EAUTH') {
        console.error('❌ Error de autenticación - Verifica EMAIL_USER y EMAIL_PASSWORD');
      } else if (error.code === 'ETIMEDOUT' || error.message.includes('Timeout')) {
        console.error('⚠️ Timeout conectando a Gmail SMTP en puerto 465.');
        console.error('⚠️ Los emails se intentarán enviar de todas formas cuando se requieran.');
        console.error('💡 Si el problema persiste, Render podría estar bloqueando conexiones SMTP salientes.');
      } else if (error.code === 'ECONNREFUSED') {
        console.error('❌ Conexión rechazada - El puerto 465 podría estar bloqueado en Render.');
        console.error('💡 Considera verificar la configuración de red de Render.');
      }
    }
  }

  // Método para enviar email usando Brevo API (HTTP - funciona en Render)
  async sendMailWithBrevo(mailOptions) {
    const brevoApiKey = process.env.BREVO_API_KEY;
    
    if (!brevoApiKey) {
      throw new Error('BREVO_API_KEY no configurado');
    }

    try {
      console.log('📧 Enviando email con Brevo API...');
      
      // Convertir HTML a texto plano básico (para el campo text)
      const textContent = mailOptions.html
        .replace(/<[^>]*>/g, '') // Remover HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .substring(0, 500); // Limitar longitud

      const brevoPayload = {
        sender: {
          name: 'Las Acacias Refugio',
          email: process.env.EMAIL_USER || mailOptions.from || 'notificationsacaciasrefugio@gmail.com'
        },
        to: [
          {
            email: mailOptions.to,
            name: mailOptions.to.split('@')[0] // Nombre básico del email
          }
        ],
        subject: mailOptions.subject,
        htmlContent: mailOptions.html,
        textContent: textContent
      };

      // Agregar replyTo si existe
      if (mailOptions.replyTo) {
        brevoPayload.replyTo = {
          email: mailOptions.replyTo
        };
      }

      // Agregar attachments si existen
      if (mailOptions.attachments && mailOptions.attachments.length > 0) {
        brevoPayload.attachments = mailOptions.attachments.map(att => ({
          name: att.filename || att.contentType || 'attachment',
          content: typeof att.content === 'string' 
            ? att.content 
            : (att.content instanceof Buffer 
                ? att.content.toString('base64') 
                : Buffer.from(att.content).toString('base64'))
        }));
      }

      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        brevoPayload,
        {
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000 // 30 segundos timeout
        }
      );

      console.log('✅ Email enviado exitosamente con Brevo:', response.data.messageId);
      return {
        messageId: response.data.messageId || `brevo-${Date.now()}`,
        accepted: [mailOptions.to],
        rejected: []
      };
    } catch (error) {
      console.error('❌ Error enviando email con Brevo:', error.response?.data || error.message);
      if (error.response) {
        console.error('📋 Detalles:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    }
  }

  // Método helper para enviar email con fallback automático (Brevo -> SMTP 465 -> SMTP 587)
  async sendMailWithFallback(mailOptions) {
    // 1. Intentar primero con Brevo si está configurado (mejor opción para Render)
    if (process.env.BREVO_API_KEY) {
      try {
        console.log('📧 Intentando envío con Brevo API...');
        return await this.sendMailWithBrevo(mailOptions);
      } catch (errorBrevo) {
        console.warn('⚠️ Falló envío con Brevo:', errorBrevo.message);
        console.log('📧 Intentando fallback con SMTP...');
        // Continuar con fallback SMTP
      }
    }

    // 2. Fallback a SMTP (solo si Brevo no está configurado o falló)
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    
    if (!emailUser || !emailPassword) {
      throw new Error('EMAIL_USER o EMAIL_PASSWORD no configurados (y Brevo no disponible)');
    }

    // Intentar primero con puerto 465 (SMTPS)
    try {
      console.log('📧 Intentando envío con puerto 465 (SMTPS)...');
      const transporter465 = this.createTransporter(465, true);
      const sendPromise = transporter465.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout en puerto 465')), 60000)
      );
      
      const info = await Promise.race([sendPromise, timeoutPromise]);
      console.log('✅ Email enviado exitosamente con puerto 465');
      return info;
    } catch (error465) {
      console.warn('⚠️ Falló envío con puerto 465:', error465.message);
      console.log('📧 Intentando fallback con puerto 587 (STARTTLS)...');
      
      // Fallback a puerto 587 (STARTTLS)
      try {
        const transporter587 = this.createTransporter(587, false);
        const sendPromise = transporter587.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout en puerto 587')), 60000)
        );
        
        const info = await Promise.race([sendPromise, timeoutPromise]);
        console.log('✅ Email enviado exitosamente con puerto 587 (fallback)');
        return info;
      } catch (error587) {
        console.error('❌ Todos los métodos fallaron. Último error:', error587.message);
        console.error('📋 Error Brevo:', process.env.BREVO_API_KEY ? 'Intentado' : 'No configurado');
        console.error('📋 Error puerto 465:', error465.code || error465.message);
        console.error('📋 Error puerto 587:', error587.code || error587.message);
        throw error587; // Lanzar el último error
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
        from: process.env.EMAIL_USER || 'notificationsacaciasrefugio@gmail.com',
        to: process.env.ADMIN_EMAIL || 'lasacaciasrefugio@gmail.com',
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
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Desayuno:</td>
                  <td style="padding: 8px 0; color: #6b7280;">${reservation.isBreakfast ? '✅ Incluido' : '❌ No incluido'}</td>
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
      const info = await this.sendMailWithFallback(mailOptions);
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
      
      // Usar método con fallback automático (puerto 465 -> 587)
      const info = await this.sendMailWithFallback(mailOptions);
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
      console.log('📧 Email destinatario:', reservation.guestEmail);
      
      // Usar método con fallback automático (puerto 465 -> 587)
      const info = await this.sendMailWithFallback(mailOptions);
      console.log('✅ Email de cancelación enviado:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email de cancelación:', error.message);
      console.error('📋 Detalles del error:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        stack: error.stack
      });
      
      if (error.code === 'EAUTH') {
        console.error('❌ Error de autenticación Gmail - Verifica que EMAIL_PASSWORD sea una contraseña de aplicación válida');
      } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        console.error('❌ Error de conexión - Render podría estar bloqueando conexiones SMTP salientes');
        console.error('💡 Posibles soluciones:');
        console.error('   1. Verifica que Render permita conexiones salientes al puerto 465');
        console.error('   2. Considera usar un servicio de email como SendGrid, Mailgun o Resend');
        console.error('   3. Verifica que las variables EMAIL_USER y EMAIL_PASSWORD estén correctas en Render');
      }
      console.error('❌ Error completo:', error);
      return false;
    }
  }

  // Generar link temporal de pre-checkin
  async generatePreCheckInLink(reservationId) {
    try {
      // Verificar si ya existe un link válido
      const existingLink = await prisma.preCheckInLink.findUnique({
        where: { reservationId },
      });

      if (existingLink) {
        const now = new Date();
        if (existingLink.expiresAt > now && !existingLink.isUsed) {
          // Link válido existente
          const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
          return `${baseUrl}/precheckin/${existingLink.token}`;
        }
      }

      // Generar nuevo token único
      const token = crypto.randomBytes(32).toString('hex');
      
      // Link expira en 7 días
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      // Crear o actualizar el link
      const preCheckInLink = await prisma.preCheckInLink.upsert({
        where: { reservationId },
        update: {
          token,
          expiresAt,
          isUsed: false,
          usedAt: null
        },
        create: {
          reservationId,
          token,
          expiresAt
        }
      });
      
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return `${baseUrl}/precheckin/${preCheckInLink.token}`;
    } catch (error) {
      console.error('❌ Error generando link de pre-checkin:', error);
      return null;
    }
  }

  async sendGuestConfirmationEmail(reservation, cabin) {
    try {
      console.log('📧 Enviando email de pre-reserva al huésped...');
      
      // Generar link de pre-checkin
      let preCheckInLink = null;
      if (reservation.guestCount > 1) {
        console.log('🔗 Generando link de pre-checkin...');
        preCheckInLink = await this.generatePreCheckInLink(reservation.id);
        if (preCheckInLink) {
          console.log('✅ Link de pre-checkin generado:', preCheckInLink);
        } else {
          console.warn('⚠️ No se pudo generar el link de pre-checkin');
        }
      }
      
      
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
  
      const info = await this.sendMailWithFallback(mailOptions);
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