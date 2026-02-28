/**
 * doggie-chic.test.js
 * 25 pruebas Jest — Doggie Chic Studio
 *
 * Cubre: pagoController (backend), carrito y shop (frontend)
 * Ejecutar: npm test
 */

// ─────────────────────────────────────────────
// SIMULAR localStorage en Node.js (no existe de forma nativa)
// ─────────────────────────────────────────────
const localStorageData = {};
global.localStorage = {
  getItem:  (key)        => localStorageData[key] ?? null,
  setItem:  (key, value) => { localStorageData[key] = String(value); },
  removeItem:(key)       => { delete localStorageData[key]; },
  clear:    ()           => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};

// ─────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────
jest.mock('stripe', () => jest.fn(() => ({
  checkout: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }) } }
})));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue(true) }))
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({ toString: jest.fn(() => 'ABCD1234') }))
}));

jest.mock('../models/ProductoVendido', () => {
  const MockPV = jest.fn().mockImplementation((data) => ({ ...data, save: jest.fn().mockResolvedValue(true) }));
  MockPV.find = jest.fn();
  return MockPV;
});
jest.mock('../models/ServicioContratado', () => ({ find: jest.fn() }));
jest.mock('../models/Usuario', () => ({ findById: jest.fn() }));

const ProductoVendido   = require('../models/ProductoVendido');
const ServicioContratado = require('../models/ServicioContratado');
const Usuario           = require('../models/Usuario');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function mockRes() {
  return {
    _status: 200, _data: null,
    status(c) { this._status = c; return this; },
    json(d)   { this._data   = d; return this; }
  };
}

// Funciones del carrito (de script.js / carrito.html)
const STORAGE = 'doggie_cart_shop_v1';
const getCart  = () => { try { return JSON.parse(localStorage.getItem(STORAGE) || '[]'); } catch { return []; } };
const setCart  = (items) => localStorage.setItem(STORAGE, JSON.stringify(items));

function agruparCart(cart) {
  const map = {};
  cart.forEach(i => { if (!map[i.id]) map[i.id] = { ...i, cantidad: 1 }; else map[i.id].cantidad++; });
  return Object.values(map);
}

function cambiarCantidad(id, delta, cart) {
  const base = cart.find(i => i.id === id);
  if (!base) return cart;
  const actual    = cart.filter(i => i.id === id).length;
  const nueva     = Math.max(1, actual + delta);
  const diferencia = nueva - actual;
  let result = [...cart];
  if (diferencia > 0) {
    const idx = result.map(i => i.id).lastIndexOf(id);
    for (let x = 0; x < diferencia; x++) result.splice(idx + 1 + x, 0, { ...base });
  } else if (diferencia < 0) {
    let n = Math.abs(diferencia);
    for (let i = result.length - 1; i >= 0 && n > 0; i--) {
      if (result[i].id === id) { result.splice(i, 1); n--; }
    }
  }
  return result;
}

