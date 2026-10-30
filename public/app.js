/* ===== tiny helpers ===== */
const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const state = {
  user: null,
  token: localStorage.getItem('token') || '',
  view: 'home',
  services: [],
  products: [],
  cart: JSON.parse(localStorage.getItem('cart') || '{}'),
  adminTab: 'dashboard',
  editing: null,
  galleryFilter: 'All styles',
  shopFilter: 'all',
  promoCode: '',
  discount: 0,
  usePoints: false,
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedAdminDate: '',
  booking: { serviceId: '', date: '', time: '', notes: '', slots: [] },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => 'S$' + Number(n).toFixed(2);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const badge = (s) => `<span class="badge b-${esc(s)}">${esc(s)}</span>`;
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => dateKey(new Date());

function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (isErr ? ' err' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = ''), 2800);
}

async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.token) { logoutLocal(); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function saveCart() { localStorage.setItem('cart', JSON.stringify(state.cart)); }
const cartCount = () => Object.values(state.cart).reduce((a, b) => a + b, 0);

function logoutLocal() {
  state.user = null; state.token = ''; localStorage.removeItem('token');
  state.view = 'home';
}

function go(view) { state.view = view; render(); window.scrollTo(0, 0); }

/* ===== navigation ===== */
function renderNav() {
  // Admin navigation keeps the Admin pill and a direct Log out action.
  const isAdmin = state.user?.role === 'admin';
  const items = isAdmin
    ? [['admin', 'Admin']]
    : [['home', 'Home'], ['gallery', 'Nail gallery'], ['shop', 'Shop']];
  if (!isAdmin) items.push(['cart', `Cart${cartCount() ? ' (' + cartCount() + ')' : ''}`]);
  const links = items.map(([v, l]) => `<button class="${state.view === v ? 'active' : ''}" data-go="${v}">${l}</button>`).join('');
  if (state.user && !isAdmin) {
    $nav.innerHTML = links + `<div class="account-menu-wrap"><button id="accountMenuToggle" class="account-menu-toggle ${['dashboard','mybookings','myorders','profile'].includes(state.view) ? 'active' : ''}" aria-haspopup="true" aria-expanded="false">My account <span class="menu-chevron">⌄</span></button><div class="account-menu" id="accountMenu" hidden><button data-go="dashboard">My account</button><button id="logout">Log out</button></div></div>`;
  } else {
    $nav.innerHTML = links + (state.user
      ? `<button id="logout">Log out (${esc(state.user.name.split(' ')[0])})</button>`
      : `<button class="${state.view === 'auth' ? 'active' : ''}" data-go="auth">Log in</button>`);
  }
}

document.addEventListener('click', async (e) => {
  const menuToggle = e.target.closest('#accountMenuToggle');
  if (menuToggle) {
    const menu = document.getElementById('accountMenu');
    const isOpen = menu && !menu.hidden;
    if (menu) menu.hidden = isOpen;
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    menuToggle.classList.toggle('menu-open', !isOpen);
    return;
  }
  if (!e.target.closest('.account-menu-wrap')) {
    const menu = document.getElementById('accountMenu');
    const toggle = document.getElementById('accountMenuToggle');
    if (menu) menu.hidden = true;
    if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.classList.remove('menu-open'); }
  }
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  if (e.target.closest('#logout')) {
    try { await api('/logout', 'POST'); } catch {}
    logoutLocal(); toast('Logged out.'); render();
  }
});

/* ===== views ===== */
async function render() {
  renderNav();
  const v = state.view;
  const needsLogin = ['mybookings', 'myorders', 'admin'].includes(v);
  if (needsLogin && !state.user) { state.view = 'auth'; return render(); }
  if (['dashboard','mybookings','myorders','profile'].includes(v) && !state.user) { state.view = 'auth'; return render(); }
  if (v === 'admin' && state.user.role !== 'admin') { state.view = 'home'; return render(); }
  try {
    if (v === 'home') await viewBook();
    else if (v === 'shop') await viewShop();
    else if (v === 'cart') await viewCart();
    else if (v === 'auth') viewAuth();
    else if (v === 'gallery') await viewGallery();
    else if (v === 'dashboard') await viewCustomerDashboard();
    else if (v === 'profile') await viewProfile();
    else if (v === 'mybookings') await viewMyBookings();
    else if (v === 'myorders') await viewMyOrders();
    else if (v === 'admin') await viewAdmin();
  } catch (err) { toast(err.message, true); }
}

/* ---- auth ---- */
function viewAuth(mode = 'login') {
  $app.innerHTML = `
    <section class="auth-layout"><div class="auth-art"><span class="eyebrow">YOUR LITTLE BEAUTY RITUAL</span><div class="auth-art-mark">✳</div><h1>Beauty in every<br><em>little detail.</em></h1><p>Thoughtful nail care, dreamy designs, and feel-good moments — all in one place.</p><div class="auth-art-foot">POLISHED NAIL STUDIO <span>✦</span> SINGAPORE</div></div><div class="auth-panel"><a class="back-link" href="#" data-go="home">← Back to home</a><span class="eyebrow">${mode === 'login' ? 'WELCOME BACK' : 'YOUR POLISHED ERA STARTS HERE'}</span><h2>${mode === 'login' ? 'Sign in to Polished' : 'Create your account'}</h2><p class="sub">${mode === 'login' ? 'Pick up where your self-care left off.' : 'Save your bookings and keep track of every order.'}</p>
      <form id="authForm">
        ${mode === 'register' ? `<label>Full name</label><input name="name" placeholder="Your name" autocomplete="name" required>
        <label>Phone number <span class="optional">Optional</span></label><input name="phone" type="tel" placeholder="+65 8123 4567">` : ''}
        <label>Email address</label><input name="email" type="email" placeholder="you@example.com" autocomplete="email" required>
        <label>Password</label><input name="password" type="password" placeholder="At least 6 characters" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="6">
        <button class="btn auth-submit">${mode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button>
      </form>
      <p class="auth-switch">${mode === 'login' ? `New to Polished? <a href="#" id="swap">Create an account</a>` : `Already have an account? <a href="#" id="swap">Sign in</a>`}</p><p class="small-note auth-secure">♡ Your details stay private and secure.</p></div></section>`;
  document.getElementById('swap').onclick = (e) => { e.preventDefault(); viewAuth(mode === 'login' ? 'register' : 'login'); };
  document.getElementById('authForm').onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api(mode === 'login' ? '/login' : '/register', 'POST', body);
      state.token = r.token; state.user = r.user; localStorage.setItem('token', r.token);
      toast(`Hi ${r.user.name}!`);
      go(r.user.role === 'admin' ? 'admin' : 'home');
    } catch (err) { toast(err.message, true); }
  };
}

