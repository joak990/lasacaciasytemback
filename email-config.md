# Configuración de Emails - Las Acacias Refugio

## Variables de Entorno Requeridas

Asegúrate de que las siguientes variables estén configuradas en tu archivo `.env`:

```env
# Email Configuration (Gmail)
EMAIL_USER="lasacaciasrefugio@gmail.com"
EMAIL_PASSWORD="tu_app_password_de_gmail"
ADMIN_EMAIL="analia@lasacacias.com"

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID="tu_twilio_account_sid"
TWILIO_AUTH_TOKEN="tu_twilio_auth_token"
TWILIO_PHONE_NUMBER="+1234567890"
ADMIN_SMS="+543548507646"
```

## Configuración de Gmail

Para usar Gmail como servidor de emails, necesitas:

1. **Habilitar la verificación en dos pasos** en tu cuenta de Gmail
2. **Generar una contraseña de aplicación**:
   - Ve a Configuración de Google Account
   - Seguridad
   - Verificación en dos pasos
   - Contraseñas de aplicación
   - Genera una nueva contraseña para "Mail"

## Flujo de Notificaciones

Cuando se crea una reserva desde la plataforma web:

1. **Email**: Se envía automáticamente a `ADMIN_EMAIL`
2. **SMS**: Se envía automáticamente a `ADMIN_SMS`
3. **Contenido del email**:
   - Detalles de la reserva
   - Información del huésped
   - Fechas y precios
   - Indicador de que viene de la plataforma web

## Endpoints

- `POST /api/reservations/platform` - Crear reserva con notificaciones
- `POST /api/reservations` - Crear reserva sin notificaciones (panel admin)

## Logs

Los logs mostrarán:
- ✅ Email enviado: [messageId]
- ✅ SMS enviado: [messageId]
- ❌ Error enviando email: [error]
- ❌ Error enviando SMS: [error]

## Testing

Para probar el envío de emails:

1. Crea una reserva desde la plataforma web
2. Verifica los logs del backend
3. Revisa la bandeja de entrada de `ADMIN_EMAIL`
4. Verifica el SMS en `ADMIN_SMS` 