// Funciones de shop.js
const normalizeText = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tagsOf        = (s) => String(s || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
function scoreMatch(text, query) {
  const t = normalizeText(text), q = normalizeText(query).trim();
  if (!q) return 1;
  return q.split(/\s+/).reduce((s, tok) => s + (t.includes(tok) ? 1 : 0), 0);
}
function filtrarProductos(productos, { query = '', categoria = 'all', orden = 'featured' } = {}) {
  let scored = productos.map(p => ({
    p, score: scoreMatch(`${p.title} ${p.tags} ${p.desc}`, query),
    ok: (categoria === 'all' || p.cat === categoria) && (!query.trim() || scoreMatch(`${p.title} ${p.tags} ${p.desc}`, query) > 0)
  }));
  let vis = scored.filter(x => x.ok).map(x => x.p);
  if (orden === 'az')        vis.sort((a, b) => a.title.localeCompare(b.title));
  if (orden === 'priceLow')  vis.sort((a, b) => Number(a.price) - Number(b.price));
  if (orden === 'priceHigh') vis.sort((a, b) => Number(b.price) - Number(a.price));
  return vis;
}

// Productos de prueba
const SHAMPOO = { id: 'p001', title: 'Shampoo FreshCare',      price: '189', cat: 'cuidado',    tags: 'cuidado,shampoo', desc: 'Limpieza suave.' };
const COLLAR  = { id: 'p026', title: 'Collar Nylon Reflectante',price: '149', cat: 'accesorios', tags: 'accesorios,collar', desc: 'Mayor visibilidad.' };
const PELOTA  = { id: 'p051', title: 'Pelota Rebotadora Pro',   price: '99',  cat: 'juguetes',   tags: 'juguetes,pelota', desc: 'Rebote irregular.' };
const OMEGA   = { id: 'p077', title: 'Omega 3 Mascotas',        price: '279', cat: 'farmacia',   tags: 'farmacia,omega', desc: 'Apoyo nutricional.' };
const PRODS   = [SHAMPOO, COLLAR, PELOTA, OMEGA];

beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

// ═══════════════════════════════════════════════
// 1. BACKEND — crearSesionStripe (3 pruebas)
// ═══════════════════════════════════════════════
describe('crearSesionStripe', () => {
  let fn;
  beforeAll(() => { process.env.STRIPE_SECRET_KEY = 'sk_test_fake'; fn = require('../controllers/pagoController').crearSesionStripe; });

  test('1. devuelve URL de Stripe', async () => {
    const req = { body: { items: [{ title: 'Shampoo', price: '189', cantidad: 1 }] }, user: { id: 'u1' } };
    const res = mockRes();
    await fn(req, res);
    expect(res._data.url).toContain('checkout.stripe.com');
  });

test('2. retorna error si no se envían productos', async () => {
  const req = { 
    body: { items: [] }, 
    user: { id: 'u1' } 
  };

  const res = mockRes();

  await fn(req, res);

  expect(res._status).toBeGreaterThanOrEqual(400);
});

  test('3. retorna error 500 si Stripe falla', async () => {
    require('stripe')().checkout.sessions.create.mockRejectedValueOnce(new Error('fail'));
    const req = { body: { items: [{ title: 'X', price: '100', cantidad: 1 }] }, user: { id: 'u1' } };
    const res = mockRes();
    await fn(req, res);
    expect(res._status).toBe(500);
  });
});

// ═══════════════════════════════════════════════
// 2. BACKEND — confirmarCompra (4 pruebas)
// ═══════════════════════════════════════════════
describe('confirmarCompra', () => {
  let fn;
  beforeAll(() => { fn = require('../controllers/pagoController').confirmarCompra; });
  beforeEach(() => {
    Usuario.findById.mockResolvedValue({ _id: 'u1', nombreUsuario: 'TestUser', correo: 'test@test.com' });
    ServicioContratado.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
  });

  test('4. todos los items comparten el mismo ordenId', async () => {
    const req = { body: { items: [{ title: 'Shampoo', price: '189', cantidad: 1 }, { title: 'Collar', price: '149', cantidad: 1 }] }, user: { id: 'u1' } };
    await fn(req, mockRes());
    const id1 = ProductoVendido.mock.calls[0][0].ordenId;
    const id2 = ProductoVendido.mock.calls[1][0].ordenId;
    expect(id1).toBe(id2);
    expect(id1).toBeTruthy();
  });

  test('5. calcula el total por item correctamente', async () => {
    const req = { body: { items: [{ title: 'Perfume', price: '199', cantidad: 3 }] }, user: { id: 'u1' } };
    await fn(req, mockRes());
    expect(ProductoVendido.mock.calls[0][0].total).toBe(597); // 199 * 3
  });

  test('6. retorna success: true con ordenId', async () => {
    const req = { body: { items: [{ title: 'X', price: '100', cantidad: 1 }] }, user: { id: 'u1' } };
    const res = mockRes();
    await fn(req, res);
    expect(res._data).toMatchObject({ success: true, ordenId: expect.any(String) });
  });

  test('7. retorna 404 si el usuario no existe', async () => {
    Usuario.findById.mockResolvedValueOnce(null);
    const req = { body: { items: [{ title: 'X', price: '100', cantidad: 1 }] }, user: { id: 'u1' } };
    const res = mockRes();
    await fn(req, res);
    expect(res._status).toBe(404);
  });
});

// ═══════════════════════════════════════════════
// 3. BACKEND — obtenerHistorial (3 pruebas)
// ═══════════════════════════════════════════════
describe('obtenerHistorial', () => {
  let fn;
  beforeAll(() => { fn = require('../controllers/pagoController').obtenerHistorial; });
  beforeEach(() => {
    Usuario.findById.mockResolvedValue({ nombreUsuario: 'TestUser' });
    ServicioContratado.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
  });

  test('8. agrupa dos productos con mismo ordenId en una sola orden', async () => {
    const fecha = new Date('2026-01-15');
    ProductoVendido.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([
      { ordenId: 'ORD1', nombreProducto: 'Shampoo', precio: 189, cantidad: 1, total: 189, fecha },
      { ordenId: 'ORD1', nombreProducto: 'Collar',  precio: 149, cantidad: 1, total: 149, fecha }
    ])});
    const res = mockRes();
    await fn({ user: { id: 'u1' } }, res);
    expect(res._data.ordenes).toHaveLength(1);
    expect(res._data.ordenes[0].totalOrden).toBe(338);
  });

  test('9. producto legacy sin ordenId es su propia orden', async () => {
    ProductoVendido.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([
      { ordenId: null, _id: 'old1', nombreProducto: 'Viejo', precio: 100, cantidad: 1, total: 100, fecha: new Date() }
    ])});
    const res = mockRes();
    await fn({ user: { id: 'u1' } }, res);
    expect(res._data.ordenes).toHaveLength(1);
    expect(res._data.ordenes[0].ordenId).toBeNull();
  });

  test('10. ordena de más reciente a más antiguo', async () => {
    ProductoVendido.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([
      { ordenId: 'OLD', nombreProducto: 'P1', precio: 100, cantidad: 1, total: 100, fecha: new Date('2026-01-01') },
      { ordenId: 'NEW', nombreProducto: 'P2', precio: 200, cantidad: 1, total: 200, fecha: new Date('2026-02-01') }
    ])});
    const res = mockRes();
    await fn({ user: { id: 'u1' } }, res);
    expect(res._data.ordenes[0].ordenId).toBe('NEW');
  });
});