/* ---- nail inspiration gallery & customer hub ---- */
const galleryDesigns = [
  {id:'g1',name:'Rosewater French',category:'French tips',tone:'Rose & ivory',emoji:'🌸',description:'A soft, modern French tip with a blush base.'},
  {id:'g2',name:'Pearl Chrome',category:'Chrome',tone:'Pearl white',emoji:'🤍',description:'A glazed pearl finish for a clean, luminous look.'},
  {id:'g3',name:'Petal Garden',category:'Floral',tone:'Blush pink',emoji:'🌷',description:'Delicate petals and tiny hand-painted details.'},
  {id:'g4',name:'Quiet Luxury',category:'Minimal',tone:'Nude beige',emoji:'✨',description:'Understated nude tones with a glossy finish.'},
  {id:'g5',name:'Cherry Glaze',category:'Bold',tone:'Cherry red',emoji:'🍒',description:'A confident red set with a glass-like shine.'},
  {id:'g6',name:'Golden Hour',category:'Chrome',tone:'Soft gold',emoji:'🌙',description:'Warm metallic accents with a subtle shimmer.'},
  {id:'g7',name:'Daisy Daydream',category:'Floral',tone:'Cream & yellow',emoji:'🌼',description:'Playful daisies on a sheer neutral base.'},
  {id:'g8',name:'Cloud Nine',category:'Minimal',tone:'Milky white',emoji:'☁️',description:'A sheer milky manicure that goes with everything.'}
];
const galleryColors={g1:'#e6b3b6',g2:'#efe7e1',g3:'#f1b6c4',g4:'#d8bca5',g5:'#a5222f',g6:'#cda55a',g7:'#f2e4b8',g8:'#f0ebe5'};
const galleryFinish={'French tips':'french','Chrome':'chrome','Floral':'floral'};
function savedFavorites(){try{return JSON.parse(localStorage.getItem('nailFavorites')||'[]')}catch{return []}}
function setFavorites(ids){localStorage.setItem('nailFavorites',JSON.stringify(ids))}
async function viewGallery(){
  const fav=savedFavorites(); const cats=['All styles','French tips','Chrome','Floral','Minimal','Bold'];
  const list=state.galleryFilter==='All styles'?galleryDesigns:galleryDesigns.filter(d=>d.category===state.galleryFilter);
  $app.innerHTML=`<section class="page-heading"><span class="eyebrow">THE POLISHED EDIT</span><h1>Find your next <em>nail mood.</em></h1><p>Save designs you love and bring your favourites to your next appointment.</p></section><div class="gallery-toolbar"><div class="filter-pills">${cats.map(c=>`<button class="filter-pill ${state.galleryFilter===c?'active':''}" data-gfilter="${c}">${c}</button>`).join('')}</div><span class="small-note">${fav.length} saved favourite${fav.length===1?'':'s'}</span></div><div class="grid gallery-grid">${list.map((d,i)=>`<article class="gallery-card"><div class="gallery-visual tone-${i%4}"><div class="nail-set-art finish-${galleryFinish[d.category]||'plain'}" style="--nail-color:${galleryColors[d.id]||'#d98c9a'}" role="img" aria-label="${esc(d.name)} nail preview"><i></i><i></i><i></i><i></i><i></i></div><span class="gallery-chip">${d.category}</span><button class="favorite-btn ${fav.includes(d.id)?'saved':''}" data-fav="${d.id}" aria-label="Save ${d.name}">${fav.includes(d.id)?'♥':'♡'}</button></div><div class="gallery-info"><span class="eyebrow">${d.tone}</span><h3>${d.name}</h3><p>${d.description}</p><button class="text-link" data-inspire="${d.id}">Use as booking inspiration ↗</button></div></article>`).join('')}</div><section class="reviews-section"><div><span class="eyebrow">KIND WORDS</span><h2>Little details, lovely reviews.</h2><p>Reviews from the Polished community.</p></div><div id="reviewList" class="review-list"><div class="card empty">Loading reviews…</div></div></section>`;
  $app.querySelectorAll('[data-gfilter]').forEach(b=>b.onclick=()=>{state.galleryFilter=b.dataset.gfilter;viewGallery()});
  $app.querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>{if(!state.user){toast('Sign in to save favourites.',true);return go('auth')}const ids=savedFavorites();const id=b.dataset.fav;setFavorites(ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);viewGallery()});
  $app.querySelectorAll('[data-inspire]').forEach(b=>b.onclick=()=>{state.booking.notes=`Nail inspiration: ${galleryDesigns.find(d=>d.id===b.dataset.inspire)?.name||''}`;go('home');setTimeout(()=>document.getElementById('booking')?.scrollIntoView({behavior:'smooth'}),80)});
  try{const reviews=await api('/reviews');const target=document.getElementById('reviewList');target.innerHTML=reviews.length?reviews.slice(0,6).map(r=>`<article class="review-card"><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><p>“${esc(r.comment)}”</p><strong>${esc(r.customerName)}</strong><small>${esc(r.serviceName||'Polished customer')}</small></article>`).join(''):'<div class="card empty">Be the first to share your experience after a completed appointment.</div>'}catch{document.getElementById('reviewList').innerHTML='<div class="card empty">Reviews will appear here.</div>'}
}
async function viewCustomerDashboard(){
  const [bookings,orders]=await Promise.all([api('/bookings'),api('/orders')]);
  const completedBookings=bookings.filter(b=>b.status==='completed').length, completedOrders=orders.filter(o=>o.status==='delivered').length;
  const points=completedBookings*50+completedOrders*25;
  const next=bookings.filter(b=>['pending','accepted'].includes(b.status)&&b.date>=todayStr()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
  const fav=savedFavorites();
  $app.innerHTML=`<section class="page-heading"><span class="eyebrow">YOUR POLISHED SPACE</span><h1>Hello, ${esc((state.user.name||'there').split(' ')[0])} ♡</h1><p>Your appointments, orders and saved nail inspiration — all in one place.</p></section><div class="account-stats"><article class="account-stat"><span>Appointments</span><strong>${bookings.length}</strong></article><article class="account-stat"><span>Orders</span><strong>${orders.length}</strong></article><article class="account-stat"><span>Reward points</span><strong>${points}</strong></article><article class="account-stat"><span>Saved designs</span><strong>${fav.length}</strong></article></div><div class="account-grid"><section class="card account-panel"><div class="card-heading"><div><span class="eyebrow">UP NEXT</span><h2>Your next appointment</h2></div><button class="text-link" data-go="home">Book now ↗</button></div>${next?`<div class="upcoming-booking"><div class="calendar-tile"><strong>${new Date(next.date+'T00:00:00').getDate()}</strong><span>${new Date(next.date+'T00:00:00').toLocaleDateString(undefined,{month:'short'})}</span></div><div><strong>${esc(next.serviceName)}</strong><p>${fmtDate(next.date)} · ${fmtTime(next.time)}</p>${badge(next.status)}</div></div>`:'<div class="empty">No upcoming appointments yet. Make a little time for yourself.</div>'}</section><section class="card account-panel"><div class="card-heading"><div><span class="eyebrow">YOUR DETAILS</span><h2>Account shortcuts</h2></div></div><div class="account-links"><button data-go="mybookings"><span>♡</span><div><strong>My appointments</strong><small>Manage or reschedule your visits</small></div><b>→</b></button><button data-go="myorders"><span>▤</span><div><strong>My orders</strong><small>Follow your product orders</small></div><b>→</b></button><button data-go="profile"><span>◉</span><div><strong>Profile & addresses</strong><small>Keep your details up to date</small></div><b>→</b></button><button data-go="gallery"><span>✧</span><div><strong>Saved nail inspiration</strong><small>${fav.length} design${fav.length===1?'':'s'} saved</small></div><b>→</b></button></div></section></div><section class="card rewards-panel"><div><span class="eyebrow">POLISHED PERKS</span><h2>A little thank-you for coming back.</h2><p>Earn 50 points for each completed appointment and 25 for each delivered order. Points are a demo loyalty balance for this prototype.</p></div><div class="points-display"><strong>${points}</strong><span>POINTS</span></div></section><section class="card"><div class="card-heading"><div><span class="eyebrow">SHARE THE LOVE</span><h2>Review your completed appointments</h2></div></div><div id="reviewFormWrap"></div></section>`;
  const completed=bookings.filter(b=>b.status==='completed');const wrap=document.getElementById('reviewFormWrap');
  if(!completed.length){wrap.innerHTML='<p class="small-note">Once an appointment is marked completed, you can leave a review here.</p>';return}
  const reviews=await api('/reviews/mine'); const reviewable=completed.filter(b=>!reviews.some(r=>r.bookingId===b.id));
  wrap.innerHTML=reviewable.length?`<form id="reviewForm"><label>Appointment</label><select name="bookingId">${reviewable.map(b=>`<option value="${b.id}">${esc(b.serviceName)} — ${fmtDate(b.date)}</option>`).join('')}</select><label>Rating</label><select name="rating"><option value="5">★★★★★ — Loved it</option><option value="4">★★★★☆ — Great</option><option value="3">★★★☆☆ — Good</option><option value="2">★★☆☆☆ — Could be better</option><option value="1">★☆☆☆☆ — Disappointed</option></select><label>Your review</label><textarea name="comment" maxlength="500" required placeholder="Tell us about your experience..."></textarea><button class="btn">Submit review</button></form>`:'<p class="small-note">Thank you for sharing your experience — you have reviewed all completed appointments.</p>';
  const form=document.getElementById('reviewForm');if(form)form.onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));try{await api('/reviews','POST',{...data,rating:Number(data.rating)});toast('Thank you for your review!');viewCustomerDashboard()}catch(err){toast(err.message,true)}};
}
async function viewProfile(){
  $app.innerHTML=`<section class="page-heading"><span class="eyebrow">ACCOUNT SETTINGS</span><h1>Your profile</h1><p>Update the details we use for bookings and delivery.</p></section><div class="card profile-card"><form id="profileForm"><label>Full name</label><input name="name" required value="${esc(state.user.name)}"><label>Email address</label><input value="${esc(state.user.email)}" disabled><p class="small-note">Email address changes are disabled in this demo.</p><label>Phone number</label><input name="phone" type="tel" value="${esc(state.user.phone||'')}" placeholder="+65"><button class="btn">Save profile</button></form></div>`;
  document.getElementById('profileForm').onsubmit=async e=>{e.preventDefault();try{const updated=await api('/profile','PATCH',Object.fromEntries(new FormData(e.target)));state.user=updated.user;toast('Profile updated.');viewProfile();renderNav()}catch(err){toast(err.message,true)}};
}

