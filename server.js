const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');

/* ---------- password hashing ---------- */
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function verifyPw(pw, stored) {
  const [salt, h] = stored.split(':');
  const c = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), c);
}

/* ---------- tiny JSON database ---------- */
const uid = () => crypto.randomBytes(6).toString('hex');

function seed() {
  return {
    users: [
      { id: uid(), name: 'Admin', email: 'admin@nailstudio.com', phone: '', role: 'admin', password: hashPw('admin123') },
    ],
    sessions: {},
    services: [
      { id: 's1', name: 'Classic Manicure', duration: 45, price: 25 },
      { id: 's2', name: 'Gel Manicure', duration: 60, price: 40 },
      { id: 's3', name: 'Gel Extensions', duration: 90, price: 70 },
      { id: 's4', name: 'Nail Art (per set)', duration: 90, price: 60 },
      { id: 's5', name: 'Pedicure', duration: 60, price: 45 },
      { id: 's6', name: 'Removal + Rebuild', duration: 75, price: 35 },
    ],
    products: [
      { id: uid(), name: 'Rose Quartz Press-On Set', description: '24 reusable press-on nails, 12 sizes, glossy pink. Includes glue tabs, file and prep pad.', price: 22, stock: 30, emoji: '🌸' },
      { id: uid(), name: 'French Tip DIY Kit', description: 'Short almond press-ons with classic white tips, nail glue, buffer and cuticle stick.', price: 24, stock: 25, emoji: '🤍' },
      { id: uid(), name: 'Chrome Mirror Set', description: 'Long coffin press-ons with a mirror chrome finish. 24 pieces, 12 sizes.', price: 28, stock: 18, emoji: '✨' },
      { id: uid(), name: 'Gel Polish Starter Kit', description: 'Mini LED lamp, 3 gel colours, base and top coat, remover wipes. Do your own gel at home.', price: 55, stock: 12, emoji: '💅' },
    ],
    bookings: [],
    orders: [],
    reviews: [],
  };
}

let db;
function load() {
  if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  else { db = seed(); save(); }
}
function save() {
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 2));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
}
load();
if (!Array.isArray(db.reviews)) { db.reviews = []; save(); }
if (!Array.isArray(db.activity)) { db.activity = []; save(); }

/* ---------- activity log (sign-ups and logins, shown to admin in Records) ---------- */
function logActivity(type, user) {
  db.activity.push({ id: crypto.randomBytes(6).toString('hex'), type, userId: user.id, name: user.name, email: user.email, role: user.role, at: new Date().toISOString() });
  if (db.activity.length > 5000) db.activity = db.activity.slice(-5000);
}

/* ---------- helpers ---------- */
const TIMES = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const ACTIVE = ['pending', 'accepted'];

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00'));
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function slotInPast(date, time) {
  return new Date(`${date}T${time}:00`) <= new Date();
}
function takenTimes(date) {
  return db.bookings.filter((b) => b.date === date && ACTIVE.includes(b.status)).map((b) => b.time);
}

/* ---------- auth ---------- */
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const userId = db.sessions[token];
  const user = userId && db.users.find((u) => u.id === userId);
  if (!user) return res.status(401).json({ error: 'Please log in.' });
  req.user = user;
  req.token = token;
  next();
}
const adminOnly = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only.' });

function startSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = user.id;
  save();
  return token;
}

app.post('/api/register', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ error: 'That email is already registered.' });
  const user = { id: uid(), name: name.trim(), email: email.trim(), phone: (phone || '').trim(), role: 'user', password: hashPw(password), createdAt: new Date().toISOString() };
  db.users.push(user);
  logActivity('signup', user);
  res.json({ token: startSession(user), user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !verifyPw(String(password || ''), user.password))
    return res.status(401).json({ error: 'Wrong email or password.' });
  logActivity('login', user);
  res.json({ token: startSession(user), user: publicUser(user) });
});

