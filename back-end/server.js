require('dotenv').config();
const express = require('express');
const path = require('path'); // Importante para manejar rutas de carpetas
const app = express();
// const connectDB = require('./db.js'); // Importar la conexión a la base de datos
const PORT = 4000;


app.use(express.json()); // Middleware para parsear JSON

const publicPath = path.join(__dirname, '..', 'front-end');
app.use(express.static(publicPath));


app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor ejecutando en http://localhost:${PORT}`);
});