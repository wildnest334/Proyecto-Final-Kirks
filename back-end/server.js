require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./db.js');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middlewares/authMiddleware');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const Usuario = require('./models/Usuario');
const ProductoVendido = require('./models/ProductoVendido');
const ServicioContratado = require('./models/ServicioContratado');
const Mensaje = require('./models/Mensaje');
const Producto = require('./models/Producto'); 

const app = express();
const PORT = process.env.PORT || 4000;

connectDB();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);



// MIDDLEWARE: verificar que el usuario es ADMIN

function soloAdmin(req, res, next) {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: 'Sin token, acceso denegado' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ msg: 'Acceso denegado: no eres admin' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token inválido' });
    }
}

// ================================================
// LOGIN — devuelve role para que el frontend sepa
// ================================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { correo, password } = req.body;
        const usuario = await Usuario.findOne({ correo });

        if (!usuario) {
            return res.status(401).json({ msg: 'Credenciales incorrectas' });
        }

        const bcrypt = require('bcryptjs');
        const passwordValido = await bcrypt.compare(password, usuario.password);
        if (!passwordValido) {
            return res.status(401).json({ msg: 'Credenciales incorrectas' });
        }

        // Generar token con role incluido
        const token = jwt.sign(
            { id: usuario._id, role: usuario.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            nombre: usuario.nombreUsuario,
            role: usuario.role  // ← el frontend guarda esto en localStorage
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error del servidor' });
    }
});

// ================================================
// CRUD DE PRODUCTOS (solo admin puede crear/editar/borrar)
// ================================================

// GET — obtener todos los productos (cualquiera puede ver)
app.get('/api/productos', async (req, res) => {
    try {
        const productos = await Producto.find().sort({ createdAt: -1 });
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST — agregar producto (solo admin)
app.post('/api/productos', soloAdmin, async (req, res) => {
    try {
        const { title, price, cat, tags, desc, img } = req.body;
        const nuevo = new Producto({ title, price, cat, tags, desc, img });
        await nuevo.save();
        res.status(201).json({ success: true, producto: nuevo });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT — editar producto (solo admin)
app.put('/api/productos/:id', soloAdmin, async (req, res) => {
    try {
        const actualizado = await Producto.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!actualizado) return res.status(404).json({ msg: 'Producto no encontrado' });
        res.json({ success: true, producto: actualizado });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE — borrar producto (solo admin)
app.delete('/api/productos/:id', soloAdmin, async (req, res) => {
    try {
        await Producto.findByIdAndDelete(req.params.id);
        res.json({ success: true, msg: 'Producto eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ================================================
// RUTAS EXISTENTES (sin cambios)
// ================================================

app.post('/api/servicios/contratar', authMiddleware, async (req, res) => {
    try {
        const { usuario, tipoServicio, precio } = req.body;
        const nuevoServicio = new ServicioContratado({
            usuario,
            tipoServicio,
            precio,
            fecha: new Date()
        });
        await nuevoServicio.save();
        res.status(201).json({ success: true, msj: 'Servicio guardado' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/productos/vender', authMiddleware, async (req, res) => {
    try {
        const { usuario, producto, precio, cantidad } = req.body;
        const nuevaVenta = new ProductoVendido({
            usuario,
            nombreProducto: producto,
            precio,
            cantidad: cantidad || 1,
            total: precio * (cantidad || 1),
            fecha: new Date()
        });
        await nuevaVenta.save();
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/contacto', async (req, res) => {
    try {
        const nuevoMensaje = new Mensaje(req.body);
        await nuevoMensaje.save();
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/crear-sesion-stripe', async (req, res) => {
    try {
        const { items, usuario } = req.body; // Recibimos el usuario del frontend

        // 1. Guardar el registro en MongoDB Atlas (Colección productovendidos)
        for (const item of items) {
            const nuevaVenta = new ProductoVendido({
                usuario: usuario || "Invitado",
                nombreProducto: item.title,
                precio: Number(item.price),
                cantidad: item.cantidad,
                total: Number(item.price) * item.cantidad,
                fecha: new Date()
            });
            await nuevaVenta.save();
        }

        // 2. Crear la sesión de Stripe
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'mxn',
                product_data: { name: item.title },
                unit_amount: Math.round(Number(item.price) * 100), 
            },
            quantity: item.cantidad,
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: 'http://localhost:4000/exito.html',
            cancel_url: 'http://localhost:4000/carrito.html',
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("Error en Stripe/DB:", error);
        res.status(500).json({ error: 'Error al procesar la compra' });
    }
});

// Archivos estáticos
const publicPath = path.join(__dirname, '..', 'front-end');
app.use(express.static(publicPath));

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
});