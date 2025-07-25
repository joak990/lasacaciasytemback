# Sistema de Administración de Cabañas

Un sistema completo para la gestión de reservaciones de cabañas con servicios adicionales, construido con Node.js, Express, Prisma, PostgreSQL y Next.js.

## 🏗️ Arquitectura

- **Backend:** Node.js + Express + Prisma + PostgreSQL
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Base de Datos:** PostgreSQL con Docker
- **UI:** Calendario tipo Cloudbeds

## 🏗️ Características

- **Gestión de Usuarios**: Registro, login y perfiles de usuarios
- **Gestión de Cabañas**: CRUD completo con disponibilidad y precios
- **Sistema de Reservaciones**: Creación, modificación y cancelación de reservas
- **Servicios Adicionales**: Agregar servicios como bebidas, comidas, actividades, etc.
- **Estadísticas**: Reportes de reservaciones y uso de servicios
- **API RESTful**: Endpoints completos para todas las funcionalidades
- **Base de Datos PostgreSQL**: Con Prisma como ORM
- **Docker**: Contenedores para base de datos y pgAdmin

## 🚀 Instalación

### Prerrequisitos

- Node.js (v16 o superior)
- Docker y Docker Compose
- npm o yarn

### Pasos de Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd cabinsystem
   ```

2. **Configurar el Backend**
   ```bash
   # Instalar dependencias del backend
   npm install
   
   # Configurar variables de entorno
   cp .env.example .env
   ```

3. **Levantar la base de datos**
   ```bash
   npm run docker:up
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

4. **Iniciar el Backend**
   ```bash
   npm run dev
   ```

5. **Configurar el Frontend**
   ```bash
   cd frontend
   npm install
   cp env.local.example .env.local
   ```

6. **Iniciar el Frontend**
   ```bash
   npm run dev
   ```

## 🌐 URLs de Acceso

- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000/api
- **pgAdmin:** http://localhost:5050 (admin@cabinsystem.com / admin123)

## 🐳 Docker

### Levantar servicios
```bash
npm run docker:up
```

### Detener servicios
```bash
npm run docker:down
```

### Reconstruir contenedores
```bash
npm run docker:build
```

## 📊 Base de Datos

### Acceso a pgAdmin
- URL: http://localhost:5050
- Email: admin@cabinsystem.com
- Password: admin123

### Configuración de la base de datos
- Host: localhost
- Puerto: 5432
- Base de datos: cabin_system
- Usuario: cabin_user
- Password: cabin_password

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor en modo desarrollo
npm start               # Iniciar servidor en producción

# Base de datos
npm run db:generate     # Generar cliente de Prisma
npm run db:push         # Sincronizar esquema con la base de datos
npm run db:migrate      # Ejecutar migraciones
npm run db:studio       # Abrir Prisma Studio

