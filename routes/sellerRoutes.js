const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    function requireSellerOrAdmin(req, res, next) {
        if (!req.session.userId) {
            return res.redirect('/login-page');
        }

        if (req.session.role !== 'seller' && req.session.role !== 'admin') {
            return res.redirect('/');
        }

        next();
    }

    function requireSellerOrAdminApi(req, res, next) {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        if (req.session.role !== 'seller' && req.session.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '셀러 또는 관리자만 접근할 수 있습니다.'
            });
        }

        next();
    }

    // 상품 등록 페이지
    router.get('/seller-upload-page', requireSellerOrAdmin, (req, res) => {
        res.render('seller-upload');
    });

    // 상품 등록 API
    router.post('/api/seller/products', requireSellerOrAdminApi, (req, res) => {
        const title = req.body.title?.trim();
        const price = req.body.price;
        const description = req.body.description?.trim();
        const fileName = req.body.fileName?.trim();
        const filePath = req.body.filePath?.trim();

        if (!title || !price || !description || !fileName || !filePath) {
            return res.json({
                success: false,
                message: '모든 항목을 입력해주세요.'
            });
        }

        const sql = `
            INSERT INTO products (
                title,
                price,
                description,
                file_name,
                file_path,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                title,
                Number(price),
                description,
                fileName,
                filePath,
                req.session.userId
            ],
            (err, result) => {
                if (err) {
                    console.error('상품 등록 오류:', err);
                    return res.json({
                        success: false,
                        message: '상품 등록에 실패했습니다.'
                    });
                }

                return res.json({
                    success: true,
                    message: '상품이 등록되었습니다.',
                    productId: result.insertId
                });
            }
        );
    });

    return router;
};