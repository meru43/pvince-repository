const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = (db, path) => {
    const router = express.Router();
    const PAYMENT_METHOD_LABELS = {
        card: '신용카드',
        bank: '계좌이체',
        simple: '간편결제'
    };

    function normalizePaymentMethod(value) {
        if (!value) {
            return 'card';
        }

        const nextValue = String(value).trim();
        return PAYMENT_METHOD_LABELS[nextValue] ? nextValue : 'card';
    }

    function ensurePaymentMethodColumn() {
        const checkSql = `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'orders'
              AND COLUMN_NAME = 'payment_method'
            LIMIT 1
        `;

        db.query(checkSql, (checkErr, checkResults) => {
            if (checkErr) {
                console.error('payment_method column check error:', checkErr);
                return;
            }

            if (checkResults.length > 0) {
                return;
            }

            db.query(
                `ALTER TABLE orders ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'card' AFTER status`,
                (alterErr) => {
                    if (alterErr) {
                        console.error('payment_method column add error:', alterErr);
                    }
                }
            );
        });
    }

    ensurePaymentMethodColumn();

    function getOrderPrice(product) {
        if (Number(product.is_free) === 1) {
            return 0;
        }

        if (product.sale_price !== null && product.sale_price !== undefined) {
            return Number(product.sale_price);
        }

        return Number(product.price || 0);
    }

    function normalizeFileName(fileName) {
        if (!fileName) {
            return '';
        }

        const rawName = String(fileName);

        try {
            const decodedName = Buffer.from(rawName, 'latin1').toString('utf8');

            if (/[가-힣]/.test(decodedName) && !/[가-힣]/.test(rawName)) {
                return decodedName;
            }
        } catch (error) {
            console.error('download file name normalize error:', error);
        }

        return rawName;
    }

    function getProductFiles(product) {
        if (product?.product_files_json) {
            try {
                const parsedFiles = JSON.parse(product.product_files_json);

                if (Array.isArray(parsedFiles) && parsedFiles.length > 0) {
                    return parsedFiles
                        .map((file) => ({
                            name: normalizeFileName(file?.name || ''),
                            path: file?.path || ''
                        }))
                        .filter((file) => file.name && file.path);
                }
            } catch (error) {
                console.error('product_files_json parse error:', error);
            }
        }

        if (product?.file_name && product?.file_path) {
            return [{
                name: normalizeFileName(product.file_name),
                path: product.file_path
            }];
        }

        return [];
    }

    function setDownloadHeaders(res, fileName) {
        const normalizedName = normalizeFileName(fileName) || 'download';
        const asciiFallback = normalizedName
            .replace(/[^\x20-\x7E]/g, '_')
            .replace(/["\\]/g, '_');

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${asciiFallback || 'download'}"; filename*=UTF-8''${encodeURIComponent(normalizedName)}`
        );
    }

    function sendProductFile(res, product, fileIndex, onBeforeSend = null) {
        const files = getProductFiles(product);
        const safeIndex = Number.isInteger(fileIndex) && fileIndex >= 0 ? fileIndex : 0;
        const selectedFile = files[safeIndex] || files[0];

        if (!selectedFile) {
            return res.status(404).json({
                success: false,
                message: '다운로드할 파일을 찾을 수 없습니다.'
            });
        }

        const safeRelativePath = String(selectedFile.path || '').replace(/^\/+/, '');
        const filePath = path.join(__dirname, '..', 'public', safeRelativePath);

        if (typeof onBeforeSend === 'function') {
            onBeforeSend();
        }

        setDownloadHeaders(res, selectedFile.name);

        return res.sendFile(filePath, (downloadErr) => {
            if (downloadErr) {
                console.error('파일 다운로드 오류:', downloadErr);

                if (!res.headersSent) {
                    return res.status(500).json({
                        success: false,
                        message: '파일 다운로드 실패'
                    });
                }
            }
        });
    }

    // 회원 장바구니 주문 생성 API
    router.post('/api/orders', (req, res) => {
        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.userId;
        const orderNumber = `ORD-${Date.now()}`;
        const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);

        const cartSql = `
            SELECT
                cart_items.product_id,
                products.price,
                products.sale_price,
                products.is_free
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

            const totalPrice = cartItems.reduce((sum, item) => sum + getOrderPrice(item), 0);

            const orderSql = `
                INSERT INTO orders (user_id, order_number, total_price, status, payment_method)
                VALUES (?, ?, ?, 'paid', ?)
            `;

            db.query(orderSql, [userId, orderNumber, totalPrice, paymentMethod], (orderErr, orderResult) => {
                if (orderErr) {
                    console.error('주문 생성 오류:', orderErr);
                    return res.json({
                        success: false,
                        message: '주문 생성에 실패했습니다.'
                    });
                }

                const orderId = orderResult.insertId;
                const orderItemsValues = cartItems.map(item => [
                    orderId,
                    item.product_id,
                    getOrderPrice(item)
                ]);

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

    // 회원 단일상품 바로구매 API
    router.post('/api/orders/direct', (req, res) => {
        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.userId;
        const { productId } = req.body;
        const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);

        if (!productId) {
            return res.json({
                success: false,
                message: '상품 번호가 없습니다.'
            });
        }

        const orderNumber = `ORD-${Date.now()}`;

        const productSql = `
            SELECT
                id,
                title,
                price,
                sale_price,
                is_free
            FROM products
            WHERE id = ?
            LIMIT 1
        `;

        db.query(productSql, [productId], (productErr, productResults) => {
            if (productErr) {
                console.error('회원 단일상품 조회 오류:', productErr);
                return res.json({
                    success: false,
                    message: '상품 정보를 불러오지 못했습니다.'
                });
            }

            if (productResults.length === 0) {
                return res.json({
                    success: false,
                    message: '상품을 찾을 수 없습니다.'
                });
            }

            const product = productResults[0];
            const totalPrice = getOrderPrice(product);

            const orderSql = `
                INSERT INTO orders (user_id, order_number, total_price, status, payment_method)
                VALUES (?, ?, ?, 'paid', ?)
            `;

            db.query(orderSql, [userId, orderNumber, totalPrice, paymentMethod], (orderErr, orderResult) => {
                if (orderErr) {
                    console.error('회원 단일상품 주문 생성 오류:', orderErr);
                    return res.json({
                        success: false,
                        message: '주문 생성에 실패했습니다.'
                    });
                }

                const orderId = orderResult.insertId;

                const orderItemSql = `
                    INSERT INTO order_items (order_id, product_id, price)
                    VALUES (?, ?, ?)
                `;

                db.query(orderItemSql, [orderId, product.id, totalPrice], (itemErr) => {
                    if (itemErr) {
                        console.error('회원 단일상품 주문 상품 저장 오류:', itemErr);
                        return res.json({
                            success: false,
                            message: '주문 상품 저장에 실패했습니다.'
                        });
                    }

                    const purchaseSql = `
                        INSERT IGNORE INTO purchases (user_id, product_id)
                        VALUES (?, ?)
                    `;

                    db.query(purchaseSql, [userId, product.id], (purchaseErr) => {
                        if (purchaseErr) {
                            console.error('회원 단일상품 구매 내역 저장 오류:', purchaseErr);
                            return res.json({
                                success: false,
                                message: '구매 내역 저장에 실패했습니다.'
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

    // 비회원 주문 생성 API
    router.post('/api/guest-orders', async (req, res) => {
        const {
            productId,
            guestName,
            guestEmail,
            guestPhone,
            guestOrderPassword,
            paymentMethod: rawPaymentMethod
        } = req.body;
        const paymentMethod = normalizePaymentMethod(rawPaymentMethod);

        if (!productId) {
            return res.json({
                success: false,
                message: '상품 번호가 없습니다.'
            });
        }

        if (!guestName || !guestEmail || !guestPhone || !guestOrderPassword) {
            return res.json({
                success: false,
                message: '이름, 이메일, 연락처, 주문조회 비밀번호를 모두 입력해주세요.'
            });
        }

        const orderNumber = `GUEST-${Date.now()}`;

        const productSql = `
            SELECT id, title, price, sale_price, is_free, description, file_name
            FROM products
            WHERE id = ?
        `;

        db.query(productSql, [productId], async (productErr, productResults) => {
            if (productErr) {
                console.error('비회원 주문용 상품 조회 오류:', productErr);
                return res.json({
                    success: false,
                    message: '상품 정보를 불러오지 못했습니다.'
                });
            }

            if (productResults.length === 0) {
                return res.json({
                    success: false,
                    message: '상품을 찾을 수 없습니다.'
                });
            }

            const product = productResults[0];
            const totalPrice = getOrderPrice(product);

            try {
                const hashedGuestPassword = await bcrypt.hash(guestOrderPassword, 10);

                const orderSql = `
                    INSERT INTO orders (
                        user_id,
                        order_number,
                        total_price,
                        status,
                        payment_method,
                        guest_name,
                        guest_email,
                        guest_phone,
                        guest_order_password
                    )
                    VALUES (?, ?, ?, 'paid', ?, ?, ?, ?, ?)
                `;

                db.query(
                    orderSql,
                    [
                        null,
                        orderNumber,
                        totalPrice,
                        paymentMethod,
                        guestName,
                        guestEmail,
                        guestPhone,
                        hashedGuestPassword
                    ],
                    (orderErr, orderResult) => {
                        if (orderErr) {
                            console.error('비회원 주문 생성 오류:', orderErr);
                            return res.json({
                                success: false,
                                message: '비회원 주문 생성에 실패했습니다.'
                            });
                        }

                        const orderId = orderResult.insertId;

                        const orderItemSql = `
                            INSERT INTO order_items (order_id, product_id, price)
                            VALUES (?, ?, ?)
                        `;

                        db.query(orderItemSql, [orderId, product.id, totalPrice], (itemErr) => {
                            if (itemErr) {
                                console.error('비회원 주문 상품 저장 오류:', itemErr);
                                return res.json({
                                    success: false,
                                    message: '비회원 주문 상품 저장에 실패했습니다.'
                                });
                            }

                            return res.json({
                                success: true,
                                message: '비회원 주문이 완료되었습니다.',
                                orderNumber,
                                totalPrice
                            });
                        });
                    }
                );
            } catch (hashErr) {
                console.error('비회원 주문 비밀번호 암호화 오류:', hashErr);
                return res.json({
                    success: false,
                    message: '비밀번호 처리에 실패했습니다.'
                });
            }
        });
    });

    // 비회원 주문조회 API
    router.post('/api/guest-orders/check', (req, res) => {
        const { orderNumber, guestOrderPassword } = req.body;

        if (!orderNumber || !guestOrderPassword) {
            return res.json({
                success: false,
                message: '주문번호와 비밀번호를 모두 입력해주세요.'
            });
        }

        const sql = `
            SELECT *
            FROM orders
            WHERE order_number = ?
            LIMIT 1
        `;

        db.query(sql, [orderNumber], async (err, results) => {
            if (err) {
                console.error('비회원 주문조회 오류:', err);
                return res.json({
                    success: false,
                    message: '주문 정보를 조회하지 못했습니다.'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '일치하는 주문이 없습니다.'
                });
            }

            const order = results[0];

            try {
                const isMatch = await bcrypt.compare(
                    guestOrderPassword,
                    order.guest_order_password
                );

                if (!isMatch) {
                    return res.json({
                        success: false,
                        message: '주문조회 비밀번호가 일치하지 않습니다.'
                    });
                }

                const itemSql = `
                    SELECT
                        order_items.product_id,
                        order_items.price,
                        products.title,
                        products.description,
                        products.file_name,
                        products.thumbnail_path
                    FROM order_items
                    JOIN products ON order_items.product_id = products.id
                    WHERE order_items.order_id = ?
                `;

                db.query(itemSql, [order.id], (itemErr, itemResults) => {
                    if (itemErr) {
                        console.error('비회원 주문 상품 조회 오류:', itemErr);
                        return res.json({
                            success: false,
                            message: '주문 상품 정보를 불러오지 못했습니다.'
                        });
                    }

                    return res.json({
                        success: true,
                        order: {
                            orderNumber: order.order_number,
                            guestName: order.guest_name,
                            guestEmail: order.guest_email,
                            guestPhone: order.guest_phone,
                            totalPrice: order.total_price,
                            status: order.status,
                            createdAt: order.created_at
                        },
                        items: itemResults
                    });
                });
            } catch (compareErr) {
                console.error('비회원 주문 비밀번호 비교 오류:', compareErr);
                return res.json({
                    success: false,
                    message: '비밀번호 확인에 실패했습니다.'
                });
            }
        });
    });

    // 비회원 다운로드 API
    router.post('/api/guest-orders/download', async (req, res) => {
        const { orderNumber, guestOrderPassword, productId, fileIndex } = req.body;

        if (!orderNumber || !guestOrderPassword || !productId) {
            return res.json({
                success: false,
                message: '주문번호, 비밀번호, 상품번호가 필요합니다.'
            });
        }

        const orderSql = `
        SELECT *
        FROM orders
        WHERE order_number = ?
        LIMIT 1
    `;

        db.query(orderSql, [orderNumber], async (orderErr, orderResults) => {
            if (orderErr) {
                console.error('비회원 다운로드용 주문 조회 오류:', orderErr);
                return res.json({
                    success: false,
                    message: '주문 정보를 조회하지 못했습니다.'
                });
            }

            if (orderResults.length === 0) {
                return res.json({
                    success: false,
                    message: '일치하는 주문이 없습니다.'
                });
            }

            const order = orderResults[0];

            try {
                const isMatch = await bcrypt.compare(
                    guestOrderPassword,
                    order.guest_order_password
                );

                if (!isMatch) {
                    return res.json({
                        success: false,
                        message: '주문조회 비밀번호가 일치하지 않습니다.'
                    });
                }

                const itemSql = `
                SELECT products.*
                FROM order_items
                JOIN products ON order_items.product_id = products.id
                WHERE order_items.order_id = ? AND order_items.product_id = ?
                LIMIT 1
            `;

                db.query(itemSql, [order.id, productId], (itemErr, itemResults) => {
                    if (itemErr) {
                        console.error('비회원 다운로드용 상품 조회 오류:', itemErr);
                        return res.json({
                            success: false,
                            message: '주문 상품 정보를 불러오지 못했습니다.'
                        });
                    }

                    if (itemResults.length === 0) {
                        return res.json({
                            success: false,
                            message: '해당 주문에 포함된 상품이 아닙니다.'
                        });
                    }

                    const product = itemResults[0];
                    return sendProductFile(res, product, Number(fileIndex));

                    return res.download(filePath, product.file_name, (downloadErr) => {
                        if (downloadErr) {
                            console.error('비회원 파일 다운로드 오류:', downloadErr);

                            if (!res.headersSent) {
                                return res.status(500).json({
                                    success: false,
                                    message: '파일 다운로드 실패'
                                });
                            }
                        }
                    });
                });
            } catch (compareErr) {
                console.error('비회원 다운로드 비밀번호 비교 오류:', compareErr);
                return res.json({
                    success: false,
                    message: '비밀번호 확인에 실패했습니다.'
                });
            }
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
        const fileIndex = Number(req.query.file || 0);
        const isAdmin = req.session.role === 'admin';

        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        if (isAdmin) {
            const productSql = 'SELECT * FROM products WHERE id = ?';

            db.query(productSql, [productId], (err, productResults) => {
                if (err) {
                    console.error('?곹뭹 議고쉶 ?ㅻ쪟:', err);
                    return res.json({
                        success: false,
                        message: '?곹뭹 議고쉶 ?ㅽ뙣'
                    });
                }

                if (productResults.length === 0) {
                    return res.json({
                        success: false,
                        message: '?곹뭹??李얠쓣 ???놁뒿?덈떎.'
                    });
                }

                const product = productResults[0];
                const logSql = 'INSERT INTO download_logs (user_id, product_id) VALUES (?, ?)';

                db.query(logSql, [req.session.userId, productId], (logErr) => {
                    if (logErr) {
                        console.error('?ㅼ슫濡쒕뱶 濡쒓렇 ????ㅻ쪟:', logErr);
                    }

                    return sendProductFile(res, product, fileIndex);
                });
            });

            return;
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

                const logSql = 'INSERT INTO download_logs (user_id, product_id) VALUES (?, ?)';

                db.query(logSql, [req.session.userId, productId], (logErr) => {
                    if (logErr) {
                        console.error('다운로드 로그 저장 오류:', logErr);
                    }

                    return sendProductFile(res, product, fileIndex, () => {
                        if (logErr) {
                            console.error('?ㅼ슫濡쒕뱶 濡쒓렇 ????ㅻ쪟:', logErr);
                        }
                    });

                    return res.download(filePath, product.file_name, (downloadErr) => {
                        if (downloadErr) {
                            console.error('파일 다운로드 오류:', downloadErr);

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
                products.sale_price,
                products.is_free,
                products.description,
                products.file_name,
                products.file_path,
                products.product_files_json,
                products.thumbnail_path,
                (
                    SELECT o.order_number
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.user_id = purchases.user_id
                      AND oi.product_id = purchases.product_id
                    ORDER BY o.created_at DESC, oi.id DESC
                    LIMIT 1
                ) AS order_number,
                (
                    SELECT o.payment_method
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.user_id = purchases.user_id
                      AND oi.product_id = purchases.product_id
                    ORDER BY o.created_at DESC, oi.id DESC
                    LIMIT 1
                ) AS payment_method,
                (
                    SELECT o.created_at
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.user_id = purchases.user_id
                      AND oi.product_id = purchases.product_id
                    ORDER BY o.created_at DESC, oi.id DESC
                    LIMIT 1
                ) AS ordered_at,
                (
                    SELECT oi.price
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.user_id = purchases.user_id
                      AND oi.product_id = purchases.product_id
                    ORDER BY o.created_at DESC, oi.id DESC
                    LIMIT 1
                ) AS paid_price
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

            const normalizedProducts = results.map((product) => ({
                ...product,
                file_name: normalizeFileName(product.file_name),
                product_files_json: JSON.stringify(getProductFiles(product)),
                payment_method_label: PAYMENT_METHOD_LABELS[normalizePaymentMethod(product.payment_method)] || '신용카드'
            }));

            return res.json({
                success: true,
                products: normalizedProducts
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
                products.sale_price,
                products.is_free,
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

            const normalizedLogs = results.map((log) => ({
                ...log,
                file_name: normalizeFileName(log.file_name)
            }));

            return res.json({
                success: true,
                logs: normalizedLogs
            });
        });
    });

    return router;
};
