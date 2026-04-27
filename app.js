require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();

/* =========================
   ejs
========================= */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* =========================
   기본 설정
========================= */
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors({
  origin: 'http://127.0.0.1:5500',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use((req, res, next) => {
  const role = req.session?.role || null;

  res.locals.currentUser = {
    loggedIn: Boolean(req.session?.userId),
    username: req.session?.username || '',
    nickname: req.session?.nickname || '',
    role,
    profileImage: req.session?.profileImage || '/images/normal user.jpg',
    canManageProducts: role === 'seller' || role === 'admin',
    isAdmin: role === 'admin'
  };

  next();
});

/* =========================
   DB 연결
========================= */
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('MySQL 연결 실패:', err);
  } else {
    console.log('MySQL 연결 성공!');
  }
});

/* =========================
   Routes
========================= */
const mainRoutes = require('./routes/mainRoutes');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const qnaRoutes = require('./routes/qnaRoutes');
const adminRoutes = require('./routes/adminRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const settlementRoutes = require('./routes/settlementRoutes');

app.use(mainRoutes);
app.use(authRoutes(db, bcrypt));
app.use(productRoutes(db));
app.use(cartRoutes(db));
app.use(orderRoutes(db, path));
app.use(qnaRoutes(db));
app.use(adminRoutes(db));
app.use(sellerRoutes(db));
app.use(settlementRoutes(db));

/* =========================
   서버 실행
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버 실행됨 http://127.0.0.1:${PORT}`);
});
