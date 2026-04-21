const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // 상품 목록 API
    router.get('/api/products', (req, res) => {
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
    router.get('/api/products/:id', (req, res) => {
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

    return router;
};