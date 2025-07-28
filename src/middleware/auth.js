const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Middleware para verificar autenticación
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = authHeader.substring(7);
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Buscar usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    // Agregar información del usuario al request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar si es admin (opcional)
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin
}; 