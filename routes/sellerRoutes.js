const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

    const thumbnailDir = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails');
    const productFileDir = path.join(__dirname, '..', 'public', 'uploads', 'products');

    if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    if (!fs.existsSync(productFileDir)) {
        fs.mkdirSync(productFileDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            if (file.fieldname === 'thumbnail') {
                cb(null, thumbnailDir);
            } else if (file.fieldname === 'productFile') {
                cb(null, productFileDir);
            } else {
                cb(new Error('알 수 없는 파일 필드입니다.'));
            }
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const baseName = path.basename(file.originalname, ext).replace(/[^\w가-힣.-]/g, '_');
            cb(null, `${Date.now()}_${baseName}${ext}`);
        }
    });

    const upload = multer({ storage });

    // 상품 등록 페이지
    router.get('/seller-upload-page', requireSellerOrAdmin, (req, res) => {
        res.render('seller-upload');
    });

    // 상품 등록 API
    router.post(
        '/api/seller/products',
        requireSellerOrAdminApi,
        upload.fields([
            { name: 'thumbnail', maxCount: 1 },
            { name: 'productFile', maxCount: 1 }
        ]),
        (req, res) => {
            const title = req.body.title?.trim();
            const price = req.body.price;
            const salePrice = req.body.salePrice;
            const isFree = req.body.isFree === '1' ? 1 : 0;
            const description = req.body.description?.trim();
            const keywords = req.body.keywords?.trim();

            const thumbnail = req.files?.thumbnail?.[0];
            const productFile = req.files?.productFile?.[0];

            if (!title) {
                return res.json({
                    success: false,
                    message: '상품명을 입력해주세요.'
                });
            }

            if (!isFree && (!price || Number(price) < 0)) {
                return res.json({
                    success: false,
                    message: '올바른 판매가를 입력해주세요.'
                });
            }

            if (!description) {
                return res.json({
                    success: false,
                    message: '상품 설명을 입력해주세요.'
                });
            }

            if (!thumbnail) {
                return res.json({
                    success: false,
                    message: '상품 썸네일을 업로드해주세요.'
                });
            }

            if (!productFile) {
                return res.json({
                    success: false,
                    message: '판매상품 파일을 업로드해주세요.'
                });
            }

            const cleanedKeywords = (keywords || '')
                .split(',')
                .map(v => v.trim())
                .filter(Boolean)
                .join(',');

            const fileName = productFile.originalname;
            const filePath = `/uploads/products/${productFile.filename}`;
            const thumbnailPath = `/uploads/thumbnails/${thumbnail.filename}`;

            const sql = `
                INSERT INTO products (
                    title,
                    price,
                    sale_price,
                    is_free,
                    description,
                    file_name,
                    file_path,
                    thumbnail_path,
                    keywords,
                    created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                title,
                isFree ? 0 : Number(price),
                isFree ? 0 : (salePrice ? Number(salePrice) : null),
                isFree,
                description,
                fileName,
                filePath,
                thumbnailPath,
                cleanedKeywords,
                req.session.userId
            ];

            db.query(sql, values, (err, result) => {
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
            });
        }
    );

    return router;
};