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
const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST,
  port: process.env.DB_PORT || process.env.MYSQLPORT,
  user: process.env.DB_USER || process.env.MYSQLUSER,
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE
};

console.log('[DB ENV CHECK]', {
  hasDbHost: Boolean(process.env.DB_HOST),
  hasMysqlHost: Boolean(process.env.MYSQLHOST),
  hasDbPort: Boolean(process.env.DB_PORT),
  hasMysqlPort: Boolean(process.env.MYSQLPORT),
  hasDbUser: Boolean(process.env.DB_USER),
  hasMysqlUser: Boolean(process.env.MYSQLUSER),
  hasDbPassword: Boolean(process.env.DB_PASSWORD),
  hasMysqlPassword: Boolean(process.env.MYSQLPASSWORD),
  hasDbName: Boolean(process.env.DB_NAME),
  hasMysqlDatabase: Boolean(process.env.MYSQLDATABASE),
  resolvedHost: dbConfig.host || null,
  resolvedPort: dbConfig.port || null,
  resolvedUser: dbConfig.user || null,
  resolvedDatabase: dbConfig.database || null
});

if (!dbConfig.host || !dbConfig.port || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
  throw new Error('Database environment variables are missing. Check Railway service variables for DB_* or MYSQL* values.');
}

const db = mysql.createConnection(dbConfig);

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
const pptLabRoutes = require('./routes/pptLabRoutes');

app.use(mainRoutes);
app.use(authRoutes(db, bcrypt));
app.use(productRoutes(db));
app.use(cartRoutes(db));
app.use(orderRoutes(db, path));
app.use(qnaRoutes(db));
app.use(adminRoutes(db));
app.use(sellerRoutes(db));
app.use(settlementRoutes(db));
app.use(pptLabRoutes(db));

/* =========================
   서버 실행
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버 실행됨 http://127.0.0.1:${PORT}`);
});
