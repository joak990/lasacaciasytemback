const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Datos inválidos',
      details: errors.array() 
    });
  }
  next();
};

// POST /api/auth/login - Login de usuario
router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔍 Login attempt for email:', email);

    // Buscar usuario por email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      console.log('❌ Login failed - User not found');
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('❌ Login failed - Invalid password');
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    // Generar JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name,
        lastName: user.lastName
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for user:', user.email);

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/auth/me - Verificar token y obtener datos del usuario
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' });
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

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Token verification error:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
});

// POST /api/auth/logout - Logout (opcional, ya que el token se maneja en el frontend)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout exitoso' });
});

module.exports = router; 