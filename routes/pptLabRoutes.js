const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = (db) => {
    const router = express.Router();

    const pptTemplateDir = path.join(__dirname, '..', 'public', 'uploads', 'ppt-templates');
    const pptPreviewDir = path.join(__dirname, '..', 'public', 'uploads', 'ppt-previews');

    if (!fs.existsSync(pptTemplateDir)) {
        fs.mkdirSync(pptTemplateDir, { recursive: true });
    }

    if (!fs.existsSync(pptPreviewDir)) {
        fs.mkdirSync(pptPreviewDir, { recursive: true });
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
                message: '셀러 또는 관리자만 이용할 수 있습니다.'
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
            console.error('ppt upload file name normalize error:', error);
        }

        return rawName;
    }

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
                ai_analysis_json LONGTEXT NULL,
                ai_analysis_status VARCHAR(30) NOT NULL DEFAULT 'idle',
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
            if (file.fieldname === 'pptFile') {
                cb(null, pptTemplateDir);
                return;
            }

            if (file.fieldname === 'previewImage') {
                cb(null, pptPreviewDir);
                return;
            }

            cb(new Error('지원하지 않는 파일 업로드 항목입니다.'));
        },
        filename: (req, file, cb) => {
            file.originalname = normalizeUploadFileName(file.originalname);
            const ext = path.extname(file.originalname);
            const baseName = path.basename(file.originalname, ext).replace(/[^\w가-힣-]/g, '_');
            cb(null, `${Date.now()}_${baseName}${ext}`);
        }
    });

    const upload = multer({ storage });

    function parseTemplateFields(rawText) {
        const lines = String(rawText || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        return lines.map((line, index) => {
            const [rawKey, rawLabel, rawType, rawPlaceholder] = line.split('|').map((part) => (part || '').trim());
            const safeKey = (rawKey || `field_${index + 1}`)
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');

            const type = ['text', 'textarea', 'number', 'image'].includes(rawType) ? rawType : 'text';

            return {
                key: safeKey || `field_${index + 1}`,
                label: rawLabel || rawKey || `입력항목 ${index + 1}`,
                type,
                placeholder: rawPlaceholder || ''
            };
        });
    }

    function getImageMimeType(filePath) {
        const ext = path.extname(filePath || '').toLowerCase();
        if (ext === '.png') return 'image/png';
        if (ext === '.webp') return 'image/webp';
        if (ext === '.gif') return 'image/gif';
        return 'image/jpeg';
    }

    function safeJsonParse(text, fallback = null) {
        try {
            return text ? JSON.parse(text) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    async function callOpenAiJson(prompt, previewImagePath = '') {
        const apiKey = process.env.OPENAI_API_KEY;
        const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
        }

        const content = [{ type: 'input_text', text: prompt }];

        if (previewImagePath) {
            const absolutePreviewPath = path.join(__dirname, '..', 'public', previewImagePath.replace(/^\//, ''));

            if (fs.existsSync(absolutePreviewPath)) {
                const base64Image = fs.readFileSync(absolutePreviewPath).toString('base64');
                content.push({
                    type: 'input_image',
                    image_url: `data:${getImageMimeType(absolutePreviewPath)};base64,${base64Image}`
                });
            }
        }

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                input: [
                    {
                        role: 'user',
                        content
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI analysis failed: ${errorText}`);
        }

        const data = await response.json();
        const outputText = data.output_text
            || data.output
                ?.flatMap((item) => item.content || [])
                ?.filter((item) => item.type === 'output_text' || item.type === 'text')
                ?.map((item) => item.text || item.value || '')
                ?.join('\n')
            || '';

        if (!outputText) {
            throw new Error('AI 응답 텍스트가 비어 있습니다.');
        }

        const normalizedText = outputText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        return JSON.parse(normalizedText);
    }

    async function runTemplateAnalysis(template) {
        const manualFields = safeJsonParse(template.field_schema_json, []) || [];
        const prompt = [
            '판매자가 업로드한 PPT 템플릿을 분석한다.',
            '이 템플릿이 어떤 용도인지, 어떤 사용자가 쓰기 좋은지, 어떤 입력 필드가 필요할지 JSON만 반환한다.',
            '응답 형식:',
            '{',
            '  "template_type": "...",',
            '  "summary": "...",',
            '  "recommended_for": ["...", "..."],',
            '  "slide_roles": ["...", "..."],',
            '  "suggested_fields": [',
            '    {"key": "...", "label": "...", "type": "text", "reason": "..."}',
            '  ]',
            '}',
            '',
            `템플릿 이름: ${template.title || ''}`,
            `카테고리: ${template.category || ''}`,
            `설명: ${template.description || ''}`,
            `키워드: ${template.keywords || ''}`,
            `원본 파일명: ${template.ppt_file_name || ''}`,
            `판매자가 직접 정의한 필드 힌트: ${JSON.stringify(manualFields)}`
        ].join('\n');

        return callOpenAiJson(prompt, template.preview_image_path || '');
    }

    function scoreTemplateAgainstRequest(template, request) {
        const haystack = [
            template.title,
            template.category,
            template.description,
            template.keywords,
            template.aiAnalysis?.template_type,
            template.aiAnalysis?.summary,
            ...(template.aiAnalysis?.recommended_for || [])
        ]
            .join(' ')
            .toLowerCase();

        const keywords = [
            request.useCase,
            request.audience,
            request.styleKeywords,
            request.requiredSections,
            request.brandName,
            request.productName
        ]
            .join(' ')
            .toLowerCase()
            .split(/[\s,/#]+/)
            .map((word) => word.trim())
            .filter((word) => word.length >= 2);

        return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
    }

    async function recommendTemplateWithAi(request, templates) {
        const prompt = [
            '구매 유저가 만들고 싶은 PPT 내용을 기준으로 가장 잘 맞는 템플릿을 추천한다.',
            '응답은 JSON만 반환한다.',
            '응답 형식:',
            '{',
            '  "best_template_id": 1,',
            '  "reason": "...",',
            '  "recommended_templates": [',
            '    {"id": 1, "reason": "...", "confidence": 0.92}',
            '  ],',
            '  "matched_inputs": [',
            '    {"input_label": "...", "input_value": "...", "suggested_field_label": "...", "reason": "..."}',
            '  ],',
            '  "template_use_plan": ["...", "..."]',
            '}',
            '',
            `유저 요청: ${JSON.stringify(request)}`,
            `후보 템플릿: ${JSON.stringify(templates.map((template) => ({
                id: template.id,
                title: template.title,
                category: template.category,
                description: template.description,
                keywords: template.keywords,
                aiAnalysis: template.aiAnalysis,
                fields: template.fields
            })))}`
        ].join('\n');

        return callOpenAiJson(prompt);
    }

    function buildFallbackRecommendation(request, templates) {
        const ranked = [...templates]
            .map((template) => ({
                template,
                score: scoreTemplateAgainstRequest(template, request)
            }))
            .sort((a, b) => b.score - a.score);

        const best = ranked[0]?.template || null;
        const topTemplates = ranked.slice(0, 3).map((entry) => ({
            id: entry.template.id,
            reason: entry.score > 0
                ? '요청한 키워드와 템플릿 설명/분석 내용이 일부 겹칩니다.'
                : '현재 저장된 템플릿 중 가장 기본 정보가 많은 항목입니다.',
            confidence: entry.score > 0 ? Math.min(0.55 + entry.score * 0.08, 0.88) : 0.42
        }));

        const matchedInputs = [
            { input_label: '사용 목적', input_value: request.useCase || '-', suggested_field_label: '템플릿 전체 방향', reason: 'PPT의 전체 흐름과 목적을 결정합니다.' },
            { input_label: '브랜드명', input_value: request.brandName || '-', suggested_field_label: '커버/브랜드 영역', reason: '표지 또는 소개 슬라이드에 가장 먼저 반영될 가능성이 큽니다.' },
            { input_label: '상품명', input_value: request.productName || '-', suggested_field_label: '메인 타이틀', reason: '상품 소개형 PPT에서 핵심 제목으로 들어가기 좋습니다.' },
            { input_label: '핵심 메시지', input_value: request.keyMessage || '-', suggested_field_label: '메인 카피', reason: '첫 화면 또는 강조 블록에 매칭하기 좋습니다.' }
        ];

        return {
            best_template_id: best ? best.id : null,
            reason: best
                ? 'AI 분석이 없거나 호출하지 못해, 저장된 메타데이터와 키워드 기준으로 가장 가까운 템플릿을 골랐습니다.'
                : '현재 추천할 템플릿이 없습니다.',
            recommended_templates: topTemplates,
            matched_inputs: matchedInputs,
            template_use_plan: [
                '표지 슬라이드에 브랜드명, 상품명, 핵심 메시지를 우선 배치합니다.',
                '본문 슬라이드에는 상세 설명과 필요한 섹션을 순서대로 배치합니다.',
                '스타일 키워드를 참고해 템플릿 톤앤매너를 유지합니다.'
            ]
        };
    }

    function mapTemplateRecord(record) {
        return {
            id: record.id,
            title: record.title,
            category: record.category,
            description: record.description,
            keywords: record.keywords,
            previewImagePath: record.preview_image_path,
            pptFileName: record.ppt_file_name,
            creatorName: record.creator_name || '-',
            createdAt: record.created_at,
            fields: safeJsonParse(record.field_schema_json, []) || [],
            aiAnalysisStatus: record.ai_analysis_status || 'idle',
            aiAnalysis: safeJsonParse(record.ai_analysis_json, null)
        };
    }

    router.post(
        '/api/ppt-templates',
        requireSellerOrAdminApi,
        upload.fields([
            { name: 'pptFile', maxCount: 1 },
            { name: 'previewImage', maxCount: 1 }
        ]),
        (req, res) => {
            const title = req.body.title?.trim();
            const category = req.body.category?.trim() || null;
            const description = req.body.description?.trim() || null;
            const keywords = req.body.keywords?.trim() || null;
            const fieldSchemaText = req.body.fieldSchemaText?.trim() || '';
            const pptFile = req.files?.pptFile?.[0];
            const previewImage = req.files?.previewImage?.[0];

            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: '템플릿 이름을 입력해 주세요.'
                });
            }

            if (!pptFile) {
                return res.status(400).json({
                    success: false,
                    message: 'PPT 또는 PPTX 파일을 업로드해 주세요.'
                });
            }

            const ext = path.extname(pptFile.originalname || '').toLowerCase();
            if (!['.ppt', '.pptx'].includes(ext)) {
                return res.status(400).json({
                    success: false,
                    message: 'PPT 또는 PPTX 파일만 업로드할 수 있습니다.'
                });
            }

            const fields = parseTemplateFields(fieldSchemaText);

            db.query(
                `
                    INSERT INTO ppt_templates (
                        title,
                        category,
                        description,
                        keywords,
                        ppt_file_name,
                        ppt_file_path,
                        preview_image_path,
                        field_schema_json,
                        created_by
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    title,
                    category,
                    description,
                    keywords,
                    normalizeUploadFileName(pptFile.originalname),
                    `/uploads/ppt-templates/${pptFile.filename}`,
                    previewImage ? `/uploads/ppt-previews/${previewImage.filename}` : null,
                    JSON.stringify(fields),
                    req.session.userId
                ],
                (err, result) => {
                    if (err) {
                        console.error('ppt template insert error:', err);
                        return res.status(500).json({
                            success: false,
                            message: 'PPT 템플릿 저장에 실패했습니다.'
                        });
                    }

                    return res.json({
                        success: true,
                        message: 'PPT 템플릿이 등록되었습니다.',
                        templateId: result.insertId
                    });
                }
            );
        }
    );

    router.get('/api/ppt-templates', (req, res) => {
        const q = (req.query.q || '').trim();
        const category = (req.query.category || '').trim();

        let sql = `
            SELECT
                ppt_templates.*,
                COALESCE(users.nickname, users.username) AS creator_name
            FROM ppt_templates
            LEFT JOIN users ON ppt_templates.created_by = users.id
            WHERE ppt_templates.is_active = 1
        `;
        const params = [];

        if (q) {
            sql += `
                AND (
                    ppt_templates.title LIKE ?
                    OR ppt_templates.description LIKE ?
                    OR ppt_templates.keywords LIKE ?
                )
            `;
            const likeValue = `%${q}%`;
            params.push(likeValue, likeValue, likeValue);
        }

        if (category) {
            sql += ` AND ppt_templates.category = ?`;
            params.push(category);
        }

        sql += ` ORDER BY ppt_templates.id DESC`;

        db.query(sql, params, (err, results) => {
            if (err) {
                console.error('ppt template list error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'PPT 템플릿을 불러오지 못했습니다.'
                });
            }

            return res.json({
                success: true,
                templates: results.map(mapTemplateRecord)
            });
        });
    });

    router.post('/api/ppt-templates/recommend', (req, res) => {
        const request = {
            useCase: req.body.useCase?.trim() || '',
            audience: req.body.audience?.trim() || '',
            brandName: req.body.brandName?.trim() || '',
            productName: req.body.productName?.trim() || '',
            keyMessage: req.body.keyMessage?.trim() || '',
            detailText: req.body.detailText?.trim() || '',
            styleKeywords: req.body.styleKeywords?.trim() || '',
            requiredSections: req.body.requiredSections?.trim() || ''
        };

        if (!request.useCase && !request.productName && !request.keyMessage) {
            return res.status(400).json({
                success: false,
                message: '사용 목적, 상품명, 핵심 메시지 중 하나 이상은 입력해 주세요.'
            });
        }

        db.query(
            `
                SELECT
                    ppt_templates.*,
                    COALESCE(users.nickname, users.username) AS creator_name
                FROM ppt_templates
                LEFT JOIN users ON ppt_templates.created_by = users.id
                WHERE ppt_templates.is_active = 1
                ORDER BY ppt_templates.id DESC
            `,
            async (err, results) => {
                if (err) {
                    console.error('ppt recommend list error:', err);
                    return res.status(500).json({
                        success: false,
                        message: '추천할 템플릿 목록을 불러오지 못했습니다.'
                    });
                }

                const templates = results.map(mapTemplateRecord);

                if (!templates.length) {
                    return res.status(404).json({
                        success: false,
                        message: '추천할 PPT 템플릿이 아직 없습니다.'
                    });
                }

                try {
                    const recommendation = process.env.OPENAI_API_KEY
                        ? await recommendTemplateWithAi(request, templates)
                        : buildFallbackRecommendation(request, templates);

                    return res.json({
                        success: true,
                        recommendation
                    });
                } catch (recommendError) {
                    console.error('ppt recommend error:', recommendError);

                    return res.json({
                        success: true,
                        recommendation: buildFallbackRecommendation(request, templates),
                        fallback: true,
                        message: 'AI 추천에 실패해 메타데이터 기반 추천으로 대체했습니다.'
                    });
                }
            }
        );
    });

    router.post('/api/ppt-templates/:id/match', (req, res) => {
        const templateId = Number(req.params.id);

        if (!templateId) {
            return res.status(400).json({
                success: false,
                message: '템플릿 정보가 올바르지 않습니다.'
            });
        }

        db.query(
            `
                SELECT *
                FROM ppt_templates
                WHERE id = ?
                  AND is_active = 1
                LIMIT 1
            `,
            [templateId],
            (err, results) => {
                if (err) {
                    console.error('ppt template match load error:', err);
                    return res.status(500).json({
                        success: false,
                        message: '템플릿 매칭 정보를 불러오지 못했습니다.'
                    });
                }

                if (results.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: '템플릿을 찾을 수 없습니다.'
                    });
                }

                const record = mapTemplateRecord(results[0]);
                const values = req.body.values || {};
                const sourceFields = record.fields.length
                    ? record.fields
                    : (record.aiAnalysis?.suggested_fields || []).map((field, index) => ({
                        key: field.key || `ai_field_${index + 1}`,
                        label: field.label || `추천 항목 ${index + 1}`,
                        type: field.type || 'text',
                        placeholder: ''
                    }));

                const matchedFields = sourceFields.map((field) => ({
                    ...field,
                    value: values[field.key] || ''
                }));

                return res.json({
                    success: true,
                    result: {
                        templateId: record.id,
                        title: record.title,
                        category: record.category || '미분류',
                        description: record.description || '',
                        pptFileName: record.pptFileName,
                        previewImagePath: record.previewImagePath,
                        matchedFields,
                        generatedSummary: matchedFields
                            .filter((field) => String(field.value || '').trim() !== '')
                            .slice(0, 4)
                            .map((field) => `${field.label}: ${field.value}`)
                    }
                });
            }
        );
    });

    router.post('/api/ppt-templates/:id/analyze', requireSellerOrAdminApi, (req, res) => {
        const templateId = Number(req.params.id);

        if (!templateId) {
            return res.status(400).json({
                success: false,
                message: '템플릿 정보가 올바르지 않습니다.'
            });
        }

        db.query(
            `
                SELECT *
                FROM ppt_templates
                WHERE id = ?
                  AND is_active = 1
                LIMIT 1
            `,
            [templateId],
            async (err, results) => {
                if (err) {
                    console.error('ppt template analyze load error:', err);
                    return res.status(500).json({
                        success: false,
                        message: '분석할 템플릿을 불러오지 못했습니다.'
                    });
                }

                if (results.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: '템플릿을 찾을 수 없습니다.'
                    });
                }

                try {
                    const analysis = await runTemplateAnalysis(results[0]);

                    db.query(
                        `
                            UPDATE ppt_templates
                            SET ai_analysis_json = ?, ai_analysis_status = 'done'
                            WHERE id = ?
                        `,
                        [JSON.stringify(analysis), templateId],
                        (updateErr) => {
                            if (updateErr) {
                                console.error('ppt template analysis save error:', updateErr);
                                return res.status(500).json({
                                    success: false,
                                    message: 'AI 분석 결과 저장에 실패했습니다.'
                                });
                            }

                            return res.json({
                                success: true,
                                message: 'AI 분석이 완료되었습니다.',
                                analysis
                            });
                        }
                    );
                } catch (analysisError) {
                    console.error('ppt template ai analysis error:', analysisError);

                    db.query(
                        `
                            UPDATE ppt_templates
                            SET ai_analysis_status = 'error'
                            WHERE id = ?
                        `,
                        [templateId],
                        () => {
                            const rawMessage = analysisError?.message || 'AI 분석에 실패했습니다.';
                            const safeMessage = rawMessage.includes('OpenAI analysis failed:')
                                ? `AI 분석 호출 실패: ${rawMessage.replace('OpenAI analysis failed:', '').trim()}`
                                : rawMessage;

                            return res.status(500).json({
                                success: false,
                                message: safeMessage
                            });
                        }
                    );
                }
            }
        );
    });

    return router;
};
