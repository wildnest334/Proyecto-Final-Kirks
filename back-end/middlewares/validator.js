const { body, validationResult } = require('express-validator');

exports.validateRegister = [
    body('username').isLength({ min: 5 }).withMessage('El usuario debe tener al menos 5 caracteres'),
    body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];