/* ---- booking (user) ---- */
async function viewBook() {
  if (!state.services.length) state.services = await api('/services');
  if (!state.products.length) state.products = await api('/products');
  const b = state.booking;
  if (!b.serviceId && state.services.length) b.serviceId = state.services[0].id;
  if (!b.date) b.date = todayStr();
  $app.innerHTML = `
    <section class="landing-hero"><div class="landing-copy"><span class="eyebrow">A LITTLE LUXURY, JUST FOR YOU</span><h1>Your nails.<br><em>Your moment.</em></h1><p>Beautiful nails, thoughtful care, and tiny details that make you feel like you.</p><div class="hero-actions"><button class="btn" data-scroll="booking">Book an appointment <span>↗</span></button><button class="btn ghost" data-go="shop">Shop nail sets</button></div><div class="hero-proof"><span>✦</span> Made with care, worn with confidence</div></div><div class="landing-art"><div class="hero-arch"><div class="art-spark spark-one">✦</div><div class="art-spark spark-two">✧</div><div class="hero-nails"><span style="--c:#e7c3bd"></span><span style="--c:#b86b78"></span><span class="tip" style="--c:#f1d3cd"></span><span style="--c:#7d2f43"></span><span style="--c:#d7b98a"></span></div></div><div class="hero-badge"><span>The Polished edit</span><strong>Soft tones. Bold confidence.</strong></div></div></section>
    <section class="trust-strip"><div><strong>01</strong><span>Personalised nail care</span></div><div><strong>02</strong><span>Made for your style</span></div><div><strong>03</strong><span>Little details, big mood</span></div></section>
    <section class="section-heading"><div><span class="eyebrow">THE STUDIO MENU</span><h2>A little something for you</h2><p>Find your next favourite self-care ritual.</p></div><button class="text-link" data-scroll="booking">Book your visit ↗</button></section>
    <div class="grid service-grid">${state.services.map((s,i) => `<article class="service-card"><div class="service-icon">${['✿','♡','✧','❀'][i%4]}</div><span class="service-number">0${i+1}</span><h3>${esc(s.name)}</h3><p>${s.duration} minutes of me-time</p><div class="service-bottom"><strong>${money(s.price)}</strong><button class="round-arrow" data-book-service="${s.id}" aria-label="Choose ${esc(s.name)}">↗</button></div></article>`).join('')}</div>
    <section class="booking-section" id="booking"><div class="booking-intro"><span class="eyebrow">YOUR NEXT APPOINTMENT</span><h2>Let's make time<br>for <em>you.</em></h2><p>Choose your treatment and preferred time. We'll confirm your booking shortly.</p><div class="booking-note">♡ <span>Bookings are confirmed by our studio team.</span></div></div><div class="card booking-card"><div class="booking-step"><span>01</span><div><strong>Choose your treatment</strong><small>Pick your favourite service</small></div></div><label>Service</label><select id="svc">${state.services.map((s) => `<option value="${s.id}" ${s.id === b.serviceId ? 'selected' : ''}>${esc(s.name)} — ${money(s.price)} · ${s.duration} min</option>`).join('')}</select><div class="row"><div><label>Date</label><input type="date" id="date" min="${todayStr()}" value="${b.date}"></div><div><label>Time</label><div class="slots" id="slots"></div></div></div><label>Anything we should know? <span class="optional">Optional</span></label><textarea id="notes" placeholder="Design inspiration, preferences, or notes...">${esc(b.notes)}</textarea><button class="btn booking-submit" id="submit">Request my appointment <span>→</span></button><p class="small-note">${state.user ? '' : 'You can sign in before confirming.'} No payment required to request a booking.</p></div></section>
    <section class="home-reviews" id="homeReviews" hidden><div class="section-heading"><div><span class="eyebrow">KIND WORDS</span><h2>Loved by our clients</h2></div><button class="text-link" data-go="gallery">See the gallery ↗</button></div><div class="review-list"></div></section>
    <section class="shop-promo"><div><span class="eyebrow">AT-HOME NAIL LOVE</span><h2>Your salon mood,<br><em>wherever you are.</em></h2><p>Explore press-on sets and DIY kits curated for your next nail moment.</p><button class="btn" data-go="shop">Explore the shop ↗</button></div><div class="promo-stacks"><span>🌸</span><span>🤍</span><span>✨</span></div></section>`;
  document.querySelectorAll('[data-scroll]').forEach(el => el.onclick = () => document.getElementById(el.dataset.scroll)?.scrollIntoView({behavior:'smooth'}));
  document.querySelectorAll('[data-book-service]').forEach(el => el.onclick = () => { b.serviceId = el.dataset.bookService; document.getElementById('svc').value = b.serviceId; document.getElementById('booking').scrollIntoView({behavior:'smooth'}); });
  document.getElementById('svc').onchange = (e) => (b.serviceId = e.target.value);
  document.getElementById('notes').oninput = (e) => (b.notes = e.target.value);
  document.getElementById('date').onchange = async (e) => { b.date = e.target.value; b.time = ''; await loadSlots(); };
  document.getElementById('submit').onclick = submitBooking;
  await loadSlots();
  api('/reviews').then((rs) => {
    const sec = document.getElementById('homeReviews');
    if (!sec || !rs.length) return;
    sec.querySelector('.review-list').innerHTML = rs.slice(0, 3).map((r) => `<article class="review-card"><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div><p>“${esc(r.comment)}”</p><strong>${esc(r.customerName)}</strong><small>${esc(r.serviceName || 'Polished customer')}</small></article>`).join('');
    sec.hidden = false;
  }).catch(() => {});
}

async function loadSlots() {
  const b = state.booking;
  const el = document.getElementById('slots');
  if (!b.date) { el.innerHTML = '<span class="small-note">Pick a date first.</span>'; return; }
  try { b.slots = await api('/slots?date=' + b.date); } catch (err) { toast(err.message, true); return; }
  el.innerHTML = b.slots.map((s) =>
    `<button type="button" class="slot ${b.time === s.time ? 'sel' : ''}" data-t="${s.time}" ${s.available ? '' : 'disabled'}>${fmtTime(s.time)}</button>`).join('');
  el.querySelectorAll('.slot').forEach((btn) => (btn.onclick = () => { b.time = btn.dataset.t; loadSlots(); }));
}

async function submitBooking() {
  const b = state.booking;
  if (!state.user) { toast('Please log in to book.', true); return go('auth'); }
  if (state.user.role === 'admin') return toast('Admins cannot book — use a customer account.', true);
  if (!b.time) return toast('Please pick a time.', true);
  try {
    await api('/bookings', 'POST', { serviceId: b.serviceId, date: b.date, time: b.time, notes: b.notes });
    state.booking = { serviceId: '', date: '', time: '', notes: '', slots: [] };
    toast('Booking requested! Waiting for confirmation.');
    go('mybookings');
  } catch (err) { toast(err.message, true); loadSlots(); }
}

