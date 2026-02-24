const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
    try {
        const { correo, password } = req.body; 
        
        // Buscamos exactamente por el campo 'correo' que se ve en la captura
        const user = await Usuario.findOne({ correo });
        if (!user) return res.status(404).json({ msg: "Usuario no existe" });

        // IMPORTANTE: Bcrypt fallará con el usuario "mauricio" de la captura 
        // porque su password no está encriptado todavía.
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Contraseña incorrecta" });

        const token = jwt.sign(
            { id: user._id, role: user.role || 'user' }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' }
        );

        res.json({ 
            token, 
            user: { 
                id: user._id, 
                nombreUsuario: user.nombreUsuario, 
                role: user.role || 'user' 
            } 
        });
    } catch (error) {
        res.status(500).json({ msg: "Error en el servidor" });
    }
};

exports.register = async (req, res) => {
    try {
        const { nombreUsuario, correo, password, role } = req.body;
        
        // Creamos el usuario (Bcrypt en el modelo se encarga de la contraseña)
        const nuevoUsuario = new Usuario({ nombreUsuario, correo, password, role });
        await nuevoUsuario.save();

        // Generamos token de una vez
        const token = jwt.sign(
            { id: nuevoUsuario._id, role: nuevoUsuario.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' }
        );

        res.status(201).json({ success: true, token });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};