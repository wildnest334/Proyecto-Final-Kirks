require('dotenv').config();
const express = require('express');
const path = require('path'); // Importante para manejar rutas de carpetas
const app = express();
const session = require('express-session'); // Para manejar sesiones
const connectDB = require('./db.js'); // Importar la conexión a la base de datos
const PORT = 4000;


app.use(express.json()); // Middleware para parsear JSON

const publicPath = path.join(__dirname, 'front-end');
app.use(express.static(publicPath));



app.listen(PORT, () => {
  console.log(`Servidor ejecutando en http://localhost:${PORT}`);
});