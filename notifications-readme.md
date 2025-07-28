# 🔔 Sistema de Notificaciones - Las Acacias Refugio

## 📧 Email + 📱 SMS

### **Funcionalidades:**
- **Email automático** cuando se crea una reserva desde la plataforma
- **SMS automático** cuando se crea una reserva desde la plataforma
- **Solo para reservas de PLATFORM** (no para CALENDAR)

## ⚙️ Configuración

### **1. Email (Gmail)**
```bash
# Variables en .env
EMAIL_USER="joakhaidar@gmail.com"
EMAIL_PASSWORD="tu_app_password_de_gmail"
ADMIN_EMAIL="analia@lasacacias.com"
```

### **2. SMS (Twilio)**
```bash
# Variables en .env
TWILIO_ACCOUNT_SID="tu_account_sid"
TWILIO_AUTH_TOKEN="tu_auth_token"
TWILIO_PHONE_NUMBER="tu_numero_de_twilio"
ADMIN_SMS="+543548507646"
```

## 🧪 Probar Notificaciones

### **Probar Email:**
```bash
node test-email.js
```

### **Probar SMS:**
```bash
node test-sms.js
```

### **Probar Notificaciones Completas:**
```bash
node test-reservation-notification.js
```

### **Diagnosticar SMS:**
```bash
node debug-sms.js
```

## 📱 Mensaje de SMS que recibirás:

```
🏠 NUEVA RESERVA - Las Acacias Refugio

📋 Detalles:
• Huésped: Juan Pérez
• Cabaña: Cabaña Turquesa
• Fechas: 15/8/2025 - 17/8/2025
• Huéspedes: 2
• Total: $15000
• Teléfono: +543548507646
• Email: juan@example.com

💻 Creada desde la plataforma web
🕐 15/8/2025, 14:30:25
```

## 📧 Email HTML que recibirás:
- **Diseño profesional** con colores
- **Tabla organizada** con todos los datos
- **Información completa** de la reserva
- **Indicador** de que viene de la plataforma

## 🔔 ¿Cuándo se envían?
- **Solo** cuando `channel: 'PLATFORM'` (reservas del frontend)
- **NO** cuando `channel: 'CALENDAR'` (reservas del panel admin)

## 💡 Notas:
- **Email**: Funciona con cualquier cuenta de Gmail
- **SMS**: Requiere cuenta de Twilio (200 SMS gratis/mes)
- **Ambas notificaciones** se envían automáticamente
- **No falla la reserva** si hay error en notificaciones 