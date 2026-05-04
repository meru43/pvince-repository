const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // 상품 목록 API
    router.get('/api/products', (req, res) => {
        const sql = `
        SELECT
            products.*,
            COALESCE(users.nickname, users.username) AS uploader_name,
            users.profile_image AS uploader_profile_image
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
        const currentUserId = Number(req.session.userId || 0);
        const currentUserRole = String(req.session.role || '');

        const sql = `
            SELECT
                products.*,
                COALESCE(users.nickname, users.username) AS uploader_name,
                users.profile_image AS uploader_profile_image
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

            const reviewSql = `
                SELECT
                    pr.id,
                    pr.rating,
                    pr.content,
                    pr.created_at,
                    COALESCE(u.nickname, u.username) AS author_name
                FROM product_reviews pr
                JOIN users u ON pr.user_id = u.id
                WHERE pr.product_id = ?
                ORDER BY pr.created_at DESC, pr.id DESC
            `;

            db.query(reviewSql, [productId], (reviewErr, reviewRows) => {
                if (reviewErr) {
                    console.error('product reviews query error:', reviewErr);
                    return res.json({
                        success: false,
                        message: '상품 상세 불러오기 실패'
                    });
                }

                const reviews = Array.isArray(reviewRows) ? reviewRows : [];
                const reviewCount = reviews.length;
                const averageRating = reviewCount
                    ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount).toFixed(1))
                    : 0;

                product.is_owner = currentUserId > 0 && Number(product.created_by) === currentUserId;
                product.is_admin = currentUserRole === 'admin';
                product.can_purchase = !product.is_owner;
                product.display_description = product.ai_summary_text || product.description || '';
                product.average_rating = averageRating;
                product.review_count = reviewCount;
                product.reviews = reviews;

                product.keywordList = product.keywords
                    ? product.keywords.split(',').map(v => v.trim()).filter(Boolean)
                    : [];

                return res.json({
                    success: true,
                    product
                });
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
               OR COALESCE(products.ai_summary_text, '') LIKE ?
               OR products.keywords LIKE ?
            ORDER BY products.id DESC
        `;

        db.query(sql, [likeValue, likeValue, likeValue, likeValue], (err, results) => {
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
