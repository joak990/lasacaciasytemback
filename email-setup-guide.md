# 📧 Configuración de Email - Gmail

## Paso 1: Habilitar 2-Factor Authentication
1. Ve a tu cuenta de Google
2. Security → 2-Step Verification → Turn On
3. Configura tu teléfono

## Paso 2: Crear App Password
1. Ve a Google Account Settings
2. Security → 2-Step Verification → App passwords
3. Selecciona "Mail" y "Other (Custom name)"
4. Escribe "Las Acacias Sistema"
5. Copia la contraseña generada (16 caracteres)

## Paso 3: Configurar variables de entorno
Crea un archivo `.env` en la carpeta `backend/`:

```bash
# Email Configuration
EMAIL_USER="lasacaciasrefugio@gmail.com"
EMAIL_PASSWORD="tu_app_password_aqui"
ADMIN_EMAIL="analia@lasacacias.com"
```

## Paso 4: Probar configuración
```bash
node setup-notifications.js
```

## ⚠️ Importante
- NO uses tu contraseña normal de Gmail
- Usa SOLO la App Password generada
- La App Password es de 16 caracteres sin espacios 