async function viewMyBookings() {
  const list = await api('/bookings');
  $app.innerHTML = `<section class="page-heading"><span class="eyebrow">YOUR APPOINTMENTS</span><h1>My bookings</h1><p>Pending bookings are waiting for the studio to accept.</p></section>
    <div class="card">${list.length ? list.map((b) => `
      <div class="item">
        <div><strong>${esc(b.serviceName)}</strong> ${badge(b.status)}
          <div class="meta">${fmtDate(b.date)} at ${fmtTime(b.time)} · ${money(b.price)}</div>
          ${b.notes ? `<div class="meta">Note: ${esc(b.notes)}</div>` : ''}</div>
        <div class="actions">${['pending', 'accepted'].includes(b.status)
          ? `<button class="btn ghost small" data-reschedule="${b.id}">Reschedule</button><button class="btn ghost small" data-cancel="${b.id}">Cancel</button>` : ''}</div>
      </div>`).join('') : '<div class="empty">No bookings yet.</div>'}</div>`;
  $app.querySelectorAll('[data-reschedule]').forEach((btn) => (btn.onclick = async () => {
    const item=list.find(x=>x.id===btn.dataset.reschedule); const date=prompt('New date (YYYY-MM-DD):',item.date); if(!date)return; const time=prompt('New time (e.g. 14:00):',item.time); if(!time)return; try{await api('/bookings/'+item.id,'PATCH',{date,time});toast('Appointment rescheduled.');render()}catch(err){toast(err.message,true)}
  }));
  $app.querySelectorAll('[data-cancel]').forEach((btn) => (btn.onclick = async () => {
    if (!confirm('Cancel this booking?')) return;
    try { await api('/bookings/' + btn.dataset.cancel, 'PATCH', { status: 'cancelled' }); toast('Booking cancelled.'); render(); }
    catch (err) { toast(err.message, true); }
  }));
}

/* ---- shop ---- */
async function viewShop() {
  state.products = await api('/products');
  const query=state.shopQuery||''; const fav=savedFavorites();
  const products=state.products.filter(p=>(!query||`${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()))&&(state.shopFilter!=='favorites'||fav.includes('p:'+p.id)));
  $app.innerHTML = `<section class="page-heading"><span class="eyebrow">AT-HOME NAIL LOVE</span><h1>Little luxuries, <em>delivered.</em></h1><p>Curated press-ons and DIY essentials for your next nail moment.</p></section><div class="shop-toolbar"><input id="shopSearch" type="search" placeholder="Search nail sets and kits…" value="${esc(query)}"><div class="filter-pills"><button class="filter-pill ${state.shopFilter==='all'?'active':''}" data-shopfilter="all">All products</button><button class="filter-pill ${state.shopFilter==='favorites'?'active':''}" data-shopfilter="favorites">♡ Favourites</button></div></div><div class="grid product-grid">${products.map((p,i)=>`<article class="card product"><div class="pic product-visual tone-${i%4}">${p.imageUrl ? `<img class="product-photo" src="${esc(p.imageUrl)}" alt="${esc(p.name)}" onerror="this.remove()">` : `<div class="nail-set-art" style="--nail-color:${esc(p.nailColor || '#d98c9a')}" aria-label="Nail set preview"><i></i><i></i><i></i><i></i><i></i></div>`}<button class="favorite-btn ${fav.includes('p:'+p.id)?'saved':''}" data-pfav="${p.id}" aria-label="Save ${esc(p.name)}">${fav.includes('p:'+p.id)?'♥':'♡'}</button></div><div class="product-label">${p.stock>0?'READY TO SHIP':'CURRENTLY SOLD OUT'}</div><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="product-meta"><span class="price">${money(p.price)}</span><span class="small-note">${p.stock>0?p.stock+' in stock':'Sold out'}</span></div><button class="btn" data-add="${p.id}" ${p.stock>0?'':'disabled'}>Add to bag <span>＋</span></button></article>`).join('')||'<div class="card empty">No products match your search.</div>'}</div>`;
  document.getElementById('shopSearch').oninput=e=>{state.shopQuery=e.target.value;const q=state.shopQuery.toLowerCase();$app.querySelectorAll('.product-grid .product').forEach(card=>card.hidden=!card.textContent.toLowerCase().includes(q));};
  $app.querySelectorAll('[data-shopfilter]').forEach(b=>b.onclick=()=>{state.shopFilter=b.dataset.shopfilter;viewShop()});
  $app.querySelectorAll('[data-pfav]').forEach(b=>b.onclick=()=>{if(!state.user){toast('Sign in to save favourites.',true);return go('auth')}const id='p:'+b.dataset.pfav;const ids=savedFavorites();setFavorites(ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);viewShop()});
  $app.querySelectorAll('[data-add]').forEach((btn) => (btn.onclick = () => {const p=state.products.find(x=>x.id===btn.dataset.add);const cur=state.cart[p.id]||0;if(cur>=p.stock)return toast('No more stock available.',true);state.cart[p.id]=cur+1;saveCart();renderNav();toast('Added to cart.')}));
}

async function viewCart() {
  state.products = await api('/products');
  const [myBookings,myOrders] = state.user && state.user.role !== 'admin' ? await Promise.all([api('/bookings'),api('/orders')]) : [[],[]];
  const pointsAvailable = Math.max(0,myBookings.filter(b=>b.status==='completed').length*50 + myOrders.filter(o=>o.status==='delivered').length*25 - myOrders.filter(o=>o.status!=='cancelled').reduce((n,o)=>n+Number(o.loyaltyPointsUsed||0),0));
  const pointsDiscount = state.usePoints && pointsAvailable>=100 ? Math.floor(Math.floor(pointsAvailable/100)*5) : 0;
  Object.keys(state.cart).forEach((id) => { if (!state.products.some((p) => p.id === id)) delete state.cart[id]; });
  saveCart(); renderNav();
  const lines = Object.entries(state.cart).map(([id, qty]) => ({ p: state.products.find((x) => x.id === id), qty }));
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  if (!lines.length) { $app.innerHTML = `<section class="page-heading"><span class="eyebrow">YOUR BAG</span><h1>Your cart</h1><p>Your next nail moment is waiting.</p></section><div class="card empty">Your cart is looking a little empty. <a href="#" data-go="shop">Explore nail sets →</a></div>`; return; }
  $app.innerHTML = `<section class="page-heading"><span class="eyebrow">ALMOST YOURS</span><h1>Your shopping bag</h1><p>Good things are just a few steps away.</p></section><div class="checkout-layout"><div class="card cart-card"><div class="checkout-title"><h2>Your items</h2><span>${cartCount()} item${cartCount()===1?'':'s'}</span></div>${lines.map(({ p, qty }) => `<div class="cart-line"><div class="product-thumb">${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="" onerror="this.remove()">` : `<div class="nail-set-art mini" style="--nail-color:${esc(p.nailColor || '#d98c9a')}"><i></i><i></i><i></i><i></i><i></i></div>`}</div><div class="cart-product-info"><strong>${esc(p.name)}</strong><span>${money(p.price)} each</span><div class="cartqty"><button type="button" data-dec="${p.id}">−</button><span>${qty}</span><button type="button" data-inc="${p.id}">+</button></div></div><strong class="cart-line-price">${money(p.price * qty)}</strong></div>`).join('')}<a class="text-link" href="#" data-go="shop">← Continue shopping</a></div><div class="card checkout-card"><span class="eyebrow">CHECKOUT</span><h2>Delivery & payment</h2><form id="checkout"><label>Full name</label><input name="name" autocomplete="name" required value="${esc(state.user?.name || '')}" placeholder="Name for delivery"><label>Phone number</label><input name="phone" type="tel" autocomplete="tel" required value="${esc(state.user?.phone || '')}" placeholder="+65"><label>Delivery address</label><textarea name="address" autocomplete="street-address" required placeholder="Block, street, unit, postal code"></textarea><div class="payment-heading"><strong>Payment method</strong><span class="small-note">Choose at checkout</span></div><div class="payment-options"><label class="payment-option selected"><input type="radio" name="paymentMethod" value="card" checked><span class="payment-symbol">▰</span><span><strong>Credit / debit card</strong><small>Visa, Mastercard, Amex</small></span><span class="payment-check">✓</span></label><label class="payment-option"><input type="radio" name="paymentMethod" value="apple_pay"><span class="payment-symbol">●</span><span><strong>Apple Pay</strong><small>Fast, secure checkout</small></span><span class="payment-check">✓</span></label><label class="payment-option"><input type="radio" name="paymentMethod" value="google_pay"><span class="payment-symbol">G</span><span><strong>Google Pay</strong><small>Pay with your Google Wallet</small></span><span class="payment-check">✓</span></label></div><div class="loyalty-redeem"><label><input type="checkbox" id="usePoints" ${state.usePoints&&pointsAvailable>=100?'checked':''} ${pointsAvailable>=100?'':'disabled'}> Use reward points (${pointsAvailable} available, 100 points = S$5 off)</label><span class="small-note">${pointsAvailable>=100?'Redeem points at checkout.':`Earn ${100-pointsAvailable} more points to unlock S$5 off.`}</span></div><div class="promo-row"><label for="promoCode">Promo code</label><div><input id="promoCode" placeholder="Try POLISHED10" value="${esc(state.promoCode)}"><button type="button" class="btn ghost small" id="applyPromo">Apply</button></div><p id="promoMessage" class="small-note">${state.discount?`10% demo discount applied.`:"Use POLISHED10 for 10% off in this demo."}</p></div><div class="checkout-total"><span>Subtotal</span><strong>${money(total)}</strong></div><div class="checkout-total discount-total"><span>Promo discount</span><strong>−${money(total*state.discount)}</strong></div><div class="checkout-total points-discount-total"><span>Points discount</span><strong>−${money(pointsDiscount)}</strong></div><div class="checkout-total grand-total"><span>Order total</span><strong>${money(Math.max(0,total-total*state.discount-pointsDiscount))}</strong></div><button class="btn checkout-submit">Continue to payment <span>→</span></button><p class="payment-disclaimer">Demo checkout only — no payment is taken here. Live card, Apple Pay, and Google Pay payments require a secure payment provider integration. Never enter card details into this demo.</p></form></div></div>`;
  $app.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => { const p = state.products.find((x) => x.id === b.dataset.inc); if ((state.cart[p.id] || 0) >= p.stock) return toast('No more stock available.', true); state.cart[p.id]++; saveCart(); render(); }));
  $app.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = () => { const id = b.dataset.dec; state.cart[id]--; if (state.cart[id] <= 0) delete state.cart[id]; saveCart(); render(); }));
  const updateCheckoutTotals=()=>{const promo=total*state.discount;const points=state.usePoints&&pointsAvailable>=100?Math.min(Math.floor(pointsAvailable/100)*5,Math.floor(Math.max(0,total-promo)/5)*5):0;document.querySelector('.discount-total strong').textContent='−'+money(promo);document.querySelector('.points-discount-total strong').textContent='−'+money(points);document.querySelector('.grand-total strong').textContent=money(Math.max(0,total-promo-points));};
  const pointsInput=document.getElementById('usePoints');pointsInput.onchange=()=>{state.usePoints=pointsInput.checked;updateCheckoutTotals()};
  document.getElementById('applyPromo').onclick=()=>{const code=document.getElementById('promoCode').value.trim().toUpperCase();state.promoCode=code;state.discount=code==='POLISHED10'?0.1:0;document.getElementById('promoMessage').textContent=state.discount?'Promo applied — 10% off (demo).':(code?'That promo code is not valid.':'Enter a promo code.');document.getElementById('promoMessage').style.color=state.discount?'#388461':'#a45e68';updateCheckoutTotals();};
  $app.querySelectorAll('.payment-option input').forEach(input => input.addEventListener('change', () => $app.querySelectorAll('.payment-option').forEach(el => el.classList.toggle('selected', el.querySelector('input').checked))));
  document.getElementById('checkout').onsubmit = async (e) => { e.preventDefault(); if (!state.user) { toast('Please sign in to check out.', true); return go('auth'); } if (state.user.role === 'admin') return toast('Admins cannot place orders.', true); const data = Object.fromEntries(new FormData(e.target)); const shipping = { name:data.name, phone:data.phone, address:data.address }; try { await api('/orders', 'POST', { items:Object.entries(state.cart).map(([productId,qty])=>({productId,qty})), shipping, paymentMethod:data.paymentMethod, promoCode:state.promoCode, usePoints:state.usePoints }); state.cart = {}; state.promoCode=''; state.discount=0; state.usePoints=false; saveCart(); toast('Demo order placed! No payment was charged.'); go('myorders'); } catch(err) { toast(err.message,true); } };
}

