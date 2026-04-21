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

// public 폴더 안의 css, js, images를 브라우저에서 접근 가능하게 함
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
   페이지 라우트
========================= */

// 메인 페이지
app.get('/', (req, res) => {
  res.render('main');
});

// 상품 리스트 페이지
app.get('/products-page', (req, res) => {
  res.render('product-list');
});

// 상품 상세 페이지
app.get('/products-page/:id', (req, res) => {
  res.render('product-detail');
});

// 로그인 페이지
app.get('/login-page', (req, res) => {
  res.render('login');
});

// 장바구니 페이지
app.get('/cart-page', (req, res) => {
  res.render('cart');
});

// 주문 페이지
app.get('/order-page', (req, res) => {
  res.render('order');
});

// 주문 완료 페이지
app.get('/order-complete-page', (req, res) => {
  res.render('order-complete');
});

// 주문 조회 페이지
app.get('/order-check-page', (req, res) => {
  res.render('order-check');
});

// 마이페이지
app.get('/mypage-page', (req, res) => {
  res.render('mypage');
});

// Q&A 페이지
app.get('/qna-page', (req, res) => {
  res.render('qna');
});

app.get('/qna-detail-page/:id', (req, res) => {
  res.render('qna-detail');
});

app.get('/qna-write-page', (req, res) => {
  res.render('qna-write')
});

// 회원가입 페이지
app.get('/register-page', (req, res) => {
  res.render('register');
});

/* =========================
   회원가입 / 로그인 API
========================= */

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

    if (results.length === 0) {
      return res.json({
        success: false,
        message: '아이디 또는 비밀번호가 틀렸습니다.'
      });
    }

    const user = results[0];

    try {
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        req.session.userId = user.id;
        req.session.username = user.username;

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

/* =========================
   상품 API
========================= */

// 상품 목록 API
app.get('/api/products', (req, res) => {
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

// 상품 상세 API
app.get('/api/products/:id', (req, res) => {
  const productId = req.params.id;
  const sql = 'SELECT * FROM products WHERE id = ?';

  db.query(sql, [productId], (err, results) => {
    if (err) {
      console.error('상품 상세 조회 오류:', err);
      return res.json({
        success: false,
        message: '상품 상세 불러오기 실패'
      });
    }

    if (results.length === 0) {
      return res.json({
        success: false,
        message: '상품을 찾을 수 없습니다.'
      });
    }

    return res.json({
      success: true,
      product: results[0]
    });
  });
});

/* =========================
   장바구니 담기 API
========================= */
app.post('/api/cart', (req, res) => {
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

  const sql = `
    INSERT INTO cart_items (user_id, product_id)
    VALUES (?, ?)
  `;

  db.query(sql, [req.session.userId, productId], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.json({
          success: false,
          message: '이미 장바구니에 담긴 상품입니다.'
        });
      }

      console.error('장바구니 저장 오류:', err);
      return res.json({
        success: false,
        message: '장바구니 저장에 실패했습니다.'
      });
    }

    return res.json({
      success: true,
      message: '장바구니에 담았습니다.'
    });
  });
});

/* =========================
   장바구니 목록 조회 API
========================= */
app.get('/api/cart', (req, res) => {
  if (!req.session.userId) {
    return res.json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }

  const sql = `
    SELECT
      cart_items.id AS cart_id,
      products.id AS product_id,
      products.title,
      products.price,
      products.description,
      products.file_name
    FROM cart_items
    JOIN products ON cart_items.product_id = products.id
    WHERE cart_items.user_id = ?
    ORDER BY cart_items.id DESC
  `;

  db.query(sql, [req.session.userId], (err, results) => {
    if (err) {
      console.error('장바구니 목록 조회 오류:', err);
      return res.json({
        success: false,
        message: '장바구니를 불러오지 못했습니다.'
      });
    }

    return res.json({
      success: true,
      items: results
    });
  });
});

