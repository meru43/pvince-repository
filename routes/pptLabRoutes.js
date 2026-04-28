const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const ANALYZE_CONCURRENCY = 3;

module.exports = () => {
    const router = express.Router();

    const publicDir = path.join(__dirname, '..', 'public');
    const pptLabRootDir = path.join(publicDir, 'uploads', 'ppt-lab');
    const sourceDir = path.join(pptLabRootDir, 'source');
    const pdfDir = path.join(pptLabRootDir, 'pdf');
    const slideDirRoot = path.join(pptLabRootDir, 'slides');

    [pptLabRootDir, sourceDir, pdfDir, slideDirRoot].forEach((dirPath) => {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });

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
                message: '셀러 또는 관리자만 사용할 수 있습니다.'
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
            console.error('ppt lab file name normalize error:', error);
        }

        return rawName;
    }

    function sanitizeBaseName(fileName) {
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const safeName = baseName
            .replace(/[^\w가-힣.-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

        return safeName || 'ppt_file';
    }

    function toPublicPath(absolutePath) {
        return `/${path.relative(publicDir, absolutePath).replace(/\\/g, '/')}`;
    }

    function getImageMimeType(filePath) {
        const ext = path.extname(filePath || '').toLowerCase();
        if (ext === '.png') return 'image/png';
        if (ext === '.webp') return 'image/webp';
        if (ext === '.gif') return 'image/gif';
        return 'image/jpeg';
    }

    function stripCodeFence(text) {
        return String(text || '')
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
    }

    async function callOpenAiJson(prompt, imageAbsolutePath) {
        const apiKey = process.env.OPENAI_API_KEY;
        const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
        }

        const content = [
            {
                type: 'input_text',
                text: prompt
            }
        ];

        if (imageAbsolutePath) {
            const base64Image = await fsp.readFile(imageAbsolutePath, { encoding: 'base64' });
            content.push({
                type: 'input_image',
                image_url: `data:${getImageMimeType(imageAbsolutePath)};base64,${base64Image}`
            });
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

        return JSON.parse(stripCodeFence(outputText));
    }

    async function ensureDirectoryEmpty(targetDir) {
        await fsp.rm(targetDir, { recursive: true, force: true });
        await fsp.mkdir(targetDir, { recursive: true });
    }

    function escapePowerShellSingleQuotes(value) {
        return String(value || '').replace(/'/g, "''");
    }

    async function convertPptToAssets(sourcePptPath, outputPdfPath, outputSlideDir) {
        await ensureDirectoryEmpty(outputSlideDir);

        const psScript = [
            "$ErrorActionPreference = 'Stop'",
            `$pptPath = '${escapePowerShellSingleQuotes(sourcePptPath)}'`,
            `$pdfPath = '${escapePowerShellSingleQuotes(outputPdfPath)}'`,
            `$slideDir = '${escapePowerShellSingleQuotes(outputSlideDir)}'`,
            '$ppt = $null',
            '$presentation = $null',
            'try {',
            '  $ppt = New-Object -ComObject PowerPoint.Application',
            '  $presentation = $ppt.Presentations.Open($pptPath, $true, $false, $false)',
            '  $presentation.SaveAs($pdfPath, 32)',
            "  $presentation.Export($slideDir, 'PNG', 1280, 720)",
            '} finally {',
            '  if ($presentation -ne $null) { $presentation.Close() }',
            '  if ($ppt -ne $null) { $ppt.Quit() }',
            '  [System.GC]::Collect()',
            '  [System.GC]::WaitForPendingFinalizers()',
            '}'
        ].join('; ');

        await execFileAsync('powershell', [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            psScript
        ], {
            windowsHide: true,
            maxBuffer: 1024 * 1024 * 20
        });

        const files = await fsp.readdir(outputSlideDir);
        const slideFiles = files
            .filter((fileName) => /\.(png|jpe?g)$/i.test(fileName))
            .sort((a, b) => {
                const aMatch = a.match(/(\d+)/);
                const bMatch = b.match(/(\d+)/);
                const aNum = aMatch ? Number(aMatch[1]) : 0;
                const bNum = bMatch ? Number(bMatch[1]) : 0;
                return aNum - bNum;
            })
            .map((fileName) => path.join(outputSlideDir, fileName));

        if (!slideFiles.length) {
            throw new Error('슬라이드 이미지 추출에 실패했습니다.');
        }

        return slideFiles;
    }

    async function mapInBatches(items, mapper, concurrency = ANALYZE_CONCURRENCY) {
        const results = new Array(items.length);
        let currentIndex = 0;

        async function worker() {
            while (currentIndex < items.length) {
                const targetIndex = currentIndex;
                currentIndex += 1;
                results[targetIndex] = await mapper(items[targetIndex], targetIndex);
            }
        }

        const workerCount = Math.min(concurrency, items.length);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));
        return results;
    }

    async function analyzeSlideImage(slidePath, slideNumber, sourceFileName) {
        const prompt = [
            '업로드된 PPT 템플릿의 한 페이지 이미지를 분석한다.',
            '이 슬라이드가 주는 전체적인 느낌과 디자인 방향을 설명하고, 어떤 용도로 쓰기 좋은 페이지인지 판단한다.',
            '반드시 JSON만 반환한다.',
            '{',
            '  "page": 1,',
            '  "mood": "...",',
            '  "layout_type": "...",',
            '  "visual_tone": "...",',
            '  "purpose_guess": "...",',
            '  "design_keywords": ["...", "...", "..."],',
            '  "summary": "..."',
            '}',
            '',
            `원본 파일명: ${sourceFileName}`,
            `현재 분석 페이지: ${slideNumber}`
        ].join('\n');

        const result = await callOpenAiJson(prompt, slidePath);

        return {
            page: slideNumber,
            mood: result.mood || '-',
            layoutType: result.layout_type || '-',
            visualTone: result.visual_tone || '-',
            purposeGuess: result.purpose_guess || '-',
            designKeywords: Array.isArray(result.design_keywords) ? result.design_keywords : [],
            summary: result.summary || '-'
        };
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, sourceDir);
        },
        filename: (req, file, cb) => {
            const normalizedName = normalizeUploadFileName(file.originalname);
            const ext = path.extname(normalizedName).toLowerCase();
            const safeBaseName = sanitizeBaseName(normalizedName);
            cb(null, `${Date.now()}_${safeBaseName}${ext}`);
        }
    });

    const upload = multer({
        storage,
        limits: {
            fileSize: 80 * 1024 * 1024
        }
    });

    router.post('/api/ppt-lab/analyze', requireSellerOrAdminApi, upload.single('pptFile'), async (req, res) => {
        const pptFile = req.file;

        if (!pptFile) {
            return res.status(400).json({
                success: false,
                message: 'PPT 또는 PPTX 파일을 업로드해 주세요.'
            });
        }

        const normalizedOriginalName = normalizeUploadFileName(pptFile.originalname);
        const ext = path.extname(normalizedOriginalName).toLowerCase();

        if (!['.ppt', '.pptx'].includes(ext)) {
            return res.status(400).json({
                success: false,
                message: 'PPT 또는 PPTX 파일만 업로드할 수 있습니다.'
            });
        }

        const jobKey = path.basename(pptFile.filename, path.extname(pptFile.filename));
        const outputPdfPath = path.join(pdfDir, `${jobKey}.pdf`);
        const outputSlideDir = path.join(slideDirRoot, jobKey);

        try {
            const slidePaths = await convertPptToAssets(pptFile.path, outputPdfPath, outputSlideDir);

            const slideResults = await mapInBatches(
                slidePaths,
                async (slidePath, index) => {
                    const analysis = await analyzeSlideImage(slidePath, index + 1, normalizedOriginalName);

                    return {
                        page: index + 1,
                        imageUrl: toPublicPath(slidePath),
                        analysis
                    };
                }
            );

            return res.json({
                success: true,
                message: 'PPT를 PDF와 슬라이드 이미지로 변환하고 AI 분석까지 완료했습니다.',
                result: {
                    sourceFileName: normalizedOriginalName,
                    sourceFileUrl: toPublicPath(pptFile.path),
                    pdfUrl: toPublicPath(outputPdfPath),
                    slideCount: slideResults.length,
                    slides: slideResults
                }
            });
        } catch (error) {
            console.error('ppt lab analyze error:', error);
            return res.status(500).json({
                success: false,
                message: `분석 중 오류가 발생했습니다. ${error.message || ''}`.trim()
            });
        }
    });

    return router;
};