# Docker
npm run docker:up       # Levantar contenedores
npm run docker:down     # Detener contenedores
npm run docker:build    # Reconstruir contenedores
```

## 📚 API Endpoints

### Usuarios
- `POST /api/users/register` - Registrar nuevo usuario
- `POST /api/users/login` - Iniciar sesión
- `GET /api/users` - Obtener todos los usuarios
- `GET /api/users/:id` - Obtener usuario por ID
- `PUT /api/users/:id` - Actualizar usuario

### Cabañas
- `GET /api/cabins` - Obtener todas las cabañas
- `GET /api/cabins/:id` - Obtener cabaña por ID
- `POST /api/cabins` - Crear nueva cabaña
- `PUT /api/cabins/:id` - Actualizar cabaña
- `DELETE /api/cabins/:id` - Eliminar cabaña
- `GET /api/cabins/:id/availability` - Verificar disponibilidad

### Servicios
- `GET /api/services` - Obtener todos los servicios
- `GET /api/services/:id` - Obtener servicio por ID
- `POST /api/services` - Crear nuevo servicio
- `PUT /api/services/:id` - Actualizar servicio
- `DELETE /api/services/:id` - Eliminar servicio
- `GET /api/services/categories/list` - Obtener categorías
- `GET /api/services/stats/usage` - Estadísticas de uso

### Reservaciones
- `GET /api/reservations` - Obtener todas las reservaciones
- `GET /api/reservations/:id` - Obtener reservación por ID
- `POST /api/reservations` - Crear nueva reservación
- `PUT /api/reservations/:id` - Actualizar reservación
- `DELETE /api/reservations/:id` - Cancelar reservación
- `POST /api/reservations/:id/services` - Agregar servicios
- `GET /api/reservations/stats/overview` - Estadísticas

## 🗄️ Modelos de Datos

### Usuario (User)
- id, email, password, name, lastName, phone, role, createdAt, updatedAt

### Cabaña (Cabin)
- id, name, description, capacity, price, status, imageUrl, amenities, createdAt, updatedAt

### Servicio (Service)
- id, name, description, price, category, isActive, createdAt, updatedAt

### Reservación (Reservation)
- id, userId, cabinId, checkIn, checkOut, totalPrice, status, guestCount, specialRequests, createdAt, updatedAt

### Servicio de Reservación (ReservationService)
- id, reservationId, serviceId, quantity, price, createdAt

## 🔐 Autenticación

El sistema utiliza JWT (JSON Web Tokens) para la autenticación. Los tokens se generan automáticamente al registrar o hacer login.

### Headers requeridos para endpoints protegidos:
```
Authorization: Bearer <token>
```

## 📝 Ejemplos de Uso

### Crear una reservación con servicios
```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_id",
    "cabinId": "cabin_id",
    "checkIn": "2024-01-15T14:00:00Z",
    "checkOut": "2024-01-17T11:00:00Z",
    "guestCount": 4,
    "specialRequests": "Cuna para bebé",
    "services": [
      {
        "serviceId": "service_id",
        "quantity": 2
      }
    ]
  }'
```

### Agregar servicios a una reservación existente
```bash
curl -X POST http://localhost:3000/api/reservations/reservation_id/services \
  -H "Content-Type: application/json" \
  -d '{
    "services": [
      {
        "serviceId": "service_id",
        "quantity": 1
      }
    ]
  }'
```

## 🛠️ Desarrollo

### Estructura del Proyecto
```
cabinsystem/
├── src/
│   ├── controllers/     # Controladores de la aplicación
│   ├── services/        # Lógica de negocio
│   ├── routes/          # Definición de rutas
│   ├── middleware/      # Middlewares personalizados
│   ├── utils/           # Utilidades y helpers
│   └── index.js         # Punto de entrada
├── prisma/
│   └── schema.prisma    # Esquema de la base de datos
├── database/
│   └── init.sql         # Script de inicialización
├── docker/
├── docker-compose.yml   # Configuración de Docker
└── package.json
```

### Agregar Nuevas Funcionalidades

1. **Crear migración de base de datos**
   ```bash
   npm run db:migrate
   ```

2. **Actualizar esquema de Prisma**
   Editar `prisma/schema.prisma`

3. **Generar cliente actualizado**
   ```bash
   npm run db:generate
   ```

4. **Crear rutas y controladores**
   Seguir el patrón existente en `src/routes/`

## 🧪 Testing

Para ejecutar tests (cuando se implementen):
```bash
npm test
```

## 📦 Despliegue

### Producción
1. Configurar variables de entorno para producción
2. Ejecutar `npm run db:migrate` para aplicar migraciones
3. Iniciar con `npm start`

### Docker Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:
1. Revisar la documentación
2. Verificar los logs del servidor
3. Comprobar la conexión a la base de datos
4. Abrir un issue en el repositorio

## 🔄 Actualizaciones

Para mantener el proyecto actualizado:
```bash
npm update
npm run db:generate
npm run db:migrate
``` 