const orderCard = (o, admin) => `
  <div class="item">
    <div><strong>Order #${o.id.slice(0, 6)}</strong> ${badge(o.status)}
      <div class="meta">${new Date(o.createdAt).toLocaleString()}${admin ? ' · ' + esc(o.customerName) : ''}</div>
      <div class="meta">${o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(', ')}</div>
      <div class="meta">Payment: ${({card:'Credit / debit card',apple_pay:'Apple Pay',google_pay:'Google Pay'}[o.paymentMethod] || 'Not specified')} · Demo / unpaid</div>
      <div class="meta">Ship to: ${esc(o.shipping.name)}, ${esc(o.shipping.phone)}, ${esc(o.shipping.address)}</div></div>
    <div style="text-align:right"><div class="price">${money(o.total)}</div>
      ${admin ? `<div class="actions" style="margin-top:6px;justify-content:flex-end">
        ${o.status === 'placed' ? `<button class="btn small ok" data-ostatus="${o.id}:shipped">Mark shipped</button>` : ''}
        ${o.status === 'shipped' ? `<button class="btn small ok" data-ostatus="${o.id}:delivered">Mark delivered</button>` : ''}
        ${['placed', 'shipped'].includes(o.status) ? `<button class="btn small bad" data-ostatus="${o.id}:cancelled">Cancel</button>` : ''}
      </div>` : ''}</div>
  </div>`;

async function viewMyOrders() {
  const list = await api('/orders');
  $app.innerHTML = `<section class="page-heading"><span class="eyebrow">YOUR ORDERS</span><h1>My orders</h1><p>Follow your nail sets from our studio to your door.</p></section><div class="card">${list.length ? list.map((o) => orderCard(o, false)).join('') : '<div class="empty">No orders yet.</div>'}</div>`;
}

