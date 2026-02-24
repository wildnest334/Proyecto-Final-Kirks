require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./db.js');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago'); // Movido arriba

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


app.post('/api/crear-pago', async (req, res) => {
    try {
        const { nombreProducto, precio, usuario } = req.body;
        const preference = new Preference(client);
        
        const result = await preference.create({
            body: {
                items: [
                    {
                        title: nombreProducto,
                        quantity: 1,
                        unit_price: Number(precio),
                        currency_id: 'MXN'
                    }
                ],
                back_urls: {
                    success: `http://localhost:4000/index.html?pago=exitoso&user=${usuario}&prod=${nombreProducto}&price=${precio}`,
                    failure: "http://localhost:4000/index.html?pago=fallido",
                },
                auto_return: "approved",
            }
        });

        res.json({ init_point: result.init_point });
    } catch (error) {
        console.error("Error Mercado Pago:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/productos/vender', async (req, res) => {
  try {
      const { usuario, producto, precio, cantidad } = req.body;
      
      console.log(`Venta: ${producto} | Cantidad: ${cantidad} | Usuario: ${usuario}`);

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

// CONTACTO
app.post('/api/contacto', async (req, res) => {
    try {
        const nuevoMensaje = new Mensaje(req.body);
        await nuevoMensaje.save();
        res.status(200).json({ success: true, msj: "¡Mensaje guardado!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// REGISTRO
app.post('/api/usuarios/registro', async (req, res) => {
    try {
        const nuevoUsuario = new Usuario(req.body);
        await nuevoUsuario.save();
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// LOGIN
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

// FAVORITOS
app.post('/api/favoritos', async (req, res) => {
    try {
        console.log("Favorito recibido:", req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS ---
const publicPath = path.join(__dirname, '..', 'front-end');
app.use(express.static(publicPath));

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(` Servidor profesional corriendo en: http://localhost:${PORT}`);
});
