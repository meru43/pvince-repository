const express = require('express');

module.exports = (db, path) => {
    const router = express.Router();

    // 주문 생성 API
    router.post('/api/orders', (req, res) => {
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

    // 구매 / 다운로드 API
    router.post('/purchase', (req, res) => {
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

    router.get('/download/:productId', (req, res) => {
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
                const filePath = path.join(__dirname, '..', product.file_path);

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

    // 내 구매 / 다운로드 기록 API
    router.get('/my-products', (req, res) => {
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

    router.get('/my-download-logs', (req, res) => {
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

    return router;
};