const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Usaremos 'x-auth-token' como estándar para las pruebas en Thunder Client
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ msg: "No hay token, permiso no válido" });
    }

    try {
        const cifrado = jwt.verify(token, process.env.JWT_SECRET);
        req.user = cifrado;
        next();
    } catch (error) {
        res.status(401).json({ msg: "Token no válido" });
    }
};