const express = require('express');

module.exports = (db) => {
    const router = express.Router();
    const MIN_SETTLEMENT_AMOUNT = 25000;

    function requireSellerOrAdminPage(req, res, next) {
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

    function requireAdminPage(req, res, next) {
        if (!req.session.userId) {
            return res.redirect('/login-page');
        }

        if (req.session.role !== 'admin') {
            return res.redirect('/');
        }

        next();
    }

    function requireAdminApi(req, res, next) {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        if (req.session.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '관리자만 접근할 수 있습니다.'
            });
        }

        next();
    }

    function ensureSettlementSchema() {
        const createRequestTableSql = `
            CREATE TABLE IF NOT EXISTS seller_settlement_requests (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                seller_id INT NOT NULL,
                sales_count INT NOT NULL DEFAULT 0,
                total_sales_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
                fee_rate DECIMAL(5, 2) NOT NULL DEFAULT 8.00,
                fee_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
                settlement_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
                status VARCHAR(30) NOT NULL DEFAULT 'requested',
                requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `;

        db.query(createRequestTableSql, (tableErr) => {
            if (tableErr) {
                console.error('seller_settlement_requests table create error:', tableErr);
            }
        });

        const checkColumnSql = `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'order_items'
              AND COLUMN_NAME = 'settlement_request_id'
            LIMIT 1
        `;

        db.query(checkColumnSql, (checkErr, checkResults) => {
            if (checkErr) {
                console.error('order_items settlement_request_id column check error:', checkErr);
                return;
            }

            if (checkResults.length > 0) {
                return;
            }

            db.query(
                `ALTER TABLE order_items ADD COLUMN settlement_request_id INT NULL AFTER price`,
                (alterErr) => {
                    if (alterErr) {
                        console.error('order_items settlement_request_id column add error:', alterErr);
                    }
                }
            );
        });
    }

    ensureSettlementSchema();

    router.get('/seller-sales-page', requireSellerOrAdminPage, (req, res) => {
        res.render('seller-sales');
    });

    router.get('/admin-settlements-page', requireAdminPage, (req, res) => {
        res.render('admin-settlements');
    });

    router.get('/api/seller/sales-dashboard', requireSellerOrAdminApi, (req, res) => {
        const isAdmin = req.session.role === 'admin';
        const q = (req.query.q || '').trim();

        let sql = `
            SELECT
                order_items.id AS order_item_id,
                order_items.settlement_request_id,
                orders.order_number,
                orders.created_at,
                orders.payment_method,
                order_items.price,
                products.id AS product_id,
                products.title AS product_title,
                products.created_by AS seller_id,
                COALESCE(seller.nickname, seller.username) AS seller_name,
                CASE
                    WHEN orders.user_id IS NULL THEN COALESCE(orders.guest_name, orders.guest_email, '비회원')
                    ELSE COALESCE(buyer.nickname, buyer.username, buyer.email, CONCAT('회원 #', orders.user_id))
                END AS buyer_name
            FROM order_items
            JOIN orders ON order_items.order_id = orders.id
            JOIN products ON order_items.product_id = products.id
            LEFT JOIN users AS seller ON products.created_by = seller.id
            LEFT JOIN users AS buyer ON orders.user_id = buyer.id
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
                    OR orders.order_number LIKE ?
                    OR COALESCE(seller.nickname, seller.username) LIKE ?
                    OR CASE
                        WHEN orders.user_id IS NULL THEN COALESCE(orders.guest_name, orders.guest_email, '비회원')
                        ELSE COALESCE(buyer.nickname, buyer.username, buyer.email, CONCAT('회원 #', orders.user_id))
                    END LIKE ?
                )
            `;
            const likeValue = `%${q}%`;
            params.push(likeValue, likeValue, likeValue, likeValue);
        }

        sql += ` ORDER BY orders.created_at DESC, order_items.id DESC`;

        db.query(sql, params, (err, results) => {
            if (err) {
                console.error('seller sales dashboard query error:', err);
                return res.status(500).json({
                    success: false,
                    message: '판매 내역을 불러오지 못했습니다.'
                });
            }

            const sales = results.map((sale) => ({
                ...sale,
                payment_method_label: sale.payment_method === 'bank'
                    ? '계좌이체'
                    : sale.payment_method === 'simple'
                        ? '간편결제'
                        : '신용카드',
                settlement_status: sale.settlement_request_id ? 'requested' : 'pending',
                settlement_status_label: sale.settlement_request_id ? '정산신청완료' : '정산신청 미완료'
            }));

            const pendingSales = sales.filter((sale) => !sale.settlement_request_id && (!isAdmin || Number(sale.seller_id) === Number(req.session.userId)));
            const totalSalesAmount = pendingSales.reduce((sum, sale) => sum + Number(sale.price || 0), 0);
            const feeAmount = Math.round(totalSalesAmount * 0.08);
            const settlementAmount = totalSalesAmount - feeAmount;

            return res.json({
                success: true,
                sales,
                summary: {
                    totalSalesAmount,
                    feeAmount,
                    settlementAmount,
                    pendingCount: pendingSales.length
                }
            });
        });
    });

    router.post('/api/seller/settlement-requests', requireSellerOrAdminApi, (req, res) => {
        if (req.session.role !== 'seller') {
            return res.status(403).json({
                success: false,
                message: '셀러 회원만 정산신청을 할 수 있습니다.'
            });
        }

        const sellerId = req.session.userId;
        const pendingSalesSql = `
            SELECT
                order_items.id AS order_item_id,
                order_items.price
            FROM order_items
            JOIN orders ON order_items.order_id = orders.id
            JOIN products ON order_items.product_id = products.id
            WHERE products.created_by = ?
              AND order_items.settlement_request_id IS NULL
              AND orders.created_at <= NOW()
        `;

        db.query(pendingSalesSql, [sellerId], (pendingErr, pendingResults) => {
            if (pendingErr) {
                console.error('pending seller sales query error:', pendingErr);
                return res.status(500).json({
                    success: false,
                    message: '정산신청 대상을 불러오지 못했습니다.'
                });
            }

            if (!pendingResults.length) {
                return res.json({
                    success: false,
                    message: '정산신청 가능한 판매 내역이 없습니다.'
                });
            }

            const salesCount = pendingResults.length;
            const totalSalesAmount = pendingResults.reduce((sum, sale) => sum + Number(sale.price || 0), 0);
            const feeAmount = Math.round(totalSalesAmount * 0.08);
            const settlementAmount = totalSalesAmount - feeAmount;

            if (settlementAmount < MIN_SETTLEMENT_AMOUNT) {
                return res.json({
                    success: false,
                    message: `정산금액이 ${MIN_SETTLEMENT_AMOUNT.toLocaleString()}원 이상일 때만 정산신청할 수 있습니다.`
                });
            }

            const insertSql = `
                INSERT INTO seller_settlement_requests (
                    seller_id,
                    sales_count,
                    total_sales_amount,
                    fee_rate,
                    fee_amount,
                    settlement_amount,
                    status
                )
                VALUES (?, ?, ?, 8.00, ?, ?, 'requested')
            `;

            db.query(insertSql, [sellerId, salesCount, totalSalesAmount, feeAmount, settlementAmount], (insertErr, insertResult) => {
                if (insertErr) {
                    console.error('seller settlement request insert error:', insertErr);
                    return res.status(500).json({
                        success: false,
                        message: '정산신청 저장에 실패했습니다.'
                    });
                }

                const requestId = insertResult.insertId;
                const orderItemIds = pendingResults.map((sale) => Number(sale.order_item_id)).filter(Boolean);

                db.query(
                    `UPDATE order_items SET settlement_request_id = ? WHERE id IN (?)`,
                    [requestId, orderItemIds],
                    (updateErr) => {
                        if (updateErr) {
                            console.error('seller settlement request item update error:', updateErr);
                            return res.status(500).json({
                                success: false,
                                message: '정산신청 상태 반영에 실패했습니다.'
                            });
                        }

                        return res.json({
                            success: true,
                            message: '정산신청이 완료되었습니다.'
                        });
                    }
                );
            });
        });
    });

    router.get('/api/admin/settlement-requests', requireAdminApi, (req, res) => {
        const q = (req.query.q || '').trim();

        let sql = `
            SELECT
                seller_settlement_requests.*,
                COALESCE(users.nickname, users.username) AS seller_name
            FROM seller_settlement_requests
            LEFT JOIN users ON seller_settlement_requests.seller_id = users.id
            WHERE 1 = 1
        `;

        const params = [];

        if (q) {
            sql += `
                AND (
                    COALESCE(users.nickname, users.username) LIKE ?
                    OR CAST(seller_settlement_requests.id AS CHAR) LIKE ?
                )
            `;
            const likeValue = `%${q}%`;
            params.push(likeValue, likeValue);
        }

        sql += ` ORDER BY seller_settlement_requests.requested_at DESC, seller_settlement_requests.id DESC`;

        db.query(sql, params, (err, results) => {
            if (err) {
                console.error('admin settlement requests query error:', err);
                return res.status(500).json({
                    success: false,
                    message: '정산신청 내역을 불러오지 못했습니다.'
                });
            }

            return res.json({
                success: true,
                requests: results.map((item) => ({
                    ...item,
                    status_label: item.status === 'requested' ? '정산신청완료' : item.status
                }))
            });
        });
    });

    router.get('/api/admin/settlement-requests/:id/items', requireAdminApi, (req, res) => {
        const requestId = Number(req.params.id || 0);

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: '정산신청 번호가 올바르지 않습니다.'
            });
        }

        const sql = `
            SELECT
                seller_settlement_requests.id AS request_id,
                seller_settlement_requests.requested_at,
                order_items.price,
                orders.order_number,
                orders.created_at,
                orders.payment_method,
                products.title AS product_title,
                COALESCE(seller.nickname, seller.username) AS seller_name,
                CASE
                    WHEN orders.user_id IS NULL THEN COALESCE(orders.guest_name, orders.guest_email, '비회원')
                    ELSE COALESCE(buyer.nickname, buyer.username, buyer.email, CONCAT('회원 #', orders.user_id))
                END AS buyer_name
            FROM seller_settlement_requests
            JOIN order_items ON order_items.settlement_request_id = seller_settlement_requests.id
            JOIN orders ON order_items.order_id = orders.id
            JOIN products ON order_items.product_id = products.id
            LEFT JOIN users AS seller ON seller_settlement_requests.seller_id = seller.id
            LEFT JOIN users AS buyer ON orders.user_id = buyer.id
            WHERE seller_settlement_requests.id = ?
            ORDER BY orders.created_at DESC, order_items.id DESC
        `;

        db.query(sql, [requestId], (err, results) => {
            if (err) {
                console.error('admin settlement request items query error:', err);
                return res.status(500).json({
                    success: false,
                    message: '정산내역을 불러오지 못했습니다.'
                });
            }

            return res.json({
                success: true,
                items: results.map((item) => ({
                    ...item,
                    payment_method_label: item.payment_method === 'bank'
                        ? '계좌이체'
                        : item.payment_method === 'simple'
                            ? '간편결제'
                            : '신용카드'
                }))
            });
        });
    });

    return router;
};
