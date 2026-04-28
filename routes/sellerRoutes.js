const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { runPptAiPipeline } = require('../lib/ppt-ai-pipeline');

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

    function normalizeUploadFileName(fileName) {
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
            console.error('upload file name normalize error:', error);
        }

        return rawName;
    }

    function sanitizeRichText(html) {
        const rawHtml = String(html || '').trim();

        if (!rawHtml) {
            return '';
        }

        function sanitizeInlineStyle(styleValue, allowedProperties) {
            return String(styleValue || '')
                .split(';')
                .map((rule) => rule.trim())
                .filter(Boolean)
                .map((rule) => {
                    const separatorIndex = rule.indexOf(':');
                    if (separatorIndex === -1) {
                        return null;
                    }

                    const property = rule.slice(0, separatorIndex).trim().toLowerCase();
                    const value = rule.slice(separatorIndex + 1).trim();

                    if (!allowedProperties.includes(property)) {
                        return null;
                    }

                    if (/javascript:|expression\s*\(|url\s*\(/i.test(value)) {
                        return null;
                    }

                    return `${property}: ${value}`;
                })
                .filter(Boolean)
                .join('; ');
        }

        const protectedImgStyles = [];
        const protectedGenericStyles = [];

        const htmlWithProtectedImgStyles = rawHtml.replace(
            /<img\b([^>]*?)\sstyle=(["'])(.*?)\2([^>]*)>/gi,
            (match, before, quote, styleValue, after) => {
                const safeStyle = sanitizeInlineStyle(styleValue, [
                    'width',
                    'height',
                    'max-width',
                    'display',
                    'margin',
                    'margin-left',
                    'margin-right',
                    'float'
                ]);

                if (!safeStyle) {
                    return `<img${before}${after}>`;
                }

                const token = `__EDITOR_IMG_STYLE_${protectedImgStyles.length}__`;
                protectedImgStyles.push(safeStyle);
                return `<img${before} data-editor-safe-style="${token}"${after}>`;
            }
        );

        const htmlWithProtectedStyles = htmlWithProtectedImgStyles.replace(
            /<(?!img\b)([a-z0-9]+)\b([^>]*?)\sstyle=(["'])(.*?)\3([^>]*)>/gi,
            (match, tagName, before, quote, styleValue, after) => {
                const safeStyle = sanitizeInlineStyle(styleValue, [
                    'text-align',
                    'color',
                    'background-color',
                    'font-size',
                    'font-family',
                    'font-weight',
                    'font-style',
                    'text-decoration',
                    'padding-left',
                    'margin-left',
                    'margin-right',
                    'margin',
                    'line-height',
                    'width',
                    'height',
                    'vertical-align',
                    'border-collapse',
                    'border',
                    'border-top',
                    'border-right',
                    'border-bottom',
                    'border-left'
                ]);

                if (!safeStyle) {
                    return `<${tagName}${before}${after}>`;
                }

                const token = `__EDITOR_GENERIC_STYLE_${protectedGenericStyles.length}__`;
                protectedGenericStyles.push(safeStyle);
                return `<${tagName}${before} data-editor-safe-style="${token}"${after}>`;
            }
        );

        const sanitizedHtml = htmlWithProtectedStyles
            .replace(/<(p|div|h1|h2|h3|h4|h5|h6|blockquote|ul|ol|li)([^>]*?)style="[^"]*text-align\s*:\s*center;?[^"]*"([^>]*)>/gi, '<$1$2 class="editor-align-center"$3>')
            .replace(/<(p|div|h1|h2|h3|h4|h5|h6|blockquote|ul|ol|li)([^>]*?)style='[^']*text-align\s*:\s*center;?[^']*'([^>]*)>/gi, '<$1$2 class="editor-align-center"$3>')
            .replace(/<(p|div|h1|h2|h3|h4|h5|h6|blockquote|ul|ol|li)([^>]*?)style="[^"]*text-align\s*:\s*right;?[^"]*"([^>]*)>/gi, '<$1$2 class="editor-align-right"$3>')
            .replace(/<(p|div|h1|h2|h3|h4|h5|h6|blockquote|ul|ol|li)([^>]*?)style='[^']*text-align\s*:\s*right;?[^']*'([^>]*)>/gi, '<$1$2 class="editor-align-right"$3>')
            .replace(/<(p|div|h1|h2|h3|h4|h5|h6|blockquote|ul|ol|li)([^>]*?)style="[^"]*text-align\s*:\s*justify;?[^"]*"([^>]*)>/gi, '<$1$2 class="editor-align-justify"$3>')
            .replace(/<(p|div|h1|h2|h3|h4|h5|h6|blockquote|ul|ol|li)([^>]*?)style='[^']*text-align\s*:\s*justify;?[^']*'([^>]*)>/gi, '<$1$2 class="editor-align-justify"$3>')
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
            .replace(/<(iframe|object|embed|form|input|button|meta|link)[^>]*?>[\s\S]*?<\/\1>/gi, '')
            .replace(/<(iframe|object|embed|form|input|button|meta|link)[^>]*?\/?>/gi, '')
            .replace(/\son\w+="[^"]*"/gi, '')
            .replace(/\son\w+='[^']*'/gi, '')
            .replace(/\son\w+=([^\s>]+)/gi, '')
            .replace(/\sstyle="[^"]*"/gi, '')
            .replace(/\sstyle='[^']*'/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/data:text\/html/gi, '')
            .trim();

        return sanitizedHtml
            .replace(
                /\sdata-editor-safe-style="(__EDITOR_IMG_STYLE_(\d+)__)"/g,
                (match, token, indexText) => {
                    const styleValue = protectedImgStyles[Number(indexText)] || '';
                    return styleValue ? ` style="${styleValue}"` : '';
                }
            )
            .replace(
                /\sdata-editor-safe-style="(__EDITOR_GENERIC_STYLE_(\d+)__)"/g,
                (match, token, indexText) => {
                    const styleValue = protectedGenericStyles[Number(indexText)] || '';
                    return styleValue ? ` style="${styleValue}"` : '';
                }
            );
    }

    function toPlainText(html) {
        return String(html || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|h1|h2|h3|blockquote)>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    const thumbnailDir = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails');
    const productFileDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
    const editorImageDir = path.join(__dirname, '..', 'public', 'uploads', 'editor');
    const pptTemplateDir = path.join(__dirname, '..', 'public', 'uploads', 'ppt-templates');
    const pptPreviewDir = path.join(__dirname, '..', 'public', 'uploads', 'ppt-previews');

    if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    if (!fs.existsSync(productFileDir)) {
        fs.mkdirSync(productFileDir, { recursive: true });
    }

    if (!fs.existsSync(editorImageDir)) {
        fs.mkdirSync(editorImageDir, { recursive: true });
    }

    if (!fs.existsSync(pptTemplateDir)) {
        fs.mkdirSync(pptTemplateDir, { recursive: true });
    }

    if (!fs.existsSync(pptPreviewDir)) {
        fs.mkdirSync(pptPreviewDir, { recursive: true });
    }

    function ensureProductFilesJsonColumn() {
        const checkSql = `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'products'
              AND COLUMN_NAME = 'product_files_json'
            LIMIT 1
        `;

        db.query(checkSql, (checkErr, checkResults) => {
            if (checkErr) {
                console.error('product_files_json column check error:', checkErr);
                return;
            }

            if (checkResults.length > 0) {
                return;
            }

            db.query(
                `ALTER TABLE products ADD COLUMN product_files_json LONGTEXT NULL AFTER file_path`,
                (alterErr) => {
                    if (alterErr) {
                        console.error('product_files_json column add error:', alterErr);
                    }
                }
            );
        });
    }

    ensureProductFilesJsonColumn();

    function ensureProductAiColumns() {
        const columns = [
            {
                name: 'thumbnail_gallery_json',
                sql: `ALTER TABLE products ADD COLUMN thumbnail_gallery_json LONGTEXT NULL AFTER thumbnail_path`
            },
            {
                name: 'ai_slide_analysis_json',
                sql: `ALTER TABLE products ADD COLUMN ai_slide_analysis_json LONGTEXT NULL AFTER thumbnail_gallery_json`
            },
            {
                name: 'ai_summary_text',
                sql: `ALTER TABLE products ADD COLUMN ai_summary_text LONGTEXT NULL AFTER ai_slide_analysis_json`
            },
            {
                name: 'use_place',
                sql: `ALTER TABLE products ADD COLUMN use_place VARCHAR(120) NULL AFTER ai_summary_text`
            },
            {
                name: 'use_purpose',
                sql: `ALTER TABLE products ADD COLUMN use_purpose VARCHAR(120) NULL AFTER use_place`
            }
        ];

        columns.forEach((column) => {
            db.query(
                `
                    SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'products'
                      AND COLUMN_NAME = ?
                    LIMIT 1
                `,
                [column.name],
                (checkErr, checkResults) => {
                    if (checkErr) {
                        console.error(`${column.name} column check error:`, checkErr);
                        return;
                    }

                    if (checkResults.length > 0) {
                        return;
                    }

                    db.query(column.sql, (alterErr) => {
                        if (alterErr) {
                            console.error(`${column.name} column add error:`, alterErr);
                        }
                    });
                }
            );
        });
    }

    ensureProductAiColumns();

    function ensureProductDescriptionMediumText() {
        db.query(
            `
                SELECT DATA_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'products'
                  AND COLUMN_NAME = 'description'
                LIMIT 1
            `,
            (checkErr, checkResults) => {
                if (checkErr) {
                    console.error('products.description column check error:', checkErr);
                    return;
                }

                const dataType = String(checkResults[0]?.DATA_TYPE || '').toLowerCase();
                if (dataType === 'mediumtext' || dataType === 'longtext') {
                    return;
                }

                db.query(
                    `ALTER TABLE products MODIFY COLUMN description MEDIUMTEXT NULL`,
                    (alterErr) => {
                        if (alterErr) {
                            console.error('products.description MEDIUMTEXT alter error:', alterErr);
                        }
                    }
                );
            }
        );
    }

    ensureProductDescriptionMediumText();

    function ensureOrderPaymentMethodColumn() {
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
                console.error('orders.payment_method column check error:', checkErr);
                return;
            }

            if (checkResults.length > 0) {
                return;
            }

            db.query(
                `ALTER TABLE orders ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'card' AFTER status`,
                (alterErr) => {
                    if (alterErr) {
                        console.error('orders.payment_method column add error:', alterErr);
                    }
                }
            );
        });
    }

    ensureOrderPaymentMethodColumn();

    function ensurePptTemplatesTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS ppt_templates (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(120) NULL,
                description TEXT NULL,
                keywords TEXT NULL,
                ppt_file_name VARCHAR(255) NOT NULL,
                ppt_file_path VARCHAR(255) NOT NULL,
                preview_image_path VARCHAR(255) NULL,
                field_schema_json LONGTEXT NULL,
                created_by INT NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ppt_templates_created_by (created_by),
                INDEX idx_ppt_templates_created_at (created_at)
            )
        `;

        db.query(sql, (err) => {
            if (err) {
                console.error('ppt_templates table ensure error:', err);
            }
        });
    }

    ensurePptTemplatesTable();

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            if (file.fieldname === 'thumbnail') {
                cb(null, thumbnailDir);
            } else if (file.fieldname === 'productFile') {
                cb(null, productFileDir);
            } else if (file.fieldname === 'editorImage') {
                cb(null, editorImageDir);
            } else {
                cb(new Error('알 수 없는 파일 필드입니다.'));
            }
        },
        filename: (req, file, cb) => {
            file.originalname = normalizeUploadFileName(file.originalname);
            const ext = path.extname(file.originalname);
            const baseName = path.basename(file.originalname, ext).replace(/[^\w가-힣.-]/g, '_');
            cb(null, `${Date.now()}_${baseName}${ext}`);
        }
    });

    const upload = multer({
        storage,
        limits: {
            fieldSize: 20 * 1024 * 1024
        }
    });

    // 상품 등록 페이지
    router.get('/seller-upload-page', requireSellerOrAdmin, (req, res) => {
        res.render('seller-upload');
    });

    router.get('/seller-upload2-page', requireSellerOrAdmin, (req, res) => {
        res.render('seller-upload2');
    });

    // 상품 관리 페이지
    router.post(
        '/api/editor/image-upload',
        requireSellerOrAdminApi,
        upload.single('editorImage'),
        (req, res) => {
            const file = req.file;

            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: '업로드할 이미지를 선택해 주세요.'
                });
            }

            if (!/^image\//i.test(file.mimetype || '')) {
                return res.status(400).json({
                    success: false,
                    message: '에디터에는 이미지 파일만 업로드할 수 있습니다.'
                });
            }

            return res.json({
                success: true,
                url: `/uploads/editor/${file.filename}`,
                name: normalizeUploadFileName(file.originalname)
            });
        }
    );

    router.get('/seller-products-page', requireSellerOrAdmin, (req, res) => {
        res.render('seller-products');
    });

    router.get('/seller-sales-page', requireSellerOrAdmin, (req, res) => {
        res.render('seller-sales');
    });

    // 상품 등록 API
    router.post(
        '/api/seller/products',
        requireSellerOrAdminApi,
        upload.fields([
            { name: 'thumbnail', maxCount: 10 },
            { name: 'productFile', maxCount: 5 }
        ]),
        (req, res) => {
            const title = req.body.title?.trim();
            const price = req.body.price;
            const salePrice = req.body.salePrice;
            const isFree = req.body.isFree === '1' ? 1 : 0;
            const description = sanitizeRichText(req.body.description);
            const keywords = req.body.keywords?.trim();

            const thumbnails = req.files?.thumbnail || [];
            const representativeThumbnailIndex = Math.max(0, Number(req.body.representativeThumbnailIndex || 0));
            const thumbnail = thumbnails[representativeThumbnailIndex] || thumbnails[0];
            const productFiles = req.files?.productFile || [];
            const productFile = productFiles[0];

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

            if (!toPlainText(description)) {
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

            if (productFiles.length > 5) {
                return res.json({
                    success: false,
                    message: '판매상품 파일은 최대 5개까지 업로드할 수 있습니다.'
                });
            }

            const cleanedKeywords = (keywords || '')
                .split(',')
                .map(v => v.trim())
                .filter(Boolean)
                .join(',');

            const fileName = normalizeUploadFileName(productFile.originalname);
            const filePath = `/uploads/products/${productFile.filename}`;
            const productFilesJson = JSON.stringify(
                productFiles.map((file) => ({
                    name: normalizeUploadFileName(file.originalname),
                    path: `/uploads/products/${file.filename}`
                }))
            );
            const thumbnailPath = `/uploads/thumbnails/${thumbnail.filename}`;
            const thumbnailGalleryJson = JSON.stringify(
                thumbnails.map((file, index) => ({
                    path: `/uploads/thumbnails/${file.filename}`,
                    name: normalizeUploadFileName(file.originalname),
                    isRepresentative: index === representativeThumbnailIndex
                }))
            );

            const sql = `
                INSERT INTO products (
                    title,
                    price,
                    sale_price,
                    is_free,
                    description,
                    file_name,
                    file_path,
                    product_files_json,
                    thumbnail_path,
                    thumbnail_gallery_json,
                    keywords,
                    created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                title,
                isFree ? 0 : Number(price),
                isFree ? 0 : (salePrice ? Number(salePrice) : null),
                isFree,
                description,
                fileName,
                filePath,
                productFilesJson,
                thumbnailPath,
                thumbnailGalleryJson,
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

    router.post(
        '/api/seller/products-ai',
        requireSellerOrAdminApi,
        upload.fields([
            { name: 'thumbnail', maxCount: 10 },
            { name: 'productFile', maxCount: 1 }
        ]),
        async (req, res) => {
            const title = req.body.title?.trim();
            const price = req.body.price;
            const salePrice = req.body.salePrice;
            const isFree = req.body.isFree === '1' ? 1 : 0;
            const usePlace = req.body.usePlace?.trim() || '';
            const usePurpose = req.body.usePurpose?.trim() || '';
            const sellerNote = sanitizeRichText(req.body.description);
            const sellerNotePlainText = toPlainText(sellerNote);
            const keywords = req.body.keywords?.trim() || '';

            const thumbnails = req.files?.thumbnail || [];
            const representativeThumbnailIndex = Math.max(0, Number(req.body.representativeThumbnailIndex || 0));
            const thumbnail = thumbnails[representativeThumbnailIndex] || thumbnails[0];
            const productFile = req.files?.productFile?.[0];

            if (!title) {
                return res.json({
                    success: false,
                    message: '상품명을 입력해 주세요.'
                });
            }

            if (!usePlace) {
                return res.json({
                    success: false,
                    message: 'PPT를 어디에 사용할지 선택해 주세요.'
                });
            }

            if (!usePurpose) {
                return res.json({
                    success: false,
                    message: 'PPT의 목적을 선택해 주세요.'
                });
            }

            if (!isFree && (!price || Number(price) < 0)) {
                return res.json({
                    success: false,
                    message: '올바른 판매가를 입력해 주세요.'
                });
            }

            if (!thumbnail) {
                return res.json({
                    success: false,
                    message: '상품 썸네일을 업로드해 주세요.'
                });
            }

            if (thumbnails.length > 10) {
                return res.json({
                    success: false,
                    message: '상품 이미지는 최대 10장까지 업로드할 수 있습니다.'
                });
            }

            if (thumbnails.length > 10) {
                return res.json({
                    success: false,
                    message: '상품 이미지는 최대 10장까지 업로드할 수 있습니다.'
                });
            }

            if (!productFile) {
                return res.json({
                    success: false,
                    message: '분석할 PPT 또는 PPTX 파일을 업로드해 주세요.'
                });
            }

            const fileExt = path.extname(productFile.originalname || '').toLowerCase();
            if (!['.ppt', '.pptx'].includes(fileExt)) {
                return res.json({
                    success: false,
                    message: '상품등록2에서는 PPT 또는 PPTX 파일만 업로드할 수 있습니다.'
                });
            }

            try {
                const cleanedKeywords = keywords
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean)
                    .join(',');

                const fileName = normalizeUploadFileName(productFile.originalname);
                const filePath = `/uploads/products/${productFile.filename}`;
                const productFilesJson = JSON.stringify([
                    {
                        name: fileName,
                        path: filePath
                    }
                ]);
                const thumbnailPath = `/uploads/thumbnails/${thumbnail.filename}`;
                const thumbnailGalleryJson = JSON.stringify(
                    thumbnails.map((file, index) => ({
                        path: `/uploads/thumbnails/${file.filename}`,
                        name: normalizeUploadFileName(file.originalname),
                        isRepresentative: index === representativeThumbnailIndex
                    }))
                );
                const referenceImages = thumbnails.map((file, index) => ({
                    absolutePath: file.path,
                    publicPath: `/uploads/thumbnails/${file.filename}`,
                    label: index === representativeThumbnailIndex
                        ? `대표 상품 이미지 ${index + 1}`
                        : `상품 이미지 ${index + 1}`
                }));

                const analysisResult = await runPptAiPipeline({
                    sourcePptPath: productFile.path,
                    sourceFileName: fileName,
                    outputKey: path.basename(productFile.filename, path.extname(productFile.filename)),
                    publicDir: path.join(__dirname, '..', 'public'),
                    outputNamespace: 'ppt-product-analysis',
                    context: {
                        title,
                        keywords: cleanedKeywords,
                        sellerNote: sellerNotePlainText
                    },
                    referenceImages
                });

                const summaryText = analysisResult.summary?.summary?.trim() || sellerNotePlainText || `${title} PPT 템플릿입니다.`;

                const sql = `
                    INSERT INTO products (
                        title,
                        price,
                        sale_price,
                        is_free,
                        description,
                        file_name,
                        file_path,
                        product_files_json,
                        thumbnail_path,
                        thumbnail_gallery_json,
                        ai_slide_analysis_json,
                        ai_summary_text,
                        use_place,
                        use_purpose,
                        keywords,
                        created_by
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const values = [
                    title,
                    isFree ? 0 : Number(price),
                    isFree ? 0 : (salePrice ? Number(salePrice) : null),
                    isFree,
                    sellerNote,
                    fileName,
                    filePath,
                    productFilesJson,
                    thumbnailPath,
                    thumbnailGalleryJson,
                    JSON.stringify(analysisResult.slides || []),
                    summaryText,
                    usePlace,
                    usePurpose,
                    cleanedKeywords,
                    req.session.userId
                ];

                db.query(sql, values, (err, result) => {
                    if (err) {
                        console.error('AI 상품 등록 오류:', err);
                        return res.json({
                            success: false,
                            message: '상품등록2 저장에 실패했습니다.'
                        });
                    }

                    return res.json({
                        success: true,
                        message: '상품등록2와 AI 분석이 완료되었습니다.',
                        productId: result.insertId,
                        aiSummary: summaryText,
                        slideCount: analysisResult.slideCount || 0
                    });
                });
            } catch (error) {
                console.error('AI 상품 분석 오류:', error);
                return res.status(500).json({
                    success: false,
                    message: `PPT 분석 중 오류가 발생했습니다. ${error.message || ''}`.trim()
                });
            }
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

    router.get('/api/seller/sales', requireSellerOrAdminApi, (req, res) => {
        const isAdmin = req.session.role === 'admin';
        const q = (req.query.q || '').trim();

        let sql = `
            SELECT
                order_items.id AS order_item_id,
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
                    OR COALESCE(orders.payment_method, '') LIKE ?
                )
            `;
            const likeValue = `%${q}%`;
            params.push(likeValue, likeValue, likeValue, likeValue, likeValue);
        }

        sql += ` ORDER BY orders.created_at DESC, order_items.id DESC`;

        db.query(sql, params, (err, results) => {
            if (err) {
                console.error('seller sales list error:', err);
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
                        : '신용카드'
            }));

            return res.json({
                success: true,
                sales
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
            const description = sanitizeRichText(req.body.description);
            const keywords = req.body.keywords?.trim();

            const newThumbnail = req.files?.thumbnail?.[0];
            const newProductFile = req.files?.productFile?.[0];

            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: '상품명을 입력해주세요.'
                });
            }

            if (!toPlainText(description)) {
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

    router.patch('/api/admin/products/:id/featured', requireSellerOrAdminApi, (req, res) => {
        if (req.session.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '관리자만 추천 상품을 설정할 수 있습니다.'
            });
        }

        const productId = req.params.id;
        const { isFeatured } = req.body;

        if (isFeatured !== 0 && isFeatured !== 1 && isFeatured !== '0' && isFeatured !== '1') {
            return res.status(400).json({
                success: false,
                message: '올바른 추천 상태 값이 아닙니다.'
            });
        }

        const sql = `
        UPDATE products
        SET is_featured = ?
        WHERE id = ?
    `;

        db.query(sql, [Number(isFeatured), productId], (err, result) => {
            if (err) {
                console.error('추천 상품 상태 변경 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '추천 상품 설정에 실패했습니다.'
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
                message: Number(isFeatured) === 1
                    ? '추천 상품으로 설정되었습니다.'
                    : '추천 상품에서 해제되었습니다.'
            });
        });
    });

    return router;
};
