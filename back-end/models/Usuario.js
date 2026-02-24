const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSchema = new mongoose.Schema({
  nombreUsuario: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  horaRegistro: { type: Date, default: Date.now },
  metodoRegistro: { type: String, enum: ['Formulario', 'Facebook', 'Gmail'], default: 'Formulario' }
});



// Encriptación automática antes de guardar en la DB
UsuarioSchema.pre('save', async function() {
    if (!this.isModified('password')) return;

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        // Al ser una función async, Mongoose sabe que terminó cuando la función acaba.
        // Ya no necesitas llamar a next() forzosamente.
    } catch (error) {
        throw error; // Esto detiene el guardado si hay un error
    }
});

module.exports = mongoose.model('Usuario', UsuarioSchema);