app.post('/api/logout', auth, (req, res) => {
  delete db.sessions[req.token];
  save();
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.patch('/api/profile', auth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  if (name.length > 100 || phone.length > 30) return res.status(400).json({ error: 'Please check the length of your details.' });
  req.user.name = name; req.user.phone = phone; save();
  res.json({ user: publicUser(req.user) });
});

/* ---------- services & slots ---------- */
app.get('/api/services', (req, res) => res.json(db.services));

app.get('/api/slots', (req, res) => {
  const { date } = req.query;
  if (!isDate(date)) return res.status(400).json({ error: 'Invalid date.' });
  const taken = takenTimes(date);
  res.json(TIMES.map((t) => ({ time: t, available: !taken.includes(t) && !slotInPast(date, t) })));
});

/* ---------- bookings ---------- */
const withService = (b) => {
  const s = db.services.find((x) => x.id === b.serviceId);
  const u = db.users.find((x) => x.id === b.userId);
  return { ...b, serviceName: s ? s.name : '(removed)', price: s ? s.price : 0, customerName: u ? u.name : '?', customerPhone: u ? u.phone : '', customerEmail: u ? u.email : '' };
};

app.post('/api/bookings', auth, (req, res) => {
  const { serviceId, date, time, notes } = req.body || {};
  if (!db.services.some((s) => s.id === serviceId)) return res.status(400).json({ error: 'Pick a service.' });
  if (!isDate(date) || date < todayStr()) return res.status(400).json({ error: 'Pick a valid future date.' });
  if (!TIMES.includes(time)) return res.status(400).json({ error: 'Pick a valid time.' });
  if (slotInPast(date, time)) return res.status(400).json({ error: 'That time has already passed.' });
  if (takenTimes(date).includes(time)) return res.status(409).json({ error: 'Sorry, that slot was just taken.' });
  const booking = {
    id: uid(), userId: req.user.id, serviceId, date, time,
    notes: String(notes || '').slice(0, 500), status: 'pending', createdAt: new Date().toISOString(),
  };
  db.bookings.push(booking);
  save();
  res.json(withService(booking));
});

app.get('/api/bookings', auth, (req, res) => {
  const list = req.user.role === 'admin' ? db.bookings : db.bookings.filter((b) => b.userId === req.user.id);
  list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  res.json(list.map(withService));
});

app.patch('/api/bookings/:id', auth, (req, res) => {
  const b = db.bookings.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  const { status, date, time } = req.body || {};
  if (req.user.role !== 'admin' && (date !== undefined || time !== undefined)) {
    if (b.userId !== req.user.id) return res.status(403).json({ error: 'Not your booking.' });
    if (!ACTIVE.includes(b.status)) return res.status(400).json({ error: 'Only pending or accepted appointments can be rescheduled.' });
    const nextDate = date === undefined ? b.date : date;
    const nextTime = time === undefined ? b.time : time;
    if (!isDate(nextDate) || nextDate < todayStr() || !TIMES.includes(nextTime) || slotInPast(nextDate, nextTime)) return res.status(400).json({ error: 'Choose a valid future date and available time.' });
    const clash = db.bookings.some(x => x.id !== b.id && x.date === nextDate && x.time === nextTime && ACTIVE.includes(x.status));
    if (clash) return res.status(409).json({ error: 'That appointment time is no longer available.' });
    b.date = nextDate; b.time = nextTime; save(); return res.json(withService(b));
  }
  if (req.user.role === 'admin') {
    if (!['accepted', 'declined', 'completed', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    if (status === 'accepted' || status === 'pending') {
      const clash = db.bookings.some((x) => x.id !== b.id && x.date === b.date && x.time === b.time && x.status === 'accepted');
      if (clash && status === 'accepted') return res.status(409).json({ error: 'Another accepted booking already uses this slot.' });
    }
  } else {
    if (b.userId !== req.user.id) return res.status(403).json({ error: 'Not your booking.' });
    if (status !== 'cancelled' || !ACTIVE.includes(b.status)) return res.status(400).json({ error: 'You can only cancel pending or accepted bookings.' });
  }
  b.status = status;
  save();
  res.json(withService(b));
});

/* ---------- customer insights & reviews ---------- */
function withReview(r) {
  const u = db.users.find(x => x.id === r.userId);
  const b = db.bookings.find(x => x.id === r.bookingId);
  const svc = b && db.services.find(x => x.id === b.serviceId);
  return { ...r, customerName: u ? u.name : 'Customer', serviceName: svc ? svc.name : 'Appointment' };
}
app.get('/api/reviews', (req, res) => {
  res.json(db.reviews.filter(r => !r.hidden).map(withReview).sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
});
app.get('/api/reviews/mine', auth, (req, res) => {
  res.json(db.reviews.filter(r => r.userId === req.user.id).map(withReview));
});
app.post('/api/reviews', auth, (req, res) => {
  const bookingId = String(req.body?.bookingId || '');
  const rating = Number(req.body?.rating);
  const comment = String(req.body?.comment || '').trim().slice(0, 500);
  const booking = db.bookings.find(b => b.id === bookingId && b.userId === req.user.id);
  if (!booking || booking.status !== 'completed') return res.status(400).json({ error: 'Reviews are available after a completed appointment.' });
  if (db.reviews.some(r => r.bookingId === bookingId)) return res.status(409).json({ error: 'You have already reviewed this appointment.' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) return res.status(400).json({ error: 'Choose a rating and write a short review.' });
  const review = { id: uid(), userId: req.user.id, bookingId, rating, comment, createdAt: new Date().toISOString() };
  db.reviews.push(review); save(); res.json(withReview(review));
});
app.delete('/api/reviews/:id', auth, adminOnly, (req, res) => {
  const exists = db.reviews.some(r => r.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Review not found.' });
  db.reviews = db.reviews.filter(r => r.id !== req.params.id); save(); res.json({ ok: true });
});
app.get('/api/customers', auth, adminOnly, (req, res) => {
  const customers = db.users.filter(u => u.role !== 'admin').map(u => {
    const orders = db.orders.filter(o => o.userId === u.id);
    const bookings = db.bookings.filter(b => b.userId === u.id);
    const spent = orders.filter(o => o.status !== 'cancelled' && o.paymentStatus === 'paid').reduce((sum,o) => sum + Number(o.total || 0), 0);
    return { ...publicUser(u), orders: orders.length, bookings: bookings.length, spent };
  });
  res.json(customers);
});

/* ---------- admin records (spreadsheet view) ---------- */
app.get('/api/admin/records', auth, adminOnly, (req, res) => {
  const userOf = (id) => db.users.find((u) => u.id === id) || {};
  const logins = db.activity.filter((a) => a.type === 'login');
  const lastLogin = {}; const loginCount = {};
  logins.forEach((a) => { lastLogin[a.userId] = a.at; loginCount[a.userId] = (loginCount[a.userId] || 0) + 1; });
  const signups = db.users.filter((u) => u.role !== 'admin').map((u) => ({
    name: u.name, email: u.email, phone: u.phone || '', signedUpAt: u.createdAt || null,
    lastLogin: lastLogin[u.id] || null, loginCount: loginCount[u.id] || 0,
    orders: db.orders.filter((o) => o.userId === u.id).length, bookings: db.bookings.filter((b) => b.userId === u.id).length,
  }));
  const purchases = [];
  db.orders.forEach((o) => {
    const u = userOf(o.userId);
    (o.items || []).forEach((i) => purchases.push({
      date: o.createdAt, orderId: o.id, customer: u.name || o.shipping?.name || '?', email: u.email || '', phone: o.shipping?.phone || '',
      item: i.name, qty: i.qty, unitPrice: i.price, lineTotal: Math.round(i.price * i.qty * 100) / 100,
      orderTotal: o.total, payment: o.paymentMethod || '', status: o.status, address: o.shipping?.address || '',
    }));
  });
  const bookings = db.bookings.map((b) => {
    const u = userOf(b.userId); const sv = db.services.find((x) => x.id === b.serviceId) || {};
    return { date: b.date, time: b.time, customer: u.name || '?', email: u.email || '', phone: u.phone || '', service: sv.name || '(removed)', price: sv.price || 0, status: b.status, notes: b.notes || '', requestedAt: b.createdAt };
  });
  res.json({
    signups, purchases, bookings,
    logins: logins.map((a) => ({ at: a.at, name: a.name, email: a.email, role: a.role })).reverse(),
  });
});

/* ---------- products (shop) ---------- */
app.get('/api/products', (req, res) => res.json(db.products));

function cleanProduct(body) {
  const name = String(body.name || '').trim();
  const price = Number(body.price);
  const stock = parseInt(body.stock, 10);
  if (!name || !(price >= 0) || !(stock >= 0)) return null;
  const rawNailColor = String(body.nailColor || '#d98c9a');
  const nailColor = /^#[0-9a-fA-F]{6}$/.test(rawNailColor) ? rawNailColor : '#d98c9a';
  return { name, description: String(body.description || '').slice(0, 500), price, stock, emoji: String(body.emoji || '💅').slice(0, 4), imageUrl: String(body.imageUrl || '').trim().slice(0, 1000), nailColor };
}
app.post('/api/products', auth, adminOnly, (req, res) => {
  const p = cleanProduct(req.body || {});
  if (!p) return res.status(400).json({ error: 'Name, price and stock are required.' });
  const product = { id: uid(), ...p };
  db.products.push(product);
  save();
  res.json(product);
});
app.put('/api/products/:id', auth, adminOnly, (req, res) => {
  const product = db.products.find((x) => x.id === req.params.id);
  const p = cleanProduct(req.body || {});
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (!p) return res.status(400).json({ error: 'Name, price and stock are required.' });
  Object.assign(product, p);
  save();
  res.json(product);
});
app.delete('/api/products/:id', auth, adminOnly, (req, res) => {
  db.products = db.products.filter((x) => x.id !== req.params.id);
  save();
  res.json({ ok: true });
});

/* ---------- orders ---------- */
app.post('/api/orders', auth, (req, res) => {
  const { items, shipping, paymentMethod, promoCode, usePoints } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Your cart is empty.' });
  if (!shipping || !shipping.name || !shipping.phone || !shipping.address)
    return res.status(400).json({ error: 'Name, phone and address are required.' });
  const lines = [];
  for (const it of items) {
    const p = db.products.find((x) => x.id === it.productId);
    const qty = parseInt(it.qty, 10);
    if (!p || !(qty > 0)) return res.status(400).json({ error: 'Invalid item in cart.' });
    if (p.stock < qty) return res.status(409).json({ error: `Only ${p.stock} left of "${p.name}".` });
    lines.push({ productId: p.id, name: p.name, price: p.price, qty });
  }
  // all checks passed -> reduce stock
  lines.forEach((l) => { db.products.find((x) => x.id === l.productId).stock -= l.qty; });
  const subtotal = Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
  const discountRate = String(promoCode || '').trim().toUpperCase() === 'POLISHED10' ? 0.10 : 0;
  const discount = Math.round(subtotal * discountRate * 100) / 100;
  const earnedPoints = db.bookings.filter(b => b.userId === req.user.id && b.status === 'completed').length * 50 + db.orders.filter(o => o.userId === req.user.id && o.status === 'delivered').length * 25;
  const usedPointsBefore = db.orders.filter(o => o.userId === req.user.id && o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.loyaltyPointsUsed || 0), 0);
  const availablePoints = Math.max(0, earnedPoints - usedPointsBefore);
  const redeemablePoints = usePoints ? Math.floor(availablePoints / 100) * 100 : 0;
  const pointsDiscount = Math.min(Math.floor(redeemablePoints / 100) * 5, Math.floor(Math.max(0, subtotal - discount) / 5) * 5);
  const pointsUsed = pointsDiscount >= 5 ? Math.floor(pointsDiscount / 5) * 100 : 0;
  const total = Math.round(Math.max(0, subtotal - discount - pointsDiscount) * 100) / 100;
  const order = {
    id: uid(), userId: req.user.id, items: lines, subtotal, discount, pointsDiscount, loyaltyPointsUsed: pointsUsed, promoCode: discountRate ? 'POLISHED10' : '',
    total,
    shipping: { name: String(shipping.name), phone: String(shipping.phone), address: String(shipping.address) },
    paymentMethod: ['card', 'apple_pay', 'google_pay'].includes(paymentMethod) ? paymentMethod : 'card',
    paymentStatus: 'demo_unpaid',
    status: 'placed', createdAt: new Date().toISOString(),
  };
  db.orders.push(order);
  save();
  res.json(order);
});

app.get('/api/orders', auth, (req, res) => {
  const list = req.user.role === 'admin' ? db.orders : db.orders.filter((o) => o.userId === req.user.id);
  const out = list.map((o) => ({ ...o, customerName: (db.users.find((u) => u.id === o.userId) || {}).name || '?' }));
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(out);
});

app.patch('/api/orders/:id', auth, adminOnly, (req, res) => {
  const o = db.orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  const { status } = req.body || {};
  if (!['placed', 'shipped', 'delivered', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  if (status === 'cancelled' && o.status !== 'cancelled') {
    o.items.forEach((l) => { const p = db.products.find((x) => x.id === l.productId); if (p) p.stock += l.qty; });
  }
  o.status = status;
  save();
  res.json(o);
});

app.listen(PORT, () => {
  console.log(`Nail Studio running at http://localhost:${PORT}`);
  console.log('Admin login: admin@nailstudio.com / admin123  (change this!)');
});
