const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class PDFService {
  constructor() {
    this.logoPath = path.join(__dirname, '../../public/logo.jpg');
  }

  // Generar HTML para el PDF de confirmación
  generateConfirmationHTML(reservation, cabin) {
    const checkInDate = new Date(reservation.checkIn).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const checkOutDate = new Date(reservation.checkOut).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const reservationDate = new Date(reservation.createdAt).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const nights = Math.ceil((new Date(reservation.checkOut) - new Date(reservation.checkIn)) / (1000 * 60 * 60 * 24));

    // Convertir logo a base64
    const logoBase64 = this.getLogoBase64();

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmación de Reserva - Las Acacias Refugio</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8f9fa;
            }
            
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                box-shadow: 0 0 20px rgba(0,0,0,0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #d2691e 0%, #cd853f 100%);
                color: white;
                padding: 40px;
                text-align: center;
                position: relative;
            }
            
            .logo {
                width: 120px;
                height: 120px;
                border-radius: 50%;
                margin: 0 auto 20px;
                display: block;
                border: 4px solid white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            
            .header h1 {
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 10px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            
            .header p {
                font-size: 18px;
                opacity: 0.9;
            }
            
            .content {
                padding: 40px;
            }
            
            .success-badge {
                background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                color: white;
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                margin-bottom: 30px;
                box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
            }
            
            .success-badge h2 {
                font-size: 24px;
                margin-bottom: 10px;
            }
            
            .success-badge p {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .reservation-details {
                background: #f8f9fa;
                border-radius: 12px;
                padding: 30px;
                margin-bottom: 30px;
                border-left: 5px solid #d2691e;
            }
            
            .reservation-details h3 {
                color: #d2691e;
                font-size: 22px;
                margin-bottom: 25px;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 10px;
            }
            
            .details-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .detail-item {
                background: white;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
            }
            
            .detail-label {
                font-size: 12px;
                font-weight: bold;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 5px;
            }
            
            .detail-value {
                font-size: 16px;
                font-weight: 600;
                color: #1f2937;
            }
            
            .price-section {
                background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
                color: white;
                padding: 25px;
                border-radius: 12px;
                text-align: center;
                margin-bottom: 30px;
            }
            
            .price-section h3 {
                font-size: 20px;
                margin-bottom: 15px;
            }
            
            .total-price {
                font-size: 36px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            
            .price-breakdown {
                font-size: 14px;
                opacity: 0.9;
            }
            
            .contact-info {
                background: #f1f5f9;
                padding: 25px;
                border-radius: 12px;
                border-left: 5px solid #3b82f6;
            }
            
            .contact-info h3 {
                color: #1e40af;
                font-size: 20px;
                margin-bottom: 20px;
            }
            
            .contact-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            
            .contact-item {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .contact-icon {
                width: 20px;
                height: 20px;
                background: #3b82f6;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
            }
            
            .footer {
                background: #1f2937;
                color: white;
                padding: 30px;
                text-align: center;
            }
            
            .footer p {
                margin-bottom: 10px;
                opacity: 0.8;
            }
            
            .footer .highlight {
                color: #d2691e;
                font-weight: bold;
            }
            
            .qr-placeholder {
                width: 100px;
                height: 100px;
                background: #e5e7eb;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 20px auto;
                color: #6b7280;
                font-size: 12px;
                text-align: center;
            }
            
            @media print {
                body { background: white; }
                .container { box-shadow: none; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header -->
            <div class="header">
                <img src="${logoBase64}" alt="Las Acacias Refugio" class="logo">
                <h1>Las Acacias Refugio</h1>
                <p>Confirmación de Reserva</p>
            </div>
            
            <!-- Content -->
            <div class="content">
                <!-- Success Badge -->
                <div class="success-badge">
                    <h2>✅ ¡Reserva Confirmada!</h2>
                    <p>Hola ${reservation.guestName} ${reservation.guestLastName}, tu reserva ha sido confirmada exitosamente.</p>
                </div>
                
                <!-- Reservation Details -->
                <div class="reservation-details">
                    <h3>📋 Detalles de tu Reserva</h3>
                    
                    <div class="details-grid">
                        <div class="detail-item">
                            <div class="detail-label">Cabaña</div>
                            <div class="detail-value">${cabin.name}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Capacidad</div>
                            <div class="detail-value">${cabin.capacity} huéspedes</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Check-in</div>
                            <div class="detail-value">${checkInDate}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Check-out</div>
                            <div class="detail-value">${checkOutDate}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Noches</div>
                            <div class="detail-value">${nights} noche${nights > 1 ? 's' : ''}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Huéspedes</div>
                            <div class="detail-value">${reservation.guestCount} persona${reservation.guestCount > 1 ? 's' : ''}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Price Section -->
                <div class="price-section">
                    <h3>💰 Información de Pago</h3>
                    <div class="total-price">$${reservation.totalPrice.toLocaleString('es-ES')}</div>
                    <div class="price-breakdown">
                        ${nights} noche${nights > 1 ? 's' : ''} × $${(reservation.totalPrice / nights).toLocaleString('es-ES')} por noche
                    </div>
                </div>
                
                <!-- Contact Info -->
                <div class="contact-info">
                    <h3>📞 Información de Contacto</h3>
                    <div class="contact-grid">
                        <div class="contact-item">
                            <div class="contact-icon">👤</div>
                            <div>
                                <strong>Huésped:</strong><br>
                                ${reservation.guestName} ${reservation.guestLastName}
                            </div>
                        </div>
                        <div class="contact-item">
                            <div class="contact-icon">📧</div>
                            <div>
                                <strong>Email:</strong><br>
                                ${reservation.guestEmail}
                            </div>
                        </div>
                        <div class="contact-item">
                            <div class="contact-icon">📱</div>
                            <div>
                                <strong>Teléfono:</strong><br>
                                ${reservation.guestPhone}
                            </div>
                        </div>
                        <div class="contact-item">
                            <div class="contact-icon">📅</div>
                            <div>
                                <strong>Reserva creada:</strong><br>
                                ${reservationDate}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- QR Placeholder -->
                <div class="qr-placeholder">
                    Código QR<br>
                    Reserva #${reservation.id.slice(-8).toUpperCase()}
                </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p><strong>Las Acacias Refugio</strong></p>
                <p>📍 Ubicación: [Dirección del refugio]</p>
                <p>📧 Email: lasacaciasrefugio@gmail.com</p>
                <p>📱 Teléfono: [Número de contacto]</p>
                <p class="highlight">¡Gracias por elegirnos! Esperamos brindarte una experiencia inolvidable.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // Convertir logo a base64
  getLogoBase64() {
    try {
      if (fs.existsSync(this.logoPath)) {
        const logoBuffer = fs.readFileSync(this.logoPath);
        return `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;
      } else {
        console.warn('⚠️ Logo no encontrado, usando placeholder');
        return 'data:image/svg+xml;base64,' + Buffer.from(`
          <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="60" fill="#d2691e"/>
            <text x="60" y="70" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">LAS ACACIAS</text>
          </svg>
        `).toString('base64');
      }
    } catch (error) {
      console.error('❌ Error leyendo logo:', error);
      return 'data:image/svg+xml;base64,' + Buffer.from(`
        <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="60" cy="60" r="60" fill="#d2691e"/>
          <text x="60" y="70" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">LAS ACACIAS</text>
        </svg>
      `).toString('base64');
    }
  }

  // Generar PDF de confirmación
  async generateConfirmationPDF(reservation, cabin) {
    let browser;
    try {
      console.log('📄 Generando PDF de confirmación...');
      
      // Lanzar navegador
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Generar HTML
      const html = this.generateConfirmationHTML(reservation, cabin);
      
      // Establecer contenido
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Generar PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="font-size: 10px; text-align: center; width: 100%; color: #666;">
            <span>Las Acacias Refugio - Reserva #${reservation.id.slice(-8).toUpperCase()}</span>
            <span style="float: right;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
          </div>
        `
      });
      
      console.log('✅ PDF generado exitosamente');
      return pdfBuffer;
      
    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Generar PDF y guardarlo temporalmente
  async generateAndSavePDF(reservation, cabin, filename = null) {
    try {
      const pdfBuffer = await this.generateConfirmationPDF(reservation, cabin);
      
      if (filename) {
        const tempPath = path.join(__dirname, '../../temp', filename);
        
        // Crear directorio temp si no existe
        const tempDir = path.dirname(tempPath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        fs.writeFileSync(tempPath, pdfBuffer);
        console.log(`📁 PDF guardado en: ${tempPath}`);
        return { buffer: pdfBuffer, path: tempPath };
      }
      
      return { buffer: pdfBuffer, path: null };
      
    } catch (error) {
      console.error('❌ Error generando y guardando PDF:', error);
      throw error;
    }
  }
}

module.exports = new PDFService();