/* ---- admin ---- */
async function viewAdmin() {
  const tabs = [['dashboard', 'Dashboard'], ['bookings', 'Bookings'], ['records', 'Records'], ['products', 'Nail Stock']];
  const [orders, bookings, products] = await Promise.all([api('/orders'), api('/bookings'), api('/products')]);
  const validOrders = orders.filter(o => o.status !== 'cancelled');
  const sales = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const acceptedBookings = bookings.filter(b => b.status === 'accepted').length;
  const lowStock = products.filter(p => Number(p.stock || 0) <= 5).length;
  const firstOfMonth = new Date(); firstOfMonth.setDate(1); firstOfMonth.setHours(0, 0, 0, 0);
  const monthlySales = validOrders.filter(o => new Date(o.createdAt) >= firstOfMonth).reduce((sum, o) => sum + Number(o.total || 0), 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = dateKey(d);
    const amount = validOrders.filter(o => dateKey(new Date(o.createdAt)) === key).reduce((sum, o) => sum + Number(o.total || 0), 0);
    return { d, amount };
  });
  const maxWeek = Math.max(1, ...week.map(x => x.amount));
  const recentBookings = [...bookings].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0, 5);
  const productPopularity = {};
  validOrders.forEach(o => (o.items || []).forEach(i => { productPopularity[i.name] = (productPopularity[i.name] || 0) + Number(i.qty || 0); }));
  const popularProduct = Object.entries(productPopularity).sort((a,b) => b[1]-a[1])[0];
  const dashboard = state.adminTab === 'dashboard' ? `
    <section class="admin-welcome"><div><span class="eyebrow">STUDIO OVERVIEW</span><h1>Good to see you, Admin <span>✳</span></h1><p>Here’s what’s happening at Polished today.</p></div><div class="admin-date">${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div></section>
    <div class="stats-grid">
      <article class="stat-card"><div class="stat-top"><span>Total sales</span><span class="stat-icon">↗</span></div><strong>${money(sales)}</strong><small>Non-cancelled order value</small><div class="stat-foot">${money(monthlySales)} this month</div></article>
      <article class="stat-card"><div class="stat-top"><span>Total orders</span><span class="stat-icon">▤</span></div><strong>${orders.length}</strong><small>Orders placed all time</small><div class="stat-foot">${validOrders.length} active orders</div></article>
      <article class="stat-card"><div class="stat-top"><span>Bookings</span><span class="stat-icon">♡</span></div><strong>${bookings.length}</strong><small>All appointment requests</small><div class="stat-foot">${pendingBookings} awaiting approval · ${acceptedBookings} accepted</div></article>
      <article class="stat-card"><div class="stat-top"><span>Low-stock nail sets</span><span class="stat-icon">✧</span></div><strong>${lowStock}</strong><small>Products with 5 or fewer units</small><div class="stat-foot">${products.reduce((n, p) => n + Number(p.stock || 0), 0)} units in stock</div></article>
      <article class="stat-card"><div class="stat-top"><span>Most popular product</span><span class="stat-icon">♡</span></div><strong class="popular-product-value">${popularProduct ? esc(popularProduct[0]) : '—'}</strong><small>${popularProduct ? `${popularProduct[1]} units ordered` : 'No orders recorded yet'}</small><div class="stat-foot">Based on recorded order items</div></article>
    </div>
    <div class="admin-main-grid">
      <section class="card sales-card"><div class="card-heading"><div><span class="eyebrow">PERFORMANCE</span><h2>Sales snapshot</h2></div><span class="subtle-tag">Last 7 days</span></div><div class="sales-total">${money(sales)}<span> order value all time</span></div><div class="sales-bars">${week.map(x => `<div class="bar-col" title="${money(x.amount)}"><div class="bar-track"><span style="height:${Math.max(x.amount ? 8 : 3, x.amount / maxWeek * 100)}%"></span></div><small>${x.d.toLocaleDateString(undefined, { weekday: 'short' })}</small></div>`).join('')}</div><p class="small-note">Sales shown are recorded order totals, not verified payment revenue.</p></section>
      <section class="card recent-card"><div class="card-heading"><div><span class="eyebrow">APPOINTMENTS</span><h2>Recent bookings</h2></div><button class="text-link" data-tab="bookings">Manage bookings →</button></div>${recentBookings.length ? recentBookings.map(b => `<div class="recent-order"><span class="recent-order-icon">♡</span><div><strong>${esc(b.customerName || 'Customer')}</strong><small>${esc(b.serviceName)} · ${fmtDate(b.date)} at ${fmtTime(b.time)}</small></div><div class="recent-amount">${badge(b.status)}</div></div>`).join('') : '<div class="empty">No bookings yet.</div>'}</section>
    </div>` : '';
  $app.innerHTML = `<div class="admin-shell"><div class="tabs admin-tabs">${tabs.map(([k, l]) => `<button class="${state.adminTab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="adminBody">${dashboard}</div></div>`;
  $app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { state.adminTab = b.dataset.tab; state.editing = null; viewAdmin(); });
  const body = document.getElementById('adminBody');
  if (state.adminTab === 'bookings') await adminBookings(body);
  else if (state.adminTab === 'records') await adminRecords(body);
  else if (state.adminTab === 'products') await adminProducts(body);
}

function downloadCSV(filename, rows){const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)}
async function adminCustomers(body){const list=await api('/customers');body.innerHTML=`<div class="card"><div class="card-heading"><div><span class="eyebrow">YOUR COMMUNITY</span><h2>Customers (${list.length})</h2></div><input id="customerSearch" class="compact-search" placeholder="Search customers…"></div><div id="customerRows">${list.map(u=>`<div class="item customer-row"><div><strong>${esc(u.name)}</strong><div class="meta">${esc(u.email)} · ${esc(u.phone||'No phone added')}</div><div class="meta">${u.orders} orders · ${u.bookings} appointments</div></div><strong>${money(u.spent)}</strong></div>`).join('')||'<div class="empty">No customers yet.</div>'}</div></div>`;document.getElementById('customerSearch').oninput=e=>body.querySelectorAll('.customer-row').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(e.target.value.toLowerCase()))}
async function adminReviews(body){const list=await api('/reviews');body.innerHTML=`<div class="card"><span class="eyebrow">CUSTOMER FEEDBACK</span><h2>Reviews (${list.length})</h2>${list.map(r=>`<div class="item"><div><div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><strong>${esc(r.customerName)}</strong><div class="meta">${esc(r.serviceName||'Appointment')} · ${new Date(r.createdAt).toLocaleDateString()}</div><p>${esc(r.comment)}</p></div><button class="btn small bad" data-reviewdel="${r.id}">Remove</button></div>`).join('')||'<div class="empty">No reviews yet.</div>'}</div>`;body.querySelectorAll('[data-reviewdel]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this review?'))return;try{await api('/reviews/'+b.dataset.reviewdel,'DELETE');toast('Review removed.');viewAdmin()}catch(e){toast(e.message,true)}})}

