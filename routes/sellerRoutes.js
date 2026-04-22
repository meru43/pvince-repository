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

    // 상품 관리 페이지
    router.get('/seller-products-page', requireSellerOrAdmin, (req, res) => {
        res.render('seller-products');
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

    // 내 상품 목록 API
    router.get('/api/seller/products', requireSellerOrAdminApi, (req, res) => {
        const isAdmin = req.session.role === 'admin';
        const q = (req.query.q || '').trim();
        const status = (req.query.status || '').trim(); // active | inactive | ''
        const priceType = (req.query.priceType || '').trim(); // free | paid | ''

        let sql = `
        SELECT
            products.*,
            COALESCE(users.nickname, users.username) AS uploader_name
        FROM products
        LEFT JOIN users ON products.created_by = users.id
        WHERE 1 = 1
    `;

        const params = [];

        if (!isAdmin) {
            sql += ` AND products.created_by = ?`;
            params.push(req.session.userId);
        }

        if (q) {
            sql += `
            AND (
                products.title LIKE ?
                OR products.description LIKE ?
                OR products.keywords LIKE ?
                OR COALESCE(users.nickname, users.username) LIKE ?
            )
        `;
            const likeValue = `%${q}%`;
            params.push(likeValue, likeValue, likeValue, likeValue);
        }

        if (status === 'active') {
            sql += ` AND products.is_active = 1`;
        } else if (status === 'inactive') {
            sql += ` AND products.is_active = 0`;
        }

        if (priceType === 'free') {
            sql += ` AND products.is_free = 1`;
        } else if (priceType === 'paid') {
            sql += ` AND products.is_free = 0`;
        }

        sql += ` ORDER BY products.id DESC`;

        db.query(sql, params, (err, results) => {
            if (err) {
                console.error('판매자 상품 목록 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '상품 목록을 불러오지 못했습니다.'
                });
            }

            return res.json({
                success: true,
                products: results
            });
        });
    });

    // 상품 삭제 API
    router.delete('/api/seller/products/:id', requireSellerOrAdminApi, (req, res) => {
        const productId = req.params.id;
        const isAdmin = req.session.role === 'admin';

        const productSql = `
            SELECT *
            FROM products
            WHERE id = ?
            LIMIT 1
        `;

        db.query(productSql, [productId], (productErr, productResults) => {
            if (productErr) {
                console.error('삭제 대상 상품 조회 오류:', productErr);
                return res.status(500).json({
                    success: false,
                    message: '상품 정보를 확인하지 못했습니다.'
                });
            }

            if (productResults.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '상품을 찾을 수 없습니다.'
                });
            }

            const product = productResults[0];

            if (!isAdmin && Number(product.created_by) !== Number(req.session.userId)) {
                return res.status(403).json({
                    success: false,
                    message: '본인이 등록한 상품만 삭제할 수 있습니다.'
                });
            }

            const orderCheckSql = `
                SELECT COUNT(*) AS count
                FROM order_items
                WHERE product_id = ?
            `;

            db.query(orderCheckSql, [productId], (orderErr, orderResults) => {
                if (orderErr) {
                    console.error('주문 연결 여부 확인 오류:', orderErr);
                    return res.status(500).json({
                        success: false,
                        message: '삭제 가능 여부를 확인하지 못했습니다.'
                    });
                }

                const linkedOrderCount = Number(orderResults[0]?.count || 0);

                if (linkedOrderCount > 0) {
                    return res.status(400).json({
                        success: false,
                        message: '이미 주문된 상품은 삭제할 수 없습니다.'
                    });
                }

                const deleteSql = `
                    DELETE FROM products
                    WHERE id = ?
                `;

                db.query(deleteSql, [productId], (deleteErr) => {
                    if (deleteErr) {
                        console.error('상품 삭제 오류:', deleteErr);
                        return res.status(500).json({
                            success: false,
                            message: '상품 삭제에 실패했습니다.'
                        });
                    }

                    return res.json({
                        success: true,
                        message: '상품이 삭제되었습니다.'
                    });
                });
            });
        });
    });

    // 상품 수정
    router.get('/seller-products/edit/:id', requireSellerOrAdmin, (req, res) => {
        res.render('seller-product-edit');
    });

    router.get('/api/seller/products/:id', requireSellerOrAdminApi, (req, res) => {
        const productId = req.params.id;
        const isAdmin = req.session.role === 'admin';

        const sql = `
        SELECT
            products.*,
            COALESCE(users.nickname, users.username) AS uploader_name
        FROM products
        LEFT JOIN users ON products.created_by = users.id
        WHERE products.id = ?
        LIMIT 1
    `;

        db.query(sql, [productId], (err, results) => {
            if (err) {
                console.error('판매자 상품 단건 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '상품 정보를 불러오지 못했습니다.'
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '상품을 찾을 수 없습니다.'
                });
            }

            const product = results[0];

            if (!isAdmin && Number(product.created_by) !== Number(req.session.userId)) {
                return res.status(403).json({
                    success: false,
                    message: '본인이 등록한 상품만 수정할 수 있습니다.'
                });
            }

            return res.json({
                success: true,
                product
            });
        });
    });

    // 상품 수정 저장
    router.patch(
        '/api/seller/products/:id',
        requireSellerOrAdminApi,
        upload.fields([
            { name: 'thumbnail', maxCount: 1 },
            { name: 'productFile', maxCount: 1 }
        ]),
        (req, res) => {
            const productId = req.params.id;
            const isAdmin = req.session.role === 'admin';

            const title = req.body.title?.trim();
            const price = req.body.price;
            const salePrice = req.body.salePrice;
            const isFree = req.body.isFree === '1' ? 1 : 0;
            const description = req.body.description?.trim();
            const keywords = req.body.keywords?.trim();

            const newThumbnail = req.files?.thumbnail?.[0];
            const newProductFile = req.files?.productFile?.[0];

            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: '상품명을 입력해주세요.'
                });
            }

            if (!description) {
                return res.status(400).json({
                    success: false,
                    message: '상품 설명을 입력해주세요.'
                });
            }

            if (!isFree && (!price || Number(price) < 0)) {
                return res.status(400).json({
                    success: false,
                    message: '올바른 판매가를 입력해주세요.'
                });
            }

            const productSql = `
            SELECT *
            FROM products
            WHERE id = ?
            LIMIT 1
        `;

            db.query(productSql, [productId], (productErr, productResults) => {
                if (productErr) {
                    console.error('수정 대상 상품 조회 오류:', productErr);
                    return res.status(500).json({
                        success: false,
                        message: '상품 정보를 확인하지 못했습니다.'
                    });
                }

                if (productResults.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: '상품을 찾을 수 없습니다.'
                    });
                }

                const product = productResults[0];

                if (!isAdmin && Number(product.created_by) !== Number(req.session.userId)) {
                    return res.status(403).json({
                        success: false,
                        message: '본인이 등록한 상품만 수정할 수 있습니다.'
                    });
                }

                const cleanedKeywords = (keywords || '')
                    .split(',')
                    .map(v => v.trim())
                    .filter(Boolean)
                    .join(',');

                const nextThumbnailPath = newThumbnail
                    ? `/uploads/thumbnails/${newThumbnail.filename}`
                    : product.thumbnail_path;

                const nextFileName = newProductFile
                    ? newProductFile.originalname
                    : product.file_name;

                const nextFilePath = newProductFile
                    ? `/uploads/products/${newProductFile.filename}`
                    : product.file_path;

                const updateSql = `
                UPDATE products
                SET
                    title = ?,
                    price = ?,
                    sale_price = ?,
                    is_free = ?,
                    description = ?,
                    file_name = ?,
                    file_path = ?,
                    thumbnail_path = ?,
                    keywords = ?
                WHERE id = ?
            `;

                const values = [
                    title,
                    isFree ? 0 : Number(price),
                    isFree ? 0 : (salePrice ? Number(salePrice) : null),
                    isFree,
                    description,
                    nextFileName,
                    nextFilePath,
                    nextThumbnailPath,
                    cleanedKeywords,
                    productId
                ];

                db.query(updateSql, values, (updateErr) => {
                    if (updateErr) {
                        console.error('상품 수정 오류:', updateErr);
                        return res.status(500).json({
                            success: false,
                            message: '상품 수정에 실패했습니다.'
                        });
                    }

                    return res.json({
                        success: true,
                        message: '상품이 수정되었습니다.',
                        productId: Number(productId)
                    });
                });
            });
        }
    );

    // 슈퍼관리자용 판매 상태 변경 API
    router.patch('/api/admin/products/:id/status', requireSellerOrAdminApi, (req, res) => {
        if (req.session.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '관리자만 판매 상태를 변경할 수 있습니다.'
            });
        }

        const productId = req.params.id;
        const { isActive, stopMemo } = req.body;

        if (isActive !== 0 && isActive !== 1 && isActive !== '0' && isActive !== '1') {
            return res.status(400).json({
                success: false,
                message: '올바른 판매 상태 값이 아닙니다.'
            });
        }

        const nextValue = Number(isActive);
        const nextStopMemo = nextValue === 0 ? (stopMemo || '').trim() : null;

        const sql = `
        UPDATE products
        SET
            is_active = ?,
            stop_memo = ?
        WHERE id = ?
    `;

        db.query(sql, [nextValue, nextStopMemo || null, productId], (err, result) => {
            if (err) {
                console.error('상품 판매 상태 변경 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '판매 상태 변경에 실패했습니다.'
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: '상품을 찾을 수 없습니다.'
                });
            }

            return res.json({
                success: true,
                message: nextValue === 1
                    ? '상품이 판매중으로 변경되었습니다.'
                    : '상품이 판매중지되었습니다.'
            });
        });
    });

    return router;
};