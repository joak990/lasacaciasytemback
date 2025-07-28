const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  console.log('📧 Probando configuración de email...');
  
  // Verificar variables de entorno
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Error: EMAIL_USER o EMAIL_PASSWORD no están configurados');
    console.log('📝 Crea un archivo .env con:');
    console.log('EMAIL_USER="joakhaidar@gmail.com"');
    console.log('EMAIL_PASSWORD="remmxsqyhyknrwpd"');
    console.log('ADMIN_EMAIL="analia@lasacacias.com"');
    return;
  }

  // Crear transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  // Email de prueba
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL || 'analia@lasacacias.com',
    subject: '🧪 Prueba de Email - Las Acacias Sistema',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb; text-align: center;">✅ Email de Prueba</h2>
        <p>Este es un email de prueba para verificar que la configuración funciona correctamente.</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
        <p>Si recibes este email, la configuración está funcionando correctamente.</p>
      </div>
    `
  };

  try {
    console.log('📤 Enviando email de prueba...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email enviado exitosamente!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Revisa tu bandeja de entrada');
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    if (error.code === 'EAUTH') {
      console.log('💡 Verifica que tu App Password sea correcta');
    }
  }
}

testEmail(); 