/* =========================
   장바구니 삭제 API
========================= */
app.delete('/api/cart/:cartId', (req, res) => {
  const cartId = req.params.cartId;

  if (!req.session.userId) {
    return res.json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }

  const sql = `
    DELETE FROM cart_items
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [cartId, req.session.userId], (err, result) => {
    if (err) {
      console.error('장바구니 삭제 오류:', err);
      return res.json({
        success: false,
        message: '장바구니 삭제에 실패했습니다.'
      });
    }

    return res.json({
      success: true,
      message: '장바구니에서 삭제되었습니다.'
    });
  });
});

/* =========================
   주문 생성 API
========================= */
app.post('/api/orders', (req, res) => {
  if (!req.session.userId) {
    return res.json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }

  const userId = req.session.userId;
  const orderNumber = `ORD-${Date.now()}`;
  console.log('주문 생성 세션 확인:', req.session);
  console.log('주문 생성 userId:', userId);

  const cartSql = `
    SELECT
      cart_items.product_id,
      products.price
    FROM cart_items
    JOIN products ON cart_items.product_id = products.id
    WHERE cart_items.user_id = ?
  `;

  db.query(cartSql, [userId], (cartErr, cartItems) => {
    if (cartErr) {
      console.error('주문용 장바구니 조회 오류:', cartErr);
      return res.json({
        success: false,
        message: '주문 정보를 불러오지 못했습니다.'
      });
    }

    if (!cartItems.length) {
      return res.json({
        success: false,
        message: '장바구니가 비어 있습니다.'
      });
    }

    const totalPrice = cartItems.reduce((sum, item) => sum + Number(item.price), 0);

    const orderSql = `
      INSERT INTO orders (user_id, order_number, total_price, status)
      VALUES (?, ?, ?, 'paid')
    `;

    db.query(orderSql, [userId, orderNumber, totalPrice], (orderErr, orderResult) => {
      if (orderErr) {
        console.error('주문 생성 오류:', orderErr);
        return res.json({
          success: false,
          message: '주문 생성에 실패했습니다.'
        });
      }

      const orderId = orderResult.insertId;
      const orderItemsValues = cartItems.map(item => [orderId, item.product_id, item.price]);

      const orderItemsSql = `
        INSERT INTO order_items (order_id, product_id, price)
        VALUES ?
      `;

      db.query(orderItemsSql, [orderItemsValues], (itemsErr) => {
        if (itemsErr) {
          console.error('주문 상품 저장 오류:', itemsErr);
          return res.json({
            success: false,
            message: '주문 상품 저장에 실패했습니다.'
          });
        }

        const purchaseValues = cartItems.map(item => [userId, item.product_id]);

        const purchaseSql = `
          INSERT IGNORE INTO purchases (user_id, product_id)
          VALUES ?
        `;

        db.query(purchaseSql, [purchaseValues], (purchaseErr) => {
          if (purchaseErr) {
            console.error('구매 내역 저장 오류:', purchaseErr);
            return res.json({
              success: false,
              message: '구매 내역 저장에 실패했습니다.'
            });
          }

          const clearCartSql = `
            DELETE FROM cart_items
            WHERE user_id = ?
          `;

          db.query(clearCartSql, [userId], (clearErr) => {
            if (clearErr) {
              console.error('장바구니 비우기 오류:', clearErr);
              return res.json({
                success: false,
                message: '장바구니 비우기에 실패했습니다.'
              });
            }

            return res.json({
              success: true,
              message: '주문이 완료되었습니다.',
              orderNumber,
              totalPrice
            });
          });
        });
      });
    });
  });
});

/* =========================
   구매 / 다운로드 API
========================= */

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

/* =========================
   내 구매 / 다운로드 기록 API
========================= */

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
      products.price,
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

app.get('/my-download-logs', (req, res) => {
  if (!req.session.userId) {
    return res.json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }

  const sql = `
    SELECT
      download_logs.id AS log_id,
      download_logs.downloaded_at,
      products.id AS product_id,
      products.title,
      products.price,
      products.file_name
    FROM download_logs
    JOIN products ON download_logs.product_id = products.id
    WHERE download_logs.user_id = ?
    ORDER BY download_logs.downloaded_at DESC
  `;

  db.query(sql, [req.session.userId], (err, results) => {
    if (err) {
      console.error('내 다운로드 기록 조회 오류:', err);
      return res.json({
        success: false,
        message: '다운로드 기록 불러오기 실패'
      });
    }

    return res.json({
      success: true,
      logs: results
    });
  });
});


/* =========================
   Q&A
========================= */
// 글저장
app.post('/api/qna', (req, res) => {
  const title = req.body.title?.trim();
  const writer = req.body.writer?.trim();
  const content = req.body.content?.trim();

  console.log('Q&A 저장 요청값:', { title, writer, content });

  if (!title || !writer || !content) {
    return res.json({
      success: false,
      message: '제목, 작성자, 내용을 모두 입력해주세요.'
    });
  }

  const sql = `
    INSERT INTO qna_posts (title, writer, content)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [title, writer, content], (err, result) => {
    if (err) {
      console.error('Q&A 글 저장 오류:', err);
      return res.json({
        success: false,
        message: '글 저장에 실패했습니다.'
      });
    }

    return res.json({
      success: true,
      message: '글이 등록되었습니다.',
      postId: result.insertId
    });
  });
});