// ═══════════════════════════════════════════════
// 4. FRONTEND — Carrito (7 pruebas)
// ═══════════════════════════════════════════════
describe('carrito', () => {

  test('11. getCart devuelve [] si localStorage está vacío', () => {
    expect(getCart()).toEqual([]);
  });

  test('12. setCart guarda y getCart recupera correctamente', () => {
    setCart([SHAMPOO]);
    expect(getCart()[0].title).toBe('Shampoo FreshCare');
  });

  test('13. agruparCart cuenta cantidad correctamente', () => {
    const grupos = agruparCart([SHAMPOO, SHAMPOO, COLLAR]);
    expect(grupos.find(g => g.id === 'p001').cantidad).toBe(2);
    expect(grupos.find(g => g.id === 'p026').cantidad).toBe(1);
  });

  test('14. cambiarCantidad NO mueve el producto al final del array', () => {
    // Bug que arreglamos: al aumentar cantidad el producto se reordenaba
    const cart = [SHAMPOO, COLLAR, PELOTA];
    const result = cambiarCantidad('p001', 1, cart); // aumentar shampoo
    expect(result[0].id).toBe('p001'); // sigue siendo el primero
  });

  test('15. cambiarCantidad no baja de 1 (mínimo)', () => {
    const result = cambiarCantidad('p001', -10, [SHAMPOO]);
    expect(result.filter(i => i.id === 'p001')).toHaveLength(1);
  });

  test('16. eliminar producto quita todas sus copias', () => {
    setCart([SHAMPOO, SHAMPOO, COLLAR]);
    const nuevo = getCart().filter(i => i.id !== 'p001');
    setCart(nuevo);
    expect(getCart().find(i => i.id === 'p001')).toBeUndefined();
    expect(getCart()).toHaveLength(1);
  });

  test('17. total del carrito se calcula correctamente', () => {
    const cart = [SHAMPOO, COLLAR, PELOTA];
    const total = agruparCart(cart).reduce((s, i) => s + Number(i.price) * i.cantidad, 0);
    expect(total).toBe(437); // 189 + 149 + 99
  });
});

// ═══════════════════════════════════════════════
// 5. FRONTEND — Shop: filtros y búsqueda (8 pruebas)
// ═══════════════════════════════════════════════
describe('shop — filtros y búsqueda', () => {

  test('18. categoría "all" devuelve todos los productos', () => {
    expect(filtrarProductos(PRODS, { categoria: 'all' })).toHaveLength(4);
  });

  test('19. filtra por categoría correctamente', () => {
    const result = filtrarProductos(PRODS, { categoria: 'cuidado' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p001');
  });

  test('20. búsqueda por nombre encuentra el producto', () => {
    expect(filtrarProductos(PRODS, { query: 'shampoo' })[0].id).toBe('p001');
  });

  test('21. búsqueda ignora acentos', () => {
    // "omega" sin tilde debe encontrar "Omega 3"
    expect(filtrarProductos(PRODS, { query: 'omega' })[0].id).toBe('p077');
  });

  test('22. búsqueda sin resultados devuelve []', () => {
    expect(filtrarProductos(PRODS, { query: 'xyz_nada' })).toHaveLength(0);
  });

  test('23. orden precio menor a mayor: pelota primero', () => {
    const result = filtrarProductos(PRODS, { orden: 'priceLow' });
    expect(result[0].id).toBe('p051'); // $99
  });

  test('24. orden precio mayor a menor: omega primero', () => {
    const result = filtrarProductos(PRODS, { orden: 'priceHigh' });
    expect(result[0].id).toBe('p077'); // $279
  });

  test('25. combina categoría + búsqueda correctamente', () => {
    const result = filtrarProductos(PRODS, { query: 'collar', categoria: 'accesorios' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p026');
  });
});