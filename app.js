require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();

app.use(cors({
  origin: 'http://127.0.0.1:5500',
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

const db = mysql.createConnection({
  host: process.env.DB_HOST,
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

app.get('/', (req, res) => {
  res.send('서버 켜짐!');
});

// 회원가입
app.post('/register', (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password?.trim();

  console.log('회원가입 요청값:', { username, password });

  if (!username || !password) {
    return res.json({
      success: false,
      message: '아이디와 비밀번호를 입력해주세요.'
    });
  }

  const checkSql = 'SELECT * FROM users WHERE username = ?';

  db.query(checkSql, [username], async (err, results) => {
    if (err) {
      console.error('중복 확인 오류:', err);
      return res.json({
        success: false,
        message: '서버 오류'
      });
    }

    if (results.length > 0) {
      return res.json({
        success: false,
        message: '이미 존재하는 아이디입니다.'
      });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const insertSql = 'INSERT INTO users (username, password) VALUES (?, ?)';

      db.query(insertSql, [username, hashedPassword], (err) => {
        if (err) {
          console.error('회원가입 오류:', err);
          return res.json({
            success: false,
            message: '회원가입 실패'
          });
        }

        console.log('회원가입 완료:', username);

        return res.json({
          success: true,
          message: '회원가입 완료'
        });
      });
    } catch (error) {
      console.error('비밀번호 암호화 오류:', error);
      return res.json({
        success: false,
        message: '암호화 처리 실패'
      });
    }
  });
});

// 로그인
app.post('/login', (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password?.trim();

  console.log('로그인 요청값:', { username, password });

  if (!username || !password) {
    return res.json({
      success: false,
      message: '아이디와 비밀번호를 입력해주세요.'
    });
  }

  const loginSql = 'SELECT * FROM users WHERE username = ?';

  db.query(loginSql, [username], async (err, results) => {
    if (err) {
      console.error('로그인 오류:', err);
      return res.json({
        success: false,
        message: '서버 오류'
      });
    }

    console.log('로그인 조회 결과 개수:', results.length);

    if (results.length === 0) {
      return res.json({
        success: false,
        message: '아이디 또는 비밀번호가 틀렸습니다.'
      });
    }

    const user = results[0];

    try {
      const isMatch = await bcrypt.compare(password, user.password);
      console.log('비밀번호 일치 여부:', isMatch);

      if (isMatch) {
        req.session.userId = user.id;
        req.session.username = user.username;

        console.log('로그인 성공:', username);
        console.log('세션 저장 직후:', req.session);

        return res.json({
          success: true,
          message: '로그인 성공',
          username: user.username
        });
      } else {
        return res.json({
          success: false,
          message: '아이디 또는 비밀번호가 틀렸습니다.'
        });
      }
    } catch (error) {
      console.error('비밀번호 비교 오류:', error);
      return res.json({
        success: false,
        message: '로그인 처리 실패'
      });
    }
  });
});

// 로그인 상태 확인
app.get('/me', (req, res) => {
  console.log('/me 세션 확인:', req.session);

  if (req.session.userId) {
    return res.json({
      loggedIn: true,
      userId: req.session.userId,
      username: req.session.username
    });
  } else {
    return res.json({
      loggedIn: false
    });
  }
});

// 로그아웃
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({
        success: false,
        message: '로그아웃 실패'
      });
    }

    res.clearCookie('connect.sid');

    return res.json({
      success: true,
      message: '로그아웃 완료'
    });
  });
});

app.get('/products', (req, res) => {
  const sql = 'SELECT * FROM products ORDER BY id DESC';

  db.query(sql, (err, results) => {
    if (err) {
      console.error('상품 목록 조회 오류:', err);
      return res.json({
        success: false,
        message: '상품 목록 불러오기 실패'
      });
    }

    return res.json({
      success: true,
      products: results
    });
  });
});

app.post('/purchase', (req, res) => {
  const { productId } = req.body;

  if (!req.session.userId) {
    return res.json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }

  if (!productId) {
    return res.json({
      success: false,
      message: '상품 번호가 없습니다.'
    });
  }

  const checkSql = 'SELECT * FROM purchases WHERE user_id = ? AND product_id = ?';

  db.query(checkSql, [req.session.userId, productId], (err, results) => {
    if (err) {
      console.error('구매 중복 확인 오류:', err);
      return res.json({
        success: false,
        message: '서버 오류'
      });
    }

    if (results.length > 0) {
      return res.json({
        success: false,
        message: '이미 구매한 상품입니다.'
      });
    }

    const insertSql = 'INSERT INTO purchases (user_id, product_id) VALUES (?, ?)';

    db.query(insertSql, [req.session.userId, productId], (err) => {
      if (err) {
        console.error('구매 저장 오류:', err);
        return res.json({
          success: false,
          message: '구매 실패'
        });
      }

      console.log('구매 완료:', {
        userId: req.session.userId,
        productId
      });

      return res.json({
        success: true,
        message: '구매 완료'
      });
    });
  });
});

app.get('/download/:productId', (req, res) => {
  const productId = req.params.productId;

  if (!req.session.userId) {
    return res.json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }

  const purchaseSql = `
    SELECT * FROM purchases
    WHERE user_id = ? AND product_id = ?
  `;

  db.query(purchaseSql, [req.session.userId, productId], (err, purchaseResults) => {
    if (err) {
      console.error('다운로드 권한 확인 오류:', err);
      return res.json({
        success: false,
        message: '서버 오류'
      });
    }

    if (purchaseResults.length === 0) {
      return res.json({
        success: false,
        message: '구매한 사용자만 다운로드할 수 있습니다.'
      });
    }

    const productSql = 'SELECT * FROM products WHERE id = ?';

    db.query(productSql, [productId], (err, productResults) => {
      if (err) {
        console.error('상품 조회 오류:', err);
        return res.json({
          success: false,
          message: '상품 조회 실패'
        });
      }

      if (productResults.length === 0) {
        return res.json({
          success: false,
          message: '상품을 찾을 수 없습니다.'
        });
      }

      const product = productResults[0];
      const filePath = path.join(__dirname, product.file_path);

      const logSql = 'INSERT INTO download_logs (user_id, product_id) VALUES (?, ?)';

      db.query(logSql, [req.session.userId, productId], (logErr) => {
        if (logErr) {
          console.error('다운로드 로그 저장 오류:', logErr);
        }

        return res.download(filePath, product.file_name, (err) => {
          if (err) {
            console.error('파일 다운로드 오류:', err);

            if (!res.headersSent) {
              return res.status(500).json({
                success: false,
                message: '파일 다운로드 실패'
              });
            }
          }
        });
      });
    });
  });
});

app.get('/my-products', (req, res) => {
  if (!req.session.userId) {
    return res.json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }

  const sql = `
    SELECT
      purchases.id AS purchase_id,
      purchases.purchased_at,
      products.id AS product_id,
      products.title,
      products.price,aa
      products.description,
      products.file_name,
      products.file_path
    FROM purchases
    JOIN products ON purchases.product_id = products.id
    WHERE purchases.user_id = ?
    ORDER BY purchases.purchased_at DESC
  `;

  db.query(sql, [req.session.userId], (err, results) => {
    if (err) {
      console.error('내 구매 상품 조회 오류:', err);
      return res.json({
        success: false,
        message: '내 구매 상품 불러오기 실패'
      });
    }

    return res.json({
      success: true,
      products: results
    });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버 실행됨 http://127.0.0.1:${PORT}`);
});