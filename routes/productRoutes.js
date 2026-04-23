const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // 상품 목록 API
    router.get('/api/products', (req, res) => {
        const sql = `
        SELECT
            products.*,
            COALESCE(users.nickname, users.username) AS uploader_name
        FROM products
        LEFT JOIN users ON products.created_by = users.id
        WHERE products.is_active = 1
        ORDER BY products.id DESC
    `;

        db.query(sql, (err, results) => {
            if (err) {
                console.error('상품 목록 조회 오류:', err);
                return res.json({
                    success: false,
                    message: '상품 목록 불러오기 실패'
                });
            }

            const products = results.map(product => ({
                ...product,
                keywordList: product.keywords
                    ? product.keywords.split(',').map(v => v.trim()).filter(Boolean)
                    : []
            }));

            return res.json({
                success: true,
                products
            });
        });
    });

    // 상품 상세 API
    router.get('/api/products/:id', (req, res) => {
        const productId = req.params.id;

        const sql = `
            SELECT
                products.*,
                COALESCE(users.nickname, users.username) AS uploader_name
            FROM products
            LEFT JOIN users ON products.created_by = users.id
            WHERE products.id = ?
            AND products.is_active = 1
            LIMIT 1
        `;

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
                    message: '현재 판매중지된 상품입니다. 상세보기가 제한됩니다.'
                });
            }

            const product = results[0];

            product.keywordList = product.keywords
                ? product.keywords.split(',').map(v => v.trim()).filter(Boolean)
                : [];

            return res.json({
                success: true,
                product
            });
        });
    });

    // 상품 검색 API
    router.get('/api/search/products', (req, res) => {
        const q = req.query.q?.trim();

        if (!q) {
            return res.json({
                success: true,
                products: []
            });
        }

        const likeValue = `%${q}%`;

        const sql = `
            SELECT
                products.*,
                COALESCE(users.nickname, users.username) AS uploader_name
            FROM products
            LEFT JOIN users ON products.created_by = users.id
            WHERE products.title LIKE ?
               OR products.description LIKE ?
               OR products.keywords LIKE ?
            ORDER BY products.id DESC
        `;

        db.query(sql, [likeValue, likeValue, likeValue], (err, results) => {
            if (err) {
                console.error('상품 검색 오류:', err);
                return res.json({
                    success: false,
                    message: '상품 검색 실패'
                });
            }

            const products = results.map(product => ({
                ...product,
                keywordList: product.keywords
                    ? product.keywords.split(',').map(v => v.trim()).filter(Boolean)
                    : []
            }));

            return res.json({
                success: true,
                products
            });
        });
    });

    // 추천상품
    router.get('/api/featured-products', (req, res) => {
        const sql = `
        SELECT
            products.*,
            COALESCE(users.nickname, users.username) AS uploader_name
        FROM products
        LEFT JOIN users ON products.created_by = users.id
        WHERE products.is_active = 1
          AND products.is_featured = 1
        ORDER BY products.id DESC
        LIMIT 6
    `;

        db.query(sql, (err, results) => {
            if (err) {
                console.error('추천 상품 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '추천 상품을 불러오지 못했습니다.'
                });
            }

            return res.json({
                success: true,
                products: results
            });
        });
    });

    return router;
};