const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Esta ruta será: http://localhost:4000/api/auth/login
// Recibe el correo y password, y regresa el Token si todo está bien.
router.post('/login', authController.login);

// Ruta para Registro de Usuarios
router.post('/register', authController.register);
module.exports = router;