const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // 장바구니 담기 API
    router.post('/api/cart', (req, res) => {
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

    // 장바구니 목록 조회 API
    router.get('/api/cart', (req, res) => {
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

    // 장바구니 삭제 API
    router.delete('/api/cart/:cartId', (req, res) => {
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

        db.query(sql, [cartId, req.session.userId], (err) => {
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

    return router;
};