// 목록조회
app.get('/api/qna', (req, res) => {
  const sql = `
    SELECT
      id,
      title,
      writer,
      is_notice,
      views,
      created_at,
      answer_content
    FROM qna_posts
    ORDER BY is_notice DESC, id DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Q&A 목록 조회 오류:', err);
      return res.json({
        success: false,
        message: '목록을 불러오지 못했습니다.'
      });
    }

    return res.json({
      success: true,
      posts: results
    });
  });
});
// 상세조회 조회, 조회수 증가
app.get('/api/qna/:id', (req, res) => {
  const postId = req.params.id;

  const updateSql = 'UPDATE qna_posts SET views = views + 1 WHERE id = ?';

  db.query(updateSql, [postId], (updateErr) => {
    if (updateErr) {
      console.error('조회수 증가 오류:', updateErr);
    }

    const selectSql = `
      SELECT
        id,
        title,
        writer,
        content,
        is_notice,
        views,
        created_at,
        answer_content,
        answer_created_at
      FROM qna_posts
      WHERE id = ?
    `;

    db.query(selectSql, [postId], (err, results) => {
      if (err) {
        console.error('Q&A 상세 조회 오류:', err);
        return res.json({
          success: false,
          message: '상세 내용을 불러오지 못했습니다.'
        });
      }

      if (results.length === 0) {
        return res.json({
          success: false,
          message: '게시글을 찾을 수 없습니다.'
        });
      }

      return res.json({
        success: true,
        post: results[0]
      });
    });
  });
});

// 관리자 답변
app.post('/api/qna/:id/answer', (req, res) => {
  const postId = req.params.id;
  const answerContent = req.body.answerContent?.trim();

  if (!req.session.userId) {
    return res.json({
      success: false,
      message: '로그인이 필요합니다.'
    });
  }

  if (!answerContent) {
    return res.json({
      success: false,
      message: '답변 내용을 입력해주세요.'
    });
  }

  const sql = `
    UPDATE qna_posts
    SET answer_content = ?, answer_created_at = NOW()
    WHERE id = ?
  `;

  db.query(sql, [answerContent, postId], (err) => {
    if (err) {
      console.error('Q&A 답변 저장 오류:', err);
      return res.json({
        success: false,
        message: '답변 저장에 실패했습니다.'
      });
    }

    return res.json({
      success: true,
      message: '답변이 등록되었습니다.'
    });
  });
});

/* =========================
   서버 실행
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버 실행됨 http://127.0.0.1:${PORT}`);
});