/* ---- admin records: spreadsheet-style tables ---- */
const PAYMENT_LABELS = { card: 'Credit / debit card', apple_pay: 'Apple Pay', google_pay: 'Google Pay' };
const RECORD_SETS = {
  signups: { label: 'Sign-ups', sortKey: 'signedUpAt', empty: 'No customers have signed up yet.', cols: [
    ['Name', 'name'], ['Email', 'email'], ['Phone', 'phone'], ['Signed up', 'signedUpAt', 'dt'], ['Last login', 'lastLogin', 'dt'],
    ['Logins', 'loginCount', 'num'], ['Orders', 'orders', 'num'], ['Bookings', 'bookings', 'num']] },
  logins: { label: 'Logins', sortKey: 'at', empty: 'No logins recorded yet. Logins are tracked from now on.', cols: [
    ['When', 'at', 'dt'], ['Name', 'name'], ['Email', 'email'], ['Role', 'role', 'status']] },
  purchases: { label: 'Purchases', sortKey: 'date', empty: 'No purchases yet.', cols: [
    ['Date', 'date', 'dt'], ['Order', 'orderId', 'id'], ['Customer', 'customer'], ['Email', 'email'], ['Phone', 'phone'], ['Item', 'item'],
    ['Qty', 'qty', 'num'], ['Unit price', 'unitPrice', 'money'], ['Line total', 'lineTotal', 'money'], ['Order total', 'orderTotal', 'money'],
    ['Payment', 'payment', 'pay'], ['Status', 'status', 'status'], ['Ship to', 'address']] },
  bookings: { label: 'Bookings', sortKey: 'date', empty: 'No bookings yet.', cols: [
    ['Appointment', 'date', 'date'], ['Time', 'time', 'time'], ['Customer', 'customer'], ['Email', 'email'], ['Phone', 'phone'],
    ['Service', 'service'], ['Price', 'price', 'money'], ['Status', 'status', 'status'], ['Notes', 'notes'], ['Requested', 'requestedAt', 'dt']] },
};
const dtFmt = (v) => v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
function cellHtml(type, v) {
  if (v === null || v === undefined || v === '') return '<span class="cell-empty">—</span>';
  if (type === 'dt') return esc(dtFmt(v));
  if (type === 'date') return esc(fmtDate(v));
  if (type === 'time') return esc(fmtTime(v));
  if (type === 'money') return esc(money(v));
  if (type === 'status') return badge(v);
  if (type === 'pay') return esc(PAYMENT_LABELS[v] || v);
  if (type === 'id') return '#' + esc(String(v).slice(0, 6));
  return esc(v);
}
function cellText(type, v) {
  if (v === null || v === undefined) return '';
  if (type === 'dt') return v ? new Date(v).toLocaleString() : '';
  if (type === 'date') return v;
  if (type === 'pay') return PAYMENT_LABELS[v] || v;
  // neutralise spreadsheet formulas (=, @, or +/- followed by non-number text) so exported CSVs are safe to open
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) && !/^[+\-]?\d[\d\s().-]*$/.test(v)) return "'" + v;
  return v;
}
async function adminRecords(body, reload = true) {
  if (reload || !state.records) state.records = await api('/admin/records');
  if (!state.recordsTab) state.recordsTab = 'signups';
  if (!state.recordSort) state.recordSort = {};
  const data = state.records, key = state.recordsTab, set = RECORD_SETS[key];
  const q = (state.recordQuery || '').trim().toLowerCase();
  const sort = state.recordSort[key] || { key: set.sortKey, dir: 'desc' };
  const colType = (k) => (set.cols.find((c) => c[1] === k) || [])[2];
  let rows = (data[key] || []).filter((r) => !q || set.cols.some(([, k, t]) => String(cellText(t, r[k])).toLowerCase().includes(q)));
  rows = [...rows].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    if ((x ?? '') === '' && (y ?? '') === '') return 0;
    if ((x ?? '') === '') return 1; if ((y ?? '') === '') return -1;   // blanks always last
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return sort.dir === 'asc' ? c : -c;
  });
  const soldUnits = data.purchases.reduce((n, r) => n + Number(r.qty || 0), 0);
  const stats = [['Customers signed up', data.signups.length], ['Logins recorded', data.logins.length], ['Items sold', soldUnits], ['Bookings', data.bookings.length]];
  body.innerHTML = `
    <section class="sheet-intro"><div><span class="eyebrow">STUDIO RECORDS</span><h2>Customer activity</h2><p class="small-note">Everything in one place — like a spreadsheet. Click a column heading to sort, search to filter, and download to open in Excel or Google Sheets.</p></div></section>
    <div class="sheet-stats">${stats.map(([l, n]) => `<div><strong>${n}</strong><span>${l}</span></div>`).join('')}</div>
    <div class="sheet-card">
      <div class="sheet-tabs" role="tablist">${Object.entries(RECORD_SETS).map(([k, v]) => `<button role="tab" aria-selected="${k === key}" class="${k === key ? 'active' : ''}" data-rtab="${k}">${v.label} <span>${(data[k] || []).length}</span></button>`).join('')}</div>
      <div class="sheet-toolbar"><input id="recordSearch" type="search" class="compact-search" placeholder="Search ${set.label.toLowerCase()}…" value="${esc(state.recordQuery || '')}"><span class="small-note">${rows.length} row${rows.length === 1 ? '' : 's'}</span><button class="btn ghost small" id="recordCsv">Download CSV</button></div>
      <div class="sheet-scroll"><table class="sheet"><thead><tr><th class="row-no">#</th>${set.cols.map(([label, k, t]) => `<th data-sort="${k}" class="${t === 'num' || t === 'money' ? 'num' : ''} ${sort.key === k ? 'sorted' : ''}" aria-sort="${sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}" tabindex="0">${label}<i>${sort.key === k ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</i></th>`).join('')}</tr></thead>
      <tbody>${rows.length ? rows.map((r, i) => `<tr><td class="row-no">${i + 1}</td>${set.cols.map(([, k, t]) => `<td class="${t === 'num' || t === 'money' ? 'num' : ''}">${cellHtml(t, r[k])}</td>`).join('')}</tr>`).join('') : `<tr><td class="sheet-empty" colspan="${set.cols.length + 1}">${q ? 'No rows match your search.' : set.empty}</td></tr>`}</tbody></table></div>
    </div>`;
  body.querySelectorAll('[data-rtab]').forEach((b) => (b.onclick = () => { state.recordsTab = b.dataset.rtab; state.recordQuery = ''; adminRecords(body, false); }));
  const resort = (th) => { const k = th.dataset.sort; const cur = state.recordSort[key] || { key: set.sortKey, dir: 'desc' }; state.recordSort[key] = { key: k, dir: cur.key === k && cur.dir === 'asc' ? 'desc' : 'asc' }; adminRecords(body, false); };
  body.querySelectorAll('[data-sort]').forEach((th) => { th.onclick = () => resort(th); th.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resort(th); } }; });
  const search = document.getElementById('recordSearch');
  search.oninput = () => { state.recordQuery = search.value; const pos = search.selectionStart; adminRecords(body, false).then(() => { const el = document.getElementById('recordSearch'); el.focus(); el.setSelectionRange(pos, pos); }); };
  document.getElementById('recordCsv').onclick = () => downloadCSV(`polished-${key}-${todayStr()}.csv`, [set.cols.map((c) => c[0]), ...rows.map((r) => set.cols.map(([, k, t]) => cellText(t, r[k])))]);
}

