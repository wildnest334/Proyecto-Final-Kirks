const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombreUsuario: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  horaRegistro: { type: Date, default: Date.now },
  metodoRegistro: { type: String, enum: ['Formulario', 'Facebook', 'Gmail'], default: 'Formulario' }
});

module.exports = mongoose.model('Usuario', UsuarioSchema);