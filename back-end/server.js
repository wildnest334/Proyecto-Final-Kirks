require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./db.js');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const Usuario = require('./models/Usuario');
const ProductoVendido = require('./models/ProductoVendido');
const ServicioContratado = require('./models/ServicioContratado'); 
const Mensaje = require('./models/Mensaje');

const app = express();
const PORT = process.env.PORT || 4000;

connectDB();
app.use(cors());
app.use(express.json());

const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-6721XXXXXXXXX-XXXXXX-XXXXXXXXX' 
});

// --- RUTA NUEVA: CONTRATAR SERVICIOS ---
// Esta es la pieza que faltaba para evitar el Error 404
app.post('/api/servicios/contratar', async (req, res) => {
    try {
        const { usuario, tipoServicio, precio } = req.body;
        
        console.log(`Servicio: ${tipoServicio} | Usuario: ${usuario}`);

        const nuevoServicio = new ServicioContratado({
            usuario: usuario,
            tipoServicio: tipoServicio,
            precio: precio,
            fecha: new Date()
        });

        await nuevoServicio.save();
        res.status(201).json({ success: true, msj: "Servicio guardado en servicioscontratados" });
    } catch (error) {
        console.error("Error en servicios:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- RUTA: VENDER PRODUCTOS (Ya la tenías) ---
app.post('/api/productos/vender', async (req, res) => {
  try {
      const { usuario, producto, precio, cantidad } = req.body;
      const nuevaVenta = new ProductoVendido({
          usuario: usuario,
          nombreProducto: producto,
          precio: precio,
          cantidad: cantidad || 1, 
          total: precio * (cantidad || 1), 
          fecha: new Date()
      });
      await nuevaVenta.save();
      res.status(201).json({ success: true });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
  }
});

// --- EL RESTO DE TUS RUTAS (LOGIN, REGISTRO, ETC) ---

app.post('/api/usuarios/registro', async (req, res) => {
    try {
        const nuevoUsuario = new Usuario(req.body);
        await nuevoUsuario.save();
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/usuarios/login', async (req, res) => {
    try {
        const { correo, password } = req.body;
        const usuarioEncontrado = await Usuario.findOne({ correo });
        if (!usuarioEncontrado || usuarioEncontrado.password !== password) {
            return res.status(401).json({ success: false, error: "Credenciales incorrectas" });
        }
        res.json({ success: true, nombre: usuarioEncontrado.nombreUsuario });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// --- CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS ---
const publicPath = path.join(__dirname, '..', 'front-end');
app.use(express.static(publicPath));

// Mover el comodín (.*) al final de las rutas de API
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(` Servidor profesional corriendo en: http://localhost:${PORT}`);
});