async function adminBookings(body) {
  const list = await api('/bookings');
  const month = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
  const monthTitle = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const selectedDate = state.selectedAdminDate || todayStr();
  if (!state.selectedAdminDate) state.selectedAdminDate = selectedDate;
  const dateBookings = list.filter(b => b.date === selectedDate).sort((a,b) => a.time.localeCompare(b.time));
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const calendarCells = Array.from({length:cells}, (_,idx) => {
    const dayNum = idx - firstWeekday + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return '<div class="month-day outside"></div>';
    const date = `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
    const dayList = list.filter(b => b.date === date && !['declined','cancelled'].includes(b.status));
    return `<div class="month-day ${date===todayStr()?'today':''} ${date===selectedDate?'selected-day':''}"><button type="button" class="calendar-day-pick" data-caldate="${date}">${dayNum}</button><div class="day-events">${dayList.slice(0,2).map(b=>`<button type="button" class="day-event status-${esc(b.status)}" data-caldate="${date}" title="${esc(b.serviceName)} — ${fmtTime(b.time)}">${esc(b.time)} ${esc(b.customerName||'Booking')}</button>`).join('')}${dayList.length>2?`<small>+${dayList.length-2} more</small>`:''}</div></div>`;
  }).join('');
  const groups = [['Needs your approval', list.filter((b) => b.status === 'pending')],
    ['Accepted', list.filter((b) => b.status === 'accepted')],
    ['Past & closed', list.filter((b) => ['completed', 'declined', 'cancelled'].includes(b.status))]];
  body.innerHTML = `
    <section class="card calendar-card admin-booking-calendar">
      <div class="calendar-header"><div><span class="eyebrow">STUDIO SCHEDULE</span><h2>${monthTitle}</h2></div><div class="calendar-nav"><button class="btn ghost small" id="prevMonth" aria-label="Previous month">←</button><button class="btn ghost small" id="thisMonth">Today</button><button class="btn ghost small" id="nextMonth" aria-label="Next month">→</button></div></div>
      <div class="month-grid">${weekdays.map(d=>`<div class="weekday">${d}</div>`).join('')}${calendarCells}</div>
      <div class="calendar-detail"><div><span class="eyebrow">SELECTED DATE</span><h3>${fmtDate(selectedDate)}</h3><p>${dateBookings.length} appointment${dateBookings.length===1?'':'s'} scheduled</p></div><div class="calendar-selected-list">${dateBookings.length ? dateBookings.map(b=>`<div class="calendar-selected-item"><div><strong>${fmtTime(b.time)} · ${esc(b.serviceName)}</strong><p>${esc(b.customerName)} · ${esc(b.customerPhone||'no phone')}</p>${badge(b.status)}</div><div class="actions">${b.status==='pending'?`<button class="btn small ok" data-b="${b.id}:accepted">Accept</button><button class="btn small bad" data-b="${b.id}:declined">Decline</button>`:''}${b.status==='accepted'?`<button class="btn small" data-b="${b.id}:completed">Mark completed</button>`:''}</div></div>`).join(''):'<p class="small-note">No appointments on this date.</p>'}</div></div>
    </section>
    <div class="booking-list-toolbar"><div><span class="eyebrow">BOOKING MANAGEMENT</span><h2>All appointments</h2></div><input id="bookingSearch" class="compact-search" type="search" placeholder="Search customer or service…"></div>
    <div id="bookingGroups">${groups.map(([title, items], idx) => `
    <div class="card booking-group" data-group="${idx}"><h2>${title} (${items.length})</h2>
    ${items.length ? items.map((b) => `
      <div class="item booking-admin-row" data-search="${esc(`${b.serviceName} ${b.customerName} ${b.customerEmail} ${b.date} ${b.status}`.toLowerCase())}">
        <div><strong>${esc(b.serviceName)}</strong> ${badge(b.status)}
          <div class="meta">${fmtDate(b.date)} at ${fmtTime(b.time)} · ${money(b.price)}</div>
          <div class="meta">${esc(b.customerName)} · ${esc(b.customerPhone || 'no phone')} · ${esc(b.customerEmail)}</div>
          ${b.notes ? `<div class="meta">Note: ${esc(b.notes)}</div>` : ''}</div>
        <div class="actions">
          ${b.status === 'pending' ? `<button class="btn small ok" data-b="${b.id}:accepted">Accept</button><button class="btn small bad" data-b="${b.id}:declined">Decline</button>` : ''}
          ${b.status === 'accepted' ? `<button class="btn small" data-b="${b.id}:completed">Mark completed</button><button class="btn small ghost" data-b="${b.id}:declined">Decline</button>` : ''}
        </div>
      </div>`).join('') : '<div class="empty">Nothing here.</div>'}</div>`).join('')}</div>`;
  document.getElementById('prevMonth').onclick = () => { state.calendarMonth = new Date(month.getFullYear(), month.getMonth()-1, 1); adminBookings(body); };
  document.getElementById('nextMonth').onclick = () => { state.calendarMonth = new Date(month.getFullYear(), month.getMonth()+1, 1); adminBookings(body); };
  document.getElementById('thisMonth').onclick = () => { state.calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); state.selectedAdminDate = todayStr(); adminBookings(body); };
  body.querySelectorAll('[data-caldate]').forEach(btn => btn.onclick = () => { state.selectedAdminDate = btn.dataset.caldate; adminBookings(body); });
  const search = document.getElementById('bookingSearch');
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    body.querySelectorAll('.booking-admin-row').forEach(row => row.hidden = !row.dataset.search.includes(q));
    body.querySelectorAll('.booking-group').forEach(group => { const rows = [...group.querySelectorAll('.booking-admin-row')]; group.hidden = rows.length > 0 && rows.every(row => row.hidden); });
  };
  body.querySelectorAll('[data-b]').forEach((btn) => (btn.onclick = async () => {
    const [id, status] = btn.dataset.b.split(':');
    try { await api('/bookings/' + id, 'PATCH', { status }); toast('Booking ' + status + '.'); viewAdmin(); }
    catch (err) { toast(err.message, true); }
  }));
}

async function adminOrders(body) {
  const list = await api('/orders');
  body.innerHTML = `<div class="card">${list.length ? list.map((o) => orderCard(o, true)).join('') : '<div class="empty">No orders yet.</div>'}</div>`;
  body.querySelectorAll('[data-ostatus]').forEach((btn) => (btn.onclick = async () => {
    const [id, status] = btn.dataset.ostatus.split(':');
    try { await api('/orders/' + id, 'PATCH', { status }); toast('Order ' + status + '.'); viewAdmin(); }
    catch (err) { toast(err.message, true); }
  }));
}

async function adminProducts(body) {
  const list = await api('/products');
  const e = state.editing && list.find((p) => p.id === state.editing);
  body.innerHTML = `
    <div class="card stock-editor-card"><span class="eyebrow">INVENTORY MANAGEMENT</span><h2>${e ? 'Edit nail stock item' : 'Add a nail stock item'}</h2><p class="small-note">Update nail set details, pricing and available quantity.</p>
      <form id="pform">
        <div class="row"><div><label>Name</label><input name="name" required value="${esc(e?.name)}"></div>
        <div style="max-width:100px"><label>Emoji fallback</label><input name="emoji" maxlength="4" value="${esc(e?.emoji || '💅')}"></div></div>
        <label>Product image URL</label><input name="imageUrl" type="url" placeholder="https://example.com/your-nail-set.jpg" value="${esc(e?.imageUrl || '')}">
        <p class="small-note">Add a direct image link to show a real photo. Leave blank to use the illustrated nail preview below.</p>
        <label for="nailColor">Nail set colour</label><div class="nail-color-picker"><input id="nailColor" name="nailColor" type="color" value="${esc(e?.nailColor || '#d98c9a')}" aria-label="Choose nail set colour"><span id="nailColorValue">${esc(e?.nailColor || '#d98c9a')}</span><div class="nail-color-preview" id="nailColorPreview" style="--nail-color:${esc(e?.nailColor || '#d98c9a')}"><div class="nail-set-art"><i></i><i></i><i></i><i></i><i></i></div></div></div>
        <p class="small-note">Choose any colour. It updates the illustrated nail set in the shop and stock list when no product photo is provided.</p>
        <label>Description</label><textarea name="description">${esc(e?.description)}</textarea>
        <div class="row"><div><label>Price (S$)</label><input name="price" type="number" min="0" step="0.01" required value="${e ? e.price : ''}"></div>
        <div><label>Stock</label><input name="stock" type="number" min="0" step="1" required value="${e ? e.stock : ''}"></div></div>
        <p><button class="btn">${e ? 'Save changes' : 'Add product'}</button>
        ${e ? '<button type="button" class="btn ghost" id="cancelEdit">Cancel</button>' : ''}</p>
      </form></div>
    <div class="card stock-list-card"><div class="card-heading"><div><span class="eyebrow">YOUR INVENTORY</span><h2>Nail stock (${list.length})</h2></div><span class="subtle-tag">${list.reduce((n,p)=>n+Number(p.stock||0),0)} total units</span></div>
      ${list.map((p) => `
        <div class="item stock-item" style="align-items:center">
          <div class="stock-product-info"><div class="stock-thumb tone-${list.indexOf(p)%4}">${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" onerror="this.remove()">` : `<div class="nail-set-art" style="--nail-color:${esc(p.nailColor || '#d98c9a')}" aria-label="Nail set preview"><i></i><i></i><i></i><i></i><i></i></div>`}</div><div><strong>${esc(p.name)}</strong><div class="meta">${money(p.price)} · <strong class="stock-count ${Number(p.stock||0)<=5?'stock-low':''}">${p.stock} in stock</strong> ${Number(p.stock||0)<=5?'<span class="stock-warning">Low stock</span>':''}</div></div></div>
          <div class="actions"><button class="btn small ghost" data-edit="${p.id}">Edit</button><button class="btn small bad" data-del="${p.id}">Delete</button></div>
        </div>`).join('') || '<div class="empty">No products.</div>'}</div>`;
  document.getElementById('pform').onsubmit = async (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(ev.target));
    try {
      if (e) await api('/products/' + e.id, 'PUT', data); else await api('/products', 'POST', data);
      toast('Saved.'); state.editing = null; viewAdmin();
    } catch (err) { toast(err.message, true); }
  };
  const nailColor = document.getElementById('nailColor');
  if (nailColor) nailColor.oninput = () => { const preview = document.getElementById('nailColorPreview'); const value = document.getElementById('nailColorValue'); preview.style.setProperty('--nail-color', nailColor.value); value.textContent = nailColor.value.toUpperCase(); };
  const ce = document.getElementById('cancelEdit'); if (ce) ce.onclick = () => { state.editing = null; viewAdmin(); };
  body.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => { state.editing = b.dataset.edit; viewAdmin(); window.scrollTo(0, 0); }));
  body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Delete this product?')) return;
    try { await api('/products/' + b.dataset.del, 'DELETE'); toast('Deleted.'); viewAdmin(); } catch (err) { toast(err.message, true); }
  }));
}

/* ===== boot ===== */
(async function init() {
  if (state.token) {
    try { state.user = (await api('/me')).user; } catch { logoutLocal(); }
  }
  render();
})();
