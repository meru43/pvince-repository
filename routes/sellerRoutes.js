const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { runPptAiPipeline, parseExcludedPages } = require('../lib/ppt-ai-pipeline');
const { uploadFileToSupabaseStorage, isSupabaseConfigured } = require('../lib/supabase-storage');

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

    function getExistingProductFiles(product) {
        if (product?.product_files_json) {
            if (!aiSummaryTextRaw) {
                return res.json({
                    success: false,
                    message: 'AI 분석결과를 입력해 주세요.'
                });
            }

            try {
                const parsedFiles = JSON.parse(product.product_files_json);

                if (Array.isArray(parsedFiles) && parsedFiles.length > 0) {
                    return parsedFiles
                        .map((file) => ({
                            name: normalizeUploadFileName(file?.name || ''),
                            path: String(file?.path || '').trim()
                        }))
                        .filter((file) => file.name && file.path);
                }
            } catch (error) {
                console.error('existing product_files_json parse error:', error);
            }
        }

        if (product?.file_name && product?.file_path) {
            return [{
                name: normalizeUploadFileName(product.file_name),
                path: String(product.file_path).trim()
            }];
        }

        return [];
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
                name: 'ai_excluded_pages_json',
                sql: `ALTER TABLE products ADD COLUMN ai_excluded_pages_json LONGTEXT NULL AFTER ai_summary_text`
            },
            {
                name: 'use_place',
                sql: `ALTER TABLE products ADD COLUMN use_place VARCHAR(120) NULL AFTER ai_excluded_pages_json`
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
        res.render('seller-upload2', {
            pptAiAnalysisSupported: true
        });
    });

    // 상품 관리 페이지
    router.post(
        '/api/editor/image-upload',
        requireSellerOrAdminApi,
        upload.single('editorImage'),
        async (req, res) => {
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

    function buildAiReferenceImages(thumbnails, representativeThumbnailIndex) {
        return thumbnails.map((file, index) => ({
            absolutePath: file.path,
            publicPath: `/uploads/thumbnails/${file.filename}`,
            label: index === representativeThumbnailIndex
                ? `대표 상품 이미지 ${index + 1}`
                : `상품 이미지 ${index + 1}`
        }));
    }

    function resolveLocalThumbnailPath(publicPath, localPath) {
        if (localPath && String(localPath).trim() !== '') {
            return String(localPath).trim();
        }

        const normalizedPublicPath = String(publicPath || '').trim();
        if (!normalizedPublicPath.startsWith('/uploads/')) {
            return '';
        }

        return path.join(
            __dirname,
            '..',
            'public',
            normalizedPublicPath.replace(/^\/+/, '').replace(/\//g, path.sep)
        );
    }

    async function uploadThumbnailFiles(files) {
        if (!Array.isArray(files) || files.length === 0) {
            return [];
        }

        if (!isSupabaseConfigured()) {
            return files.map((file) => ({
                publicPath: `/uploads/thumbnails/${file.filename}`,
                localPath: file.path,
                name: normalizeUploadFileName(file.originalname)
            }));
        }

        const bucketName = process.env.SUPABASE_BUCKET_PRODUCT_THUMBNAILS || 'product-thumbnails';

        return Promise.all(
            files.map(async (file) => {
                const normalizedName = normalizeUploadFileName(file.originalname);
                const uploaded = await uploadFileToSupabaseStorage({
                    bucket: bucketName,
                    folder: 'products',
                    localFilePath: file.path,
                    originalName: normalizedName,
                    mimeType: file.mimetype
                });

                return {
                    publicPath: uploaded.publicUrl,
                    localPath: file.path,
                    name: normalizedName
                };
            })
        );
    }

    async function uploadProductFiles(files) {
        if (!Array.isArray(files) || files.length === 0) {
            return [];
        }

        if (!isSupabaseConfigured()) {
            return files.map((file) => ({
                publicPath: `/uploads/products/${file.filename}`,
                localPath: file.path,
                name: normalizeUploadFileName(file.originalname)
            }));
        }

        const bucketName = process.env.SUPABASE_BUCKET_PRODUCT_FILES || 'product-files';

        return Promise.all(
            files.map(async (file) => {
                const normalizedName = normalizeUploadFileName(file.originalname);
                const uploaded = await uploadFileToSupabaseStorage({
                    bucket: bucketName,
                    folder: 'products/files',
                    localFilePath: file.path,
                    originalName: normalizedName,
                    mimeType: file.mimetype
                });

                return {
                    publicPath: uploaded.publicUrl,
                    localPath: file.path,
                    name: normalizedName
                };
            })
        );
    }

    function parseAnalysisPayload(rawValue) {
        if (!rawValue) {
            return null;
        }

        const parsed = JSON.parse(rawValue);

        if (!parsed || !Array.isArray(parsed.slides) || !parsed.summary) {
            throw new Error('AI 분석 결과 형식이 올바르지 않습니다.');
        }

        return {
            slideCount: Number(parsed.slideCount || parsed.slides.length || 0),
            totalSlideCount: Number(parsed.totalSlideCount || 0),
            analyzedPages: Array.isArray(parsed.analyzedPages) ? parsed.analyzedPages : [],
            excludedPages: Array.isArray(parsed.excludedPages) ? parsed.excludedPages : [],
            slides: parsed.slides,
            summary: parsed.summary,
            pdfUrl: parsed.pdfUrl || '',
            referenceImages: Array.isArray(parsed.referenceImages) ? parsed.referenceImages : []
        };
    }

    function parseThumbnailGalleryState(rawValue) {
        if (!rawValue) {
            return [];
        }

        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) {
            throw new Error('상품 이미지 상태를 해석할 수 없습니다.');
        }

        return parsed.map((item, index) => ({
            clientId: String(item?.clientId || `thumbnail-${index + 1}`),
            source: item?.source === 'existing' ? 'existing' : 'new',
            path: String(item?.path || ''),
            localPath: String(item?.localPath || ''),
            name: String(item?.name || ''),
            isRepresentative: Boolean(item?.isRepresentative),
            order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index
        }));
    }

    router.post(
        '/api/seller/products-ai/analyze',
        requireSellerOrAdminApi,
        upload.fields([
            { name: 'thumbnail', maxCount: 10 },
            { name: 'productFile', maxCount: 10 }
        ]),
        async (req, res) => {
            const title = req.body.title?.trim();
            const usePlace = req.body.usePlace?.trim() || '';
            const usePurpose = req.body.usePurpose?.trim() || '';
            const excludedPagesRaw = req.body.excludedPages?.trim() || '';
            const sellerNote = sanitizeRichText(req.body.description);
            const sellerNotePlainText = toPlainText(sellerNote);
            const keywords = req.body.keywords?.trim() || '';

            const thumbnails = req.files?.thumbnail || [];
            const representativeThumbnailIndex = Math.max(0, Number(req.body.representativeThumbnailIndex || 0));
            const productFiles = req.files?.productFile || [];
            const productFile = productFiles.find((file) => {
                const ext = path.extname(file.originalname || '').toLowerCase();
                return ext === '.ppt' || ext === '.pptx';
            }) || productFiles[0];

            if (!title) {
                return res.json({ success: false, message: '상품명을 입력해 주세요.' });
            }

            if (!thumbnails.length) {
                return res.json({ success: false, message: '상품 이미지를 업로드해 주세요.' });
            }

            if (productFiles.length > 10) {
                return res.json({
                    success: false,
                    message: '상품 파일은 최대 10개까지 업로드할 수 있습니다.'
                });
            }

            if (!productFiles.length) {
                return res.json({ success: false, message: '분석할 PPT 또는 PPTX 파일을 업로드해 주세요.' });
            }

            let excludedPages = [];
            try {
                excludedPages = parseExcludedPages(excludedPagesRaw);
            } catch (error) {
                return res.json({ success: false, message: error.message });
            }

            if (productFiles.length > 10) {
                return res.json({
                    success: false,
                    message: 'PPT 상품 파일은 최대 10개까지 업로드할 수 있습니다.'
                });
            }

            const fileExt = path.extname(productFile.originalname || '').toLowerCase();
            if (false && !['.ppt', '.pptx'].includes(fileExt)) {
                return res.json({
                    success: false,
                    message: 'AI PPT등록에서는 PPT 또는 PPTX 파일만 업로드할 수 있습니다.'
                });
            }

            try {
                const cleanedKeywords = keywords
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean)
                    .join(',');

                const fileName = normalizeUploadFileName(productFile.originalname);
                const referenceImages = buildAiReferenceImages(thumbnails, representativeThumbnailIndex);
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
                    referenceImages,
                    excludedPages
                });

                return res.json({
                    success: true,
                    message: 'AI 분석이 완료되었습니다. 결과를 확인한 뒤 상품을 등록해 주세요.',
                    analysisResult
                });
            } catch (error) {
                console.error('AI 상품 사전 분석 오류:', error);
                return res.status(500).json({
                    success: false,
                    message: `PPT 분석 중 오류가 발생했습니다. ${error.message || ''}`.trim()
                });
            }
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
        async (req, res) => {
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

            let uploadedThumbnails = [];

            try {
                uploadedThumbnails = await uploadThumbnailFiles(thumbnails);
            } catch (error) {
                console.error('thumbnail storage upload error:', error);
                return res.status(500).json({
                    success: false,
                    message: '?곹뭹 ?몃꽕?쇱쓣 ?ㅼ옣?섎뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'
                });
            }

            let uploadedProductFiles = [];

            try {
                uploadedProductFiles = await uploadProductFiles(productFiles);
            } catch (error) {
                console.error('product file storage upload error:', error);
                return res.status(500).json({
                    success: false,
                    message: '상품 파일 업로드에 실패했습니다.'
                });
            }

            const fileName = uploadedProductFiles[0]?.name || normalizeUploadFileName(productFile.originalname);
            const filePath = uploadedProductFiles[0]?.publicPath || `/uploads/products/${productFile.filename}`;
            const productFilesJson = JSON.stringify(
                uploadedProductFiles.map((file) => ({
                    name: file.name,
                    path: file.publicPath
                }))
            );
            const thumbnailPath = uploadedThumbnails[representativeThumbnailIndex]?.publicPath
                || uploadedThumbnails[0]?.publicPath
                || '';
            const thumbnailGalleryJson = JSON.stringify(
                uploadedThumbnails.map((file, index) => ({
                    path: file.publicPath,
                    localPath: file.localPath,
                    name: file.name,
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
            { name: 'productFile', maxCount: 10 }
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
            const aiSummaryTextRaw = String(req.body.aiSummaryText || '').trim();
            const keywords = req.body.keywords?.trim() || '';

            const thumbnails = req.files?.thumbnail || [];
            const representativeThumbnailIndex = Math.max(0, Number(req.body.representativeThumbnailIndex || 0));
            const thumbnail = thumbnails[representativeThumbnailIndex] || thumbnails[0];
            const productFiles = req.files?.productFile || [];
            const productFile = productFiles[0];

            if (!title) {
                return res.json({
                    success: false,
                    message: '상품명을 입력해 주세요.'
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

            if (!productFiles.length) {
                return res.json({
                    success: false,
                    message: '분석할 PPT 또는 PPTX 파일을 업로드해 주세요.'
                });
            }

            const fileExt = path.extname(productFile.originalname || '').toLowerCase();
            if (!['.ppt', '.pptx'].includes(fileExt)) {
                return res.json({
                    success: false,
                    message: 'AI PPT등록에서는 PPT 또는 PPTX 파일만 업로드할 수 있습니다.'
                });
            }

            try {
                const cleanedKeywords = keywords
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean)
                    .join(',');

                const uploadedThumbnails = await uploadThumbnailFiles(thumbnails);
                const uploadedProductFiles = await uploadProductFiles(productFiles);
                const mainProductFileIndex = Math.max(0, productFiles.indexOf(productFile));
                const uploadedProductFile = uploadedProductFiles[mainProductFileIndex];
                const fileName = uploadedProductFile?.name || normalizeUploadFileName(productFile.originalname);
                const filePath = uploadedProductFile?.publicPath || `/uploads/products/${productFile.filename}`;
                const productFilesJson = JSON.stringify(
                    uploadedProductFiles.map((file, index) => ({
                        name: file?.name || normalizeUploadFileName(productFiles[index]?.originalname || ''),
                        path: file?.publicPath || `/uploads/products/${productFiles[index]?.filename || ''}`
                    }))
                );
                const thumbnailPath = uploadedThumbnails[representativeThumbnailIndex]?.publicPath
                    || uploadedThumbnails[0]?.publicPath
                    || '';
                const thumbnailGalleryJson = JSON.stringify(
                    uploadedThumbnails.map((file, index) => ({
                        path: file.publicPath,
                        localPath: file.localPath,
                        name: file.name,
                        isRepresentative: index === representativeThumbnailIndex
                    }))
                );
                const analysisResult = {
                    summary: {
                        summary: aiSummaryTextRaw
                    },
                    slides: [],
                    excludedPages: [],
                    slideCount: 0,
                    totalSlideCount: 0,
                    analyzedPages: []
                };

                if (false) {
                    return res.json({
                        success: false,
                        message: '먼저 AI 분석을 완료해 주세요.'
                    });
                }

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
                        ai_excluded_pages_json,
                        use_place,
                        use_purpose,
                        keywords,
                        created_by
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    JSON.stringify(analysisResult.excludedPages || []),
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
                            message: 'AI PPT등록 저장에 실패했습니다.'
                        });
                    }

                    return res.json({
                        success: true,
                        message: 'AI PPT등록이 완료되었습니다.',
                        productId: result.insertId,
                        aiSummary: summaryText,
                        slideCount: analysisResult.slideCount || 0,
                        totalSlideCount: analysisResult.totalSlideCount || 0,
                        analyzedPages: analysisResult.analyzedPages || [],
                        excludedPages: analysisResult.excludedPages || []
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
            { name: 'thumbnail', maxCount: 10 },
            { name: 'productFile', maxCount: 1 }
        ]),
        async (req, res) => {
            const productId = req.params.id;
            const isAdmin = req.session.role === 'admin';

            const title = req.body.title?.trim();
            const price = req.body.price;
            const salePrice = req.body.salePrice;
            const isFree = req.body.isFree === '1' ? 1 : 0;
            const description = sanitizeRichText(req.body.description);
            const keywords = req.body.keywords?.trim();
            const aiReanalyze = req.body.aiReanalyze === '1';
            const excludedPagesRaw = req.body.excludedPages?.trim() || '';
            const thumbnailGalleryStateRaw = req.body.thumbnailGalleryState || '[]';

            const newThumbnails = req.files?.thumbnail || [];
            const newProductFile = req.files?.productFile?.[0];
            const thumbnailClientIdsRaw = req.body.thumbnailClientId;
            const thumbnailClientIds = Array.isArray(thumbnailClientIdsRaw)
                ? thumbnailClientIdsRaw
                : (thumbnailClientIdsRaw ? [thumbnailClientIdsRaw] : []);

            console.log('[THUMBNAIL UPDATE CHECK]', {
                productId: Number(productId),
                newThumbnailCount: newThumbnails.length,
                thumbnailClientIdCount: thumbnailClientIds.length,
                supabaseConfigured: isSupabaseConfigured()
            });

            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: '상품명을 입력해주세요.'
                });
            }

            if (!isFree && (!price || Number(price) < 0)) {
                return res.status(400).json({
                    success: false,
                    message: '올바른 판매가를 입력해주세요.'
                });
            }

            let excludedPages = [];

            const productSql = `
            SELECT *
            FROM products
            WHERE id = ?
            LIMIT 1
        `;

            db.query(productSql, [productId], async (productErr, productResults) => {
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

                let uploadedReplacementProductFiles = [];

                if (newProductFile) {
                    try {
                        uploadedReplacementProductFiles = await uploadProductFiles([newProductFile]);
                    } catch (error) {
                        console.error('product file storage upload error:', error);
                        return res.status(500).json({
                            success: false,
                            message: '상품 파일 업로드에 실패했습니다.'
                        });
                    }
                }

                const uploadedReplacementProductFile = uploadedReplacementProductFiles[0];
                const nextFileName = uploadedReplacementProductFile?.name
                    || (newProductFile ? normalizeUploadFileName(newProductFile.originalname) : product.file_name);

                const nextFilePath = uploadedReplacementProductFile?.publicPath
                    || (newProductFile ? `/uploads/products/${newProductFile.filename}` : product.file_path);

                const nextProductFiles = newProductFile
                    ? [{
                        name: nextFileName,
                        path: nextFilePath
                    }]
                    : getExistingProductFiles(product);
                const nextProductFilesJson = JSON.stringify(nextProductFiles);

                const normalizedNextFileName = normalizeUploadFileName(nextFileName);
                const isAiPptProduct = String(normalizedNextFileName || '').toLowerCase().endsWith('.ppt')
                    || String(normalizedNextFileName || '').toLowerCase().endsWith('.pptx')
                    || !!product.ai_summary_text
                    || !!product.ai_slide_analysis_json;

                let thumbnailGalleryState = [];
                try {
                    thumbnailGalleryState = parseThumbnailGalleryState(thumbnailGalleryStateRaw)
                        .sort((a, b) => a.order - b.order);
                } catch (error) {
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }

                let uploadedNewThumbnailMap = new Map();
                if (newThumbnails.length) {
                    try {
                        const uploadedNewThumbnails = await uploadThumbnailFiles(newThumbnails);
                        console.log('[THUMBNAIL UPLOAD RESULT]', uploadedNewThumbnails.map((file) => file.publicPath));
                        uploadedNewThumbnailMap = new Map(
                            uploadedNewThumbnails.map((file, index) => ([
                                String(thumbnailClientIds[index] || `new-${index + 1}`),
                                file
                            ]))
                        );
                    } catch (error) {
                        console.error('thumbnail storage upload error:', error);
                        return res.status(500).json({
                            success: false,
                            message: '?곹뭹 ?몃꽕?쇱쓣 ?ㅼ옣?섎뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'
                        });
                    }
                }

                let nextThumbnailGallery = [];

                if (thumbnailGalleryState.length) {
                    nextThumbnailGallery = thumbnailGalleryState
                        .map((item) => {
                            if (item.source === 'existing') {
                                return {
                                    path: item.path,
                                    localPath: item.localPath || resolveLocalThumbnailPath(item.path, item.localPath),
                                    name: item.name || path.basename(item.path || ''),
                                    isRepresentative: item.isRepresentative
                                };
                            }

                            const matchedFile = uploadedNewThumbnailMap.get(item.clientId);
                            if (!matchedFile) {
                                return null;
                            }

                            return {
                                path: matchedFile.publicPath,
                                localPath: matchedFile.localPath,
                                name: matchedFile.name,
                                isRepresentative: item.isRepresentative
                            };
                        })
                        .filter(Boolean);
                } else {
                    try {
                        nextThumbnailGallery = JSON.parse(product.thumbnail_gallery_json || '[]');
                    } catch (error) {
                        nextThumbnailGallery = [];
                    }

                    if (!nextThumbnailGallery.length && product.thumbnail_path) {
                        nextThumbnailGallery = [{
                            path: product.thumbnail_path,
                            localPath: resolveLocalThumbnailPath(product.thumbnail_path, ''),
                            name: product.title || '대표 이미지',
                            isRepresentative: true
                        }];
                    }
                }

                if (!nextThumbnailGallery.length) {
                    return res.status(400).json({
                        success: false,
                        message: '상품 이미지를 최소 1장 유지해 주세요.'
                    });
                }

                if (nextThumbnailGallery.length > 10) {
                    return res.status(400).json({
                        success: false,
                        message: '?곹뭹 ?대?吏??理쒕? 10?κ퉴吏 ?좎??????덉뒿?덈떎.'
                    });
                }

                if (!nextThumbnailGallery.some((item) => item.isRepresentative)) {
                    nextThumbnailGallery[0].isRepresentative = true;
                }

                const representativeThumbnail = nextThumbnailGallery.find((item) => item.isRepresentative) || nextThumbnailGallery[0];
                const nextThumbnailPath = representativeThumbnail?.path || product.thumbnail_path;
                const nextThumbnailGalleryJson = JSON.stringify(nextThumbnailGallery);

                let nextAiSlideAnalysisJson = product.ai_slide_analysis_json;
                let nextAiSummaryText = product.ai_summary_text;
                let nextAiExcludedPagesJson = product.ai_excluded_pages_json || JSON.stringify([]);
                let updateMessage = '상품이 수정되었습니다.';

                if (isAiPptProduct && aiReanalyze) {
                    if (process.platform !== 'win32') {
                        updateMessage = newProductFile
                            ? 'PPT 파일과 상품 정보를 수정했습니다. 현재 배포 환경에서는 AI 재분석을 할 수 없어 기존 분석 결과를 유지했습니다.'
                            : '상품 정보를 수정했습니다. 현재 배포 환경에서는 AI 재분석을 할 수 없어 기존 분석 결과를 유지했습니다.';
                    } else {
                    try {
                        excludedPages = parseExcludedPages(excludedPagesRaw);
                    } catch (error) {
                        return res.status(400).json({
                            success: false,
                            message: error.message
                        });
                    }

                    try {
                        const publicDir = path.join(__dirname, '..', 'public');
                        const currentProductFilePath = String(nextFilePath || '').replace(/^\/+/, '').replace(/\//g, path.sep);
                        const pptAbsolutePath = newProductFile
                            ? newProductFile.path
                            : path.join(publicDir, currentProductFilePath);

                        const referenceImages = nextThumbnailGallery
                            .map((item, index) => {
                                const publicPath = String(item.path || '');
                                const localPath = resolveLocalThumbnailPath(publicPath, item.localPath);
                                if (!publicPath || !localPath) {
                                    return null;
                                }

                                return {
                                    absolutePath: localPath,
                                    publicPath,
                                    label: item.isRepresentative
                                        ? `대표 상품 이미지 ${index + 1}`
                                        : `상품 이미지 ${index + 1}`
                                };
                            })
                            .filter(Boolean);

                        const analysisResult = await runPptAiPipeline({
                            sourcePptPath: pptAbsolutePath,
                            sourceFileName: normalizedNextFileName,
                            outputKey: path.basename(
                                newProductFile ? newProductFile.filename : currentProductFilePath,
                                path.extname(newProductFile ? newProductFile.filename : currentProductFilePath)
                            ),
                            publicDir,
                            outputNamespace: 'ppt-product-analysis',
                            context: {
                                title,
                                keywords: cleanedKeywords,
                                sellerNote: toPlainText(description)
                            },
                            referenceImages,
                            excludedPages
                        });

                        nextAiSlideAnalysisJson = JSON.stringify(analysisResult.slides || []);
                        nextAiSummaryText = analysisResult.summary?.summary?.trim()
                            || toPlainText(description)
                            || `${title} PPT 템플릿입니다.`;
                        nextAiExcludedPagesJson = JSON.stringify(analysisResult.excludedPages || []);
                    } catch (error) {
                        console.error('AI product reanalysis error:', error);
                        return res.status(500).json({
                            success: false,
                            message: `PPT 재분석 중 오류가 발생했습니다. ${error.message || ''}`.trim()
                        });
                    }
                    }
                }

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
                    product_files_json = ?,
                    thumbnail_path = ?,
                    thumbnail_gallery_json = ?,
                    ai_slide_analysis_json = ?,
                    ai_summary_text = ?,
                    ai_excluded_pages_json = ?,
                    keywords = ?
                WHERE id = ?
            `;

                const values = [
                    title,
                    isFree ? 0 : Number(price),
                    isFree ? 0 : (salePrice ? Number(salePrice) : null),
                    isFree,
                    description,
                    normalizedNextFileName,
                    nextFilePath,
                    nextProductFilesJson,
                    nextThumbnailPath,
                    nextThumbnailGalleryJson,
                    nextAiSlideAnalysisJson,
                    nextAiSummaryText,
                    nextAiExcludedPagesJson,
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
                        message: updateMessage,
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
