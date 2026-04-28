const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const ANALYZE_CONCURRENCY = 3;
const MAX_REFERENCE_IMAGES = 4;

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
        console.error('ppt ai file name normalize error:', error);
    }

    return rawName;
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

function escapePowerShellSingleQuotes(value) {
    return String(value || '').replace(/'/g, "''");
}

function toPublicPath(publicDir, absolutePath) {
    return `/${path.relative(publicDir, absolutePath).replace(/\\/g, '/')}`;
}

function normalizeReferenceImages(referenceImages = []) {
    return referenceImages
        .filter((item) => item && item.absolutePath)
        .slice(0, MAX_REFERENCE_IMAGES)
        .map((item, index) => ({
            absolutePath: item.absolutePath,
            label: item.label || `상품 이미지 ${index + 1}`,
            publicPath: item.publicPath || ''
        }));
}

async function ensureDirectoryEmpty(targetDir) {
    await fsp.rm(targetDir, { recursive: true, force: true });
    await fsp.mkdir(targetDir, { recursive: true });
}

async function callOpenAiJson(prompt, imageAbsolutePaths = []) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
    }

    const normalizedImagePaths = Array.isArray(imageAbsolutePaths)
        ? imageAbsolutePaths.filter(Boolean)
        : (imageAbsolutePaths ? [imageAbsolutePaths] : []);

    const content = [
        {
            type: 'input_text',
            text: prompt
        }
    ];

    for (const imageAbsolutePath of normalizedImagePaths) {
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

async function mapInBatches(items, mapper, concurrency = ANALYZE_CONCURRENCY) {
    const results = new Array(items.length);
    let currentIndex = 0;

    async function worker() {
        while (true) {
            const targetIndex = currentIndex;
            currentIndex += 1;

            if (targetIndex >= items.length) {
                return;
            }

            results[targetIndex] = await mapper(items[targetIndex], targetIndex);
        }
    }

    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
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

function buildReferenceImageContext(referenceImages = []) {
    if (!referenceImages.length) {
        return '상품 이미지 참고 자료 없음';
    }

    return referenceImages
        .map((image, index) => `${index + 1}. ${image.label || `상품 이미지 ${index + 1}`}`)
        .join('\n');
}

async function analyzeSlideImage(
    slidePath,
    slideNumber,
    sourceFileName,
    contextText,
    referenceImages = []
) {
    const normalizedReferenceImages = normalizeReferenceImages(referenceImages);
    const prompt = [
        '업로드된 PPT 템플릿의 슬라이드 한 페이지를 분석한다.',
        '첫 번째 이미지는 현재 슬라이드이고, 뒤에 따라오는 추가 이미지들은 판매자가 함께 업로드한 상품 이미지다.',
        '슬라이드 분위기뿐 아니라 상품 이미지와 어울리는지, 같은 상품으로 보이는지, 전체 상품 소개 흐름에 잘 맞는지도 함께 판단한다.',
        '반드시 JSON만 반환한다.',
        '{',
        '  "page": 1,',
        '  "mood": "...",',
        '  "layout_type": "...",',
        '  "visual_tone": "...",',
        '  "purpose_guess": "...",',
        '  "design_keywords": ["...", "...", "..."],',
        '  "product_fit": "...",',
        '  "summary": "..."',
        '}',
        '',
        `원본 파일명: ${sourceFileName}`,
        `현재 분석 페이지: ${slideNumber}`,
        `보조 정보: ${contextText || '-'}`,
        `상품 이미지 참고 목록:\n${buildReferenceImageContext(normalizedReferenceImages)}`
    ].join('\n');

    const result = await callOpenAiJson(
        prompt,
        [slidePath, ...normalizedReferenceImages.map((image) => image.absolutePath)]
    );

    return {
        page: slideNumber,
        mood: result.mood || '-',
        layoutType: result.layout_type || '-',
        visualTone: result.visual_tone || '-',
        purposeGuess: result.purpose_guess || '-',
        designKeywords: Array.isArray(result.design_keywords) ? result.design_keywords : [],
        productFit: result.product_fit || '-',
        summary: result.summary || '-'
    };
}

async function summarizeSlideAnalyses(slideAnalyses, meta, referenceImages = []) {
    const normalizedReferenceImages = normalizeReferenceImages(referenceImages);
    const prompt = [
        '여러 PPT 슬라이드 분석 결과와 상품 이미지를 바탕으로 상품 상세페이지에 들어갈 전체 소개 요약을 만든다.',
        '문장은 자연스러운 한국어로 3~5문장 정도로 작성하고, 템플릿의 분위기와 상품 이미지가 함께 보여주는 인상을 종합해 설명한다.',
        '반드시 JSON만 반환한다.',
        '{',
        '  "summary": "...",',
        '  "overall_mood": "...",',
        '  "recommended_use": "...",',
        '  "product_image_summary": "...",',
        '  "keywords": ["...", "...", "..."]',
        '}',
        '',
        `상품명: ${meta.title || meta.sourceFileName || ''}`,
        `판매자 메모: ${meta.sellerNote || '-'}`,
        `키워드: ${meta.keywords || '-'}`,
        `상품 이미지 참고 목록:\n${buildReferenceImageContext(normalizedReferenceImages)}`,
        `슬라이드 분석 결과: ${JSON.stringify(slideAnalyses)}`
    ].join('\n');

    const result = await callOpenAiJson(
        prompt,
        normalizedReferenceImages.map((image) => image.absolutePath)
    );

    return {
        summary: result.summary || '',
        overallMood: result.overall_mood || '-',
        recommendedUse: result.recommended_use || '-',
        productImageSummary: result.product_image_summary || '-',
        keywords: Array.isArray(result.keywords) ? result.keywords : []
    };
}

async function runPptAiPipeline({
    sourcePptPath,
    sourceFileName,
    outputKey,
    publicDir,
    outputNamespace = 'ppt-ai',
    context = {},
    referenceImages = []
}) {
    const rootDir = path.join(publicDir, 'uploads', outputNamespace);
    const pdfDir = path.join(rootDir, 'pdf');
    const slideDirRoot = path.join(rootDir, 'slides');
    const outputPdfPath = path.join(pdfDir, `${outputKey}.pdf`);
    const outputSlideDir = path.join(slideDirRoot, outputKey);

    [rootDir, pdfDir, slideDirRoot].forEach((dirPath) => {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });

    const normalizedReferenceImages = normalizeReferenceImages(referenceImages);
    const slidePaths = await convertPptToAssets(sourcePptPath, outputPdfPath, outputSlideDir);
    const contextText = [
        context.title,
        context.keywords,
        context.sellerNote,
        normalizedReferenceImages.length ? `상품 이미지 ${normalizedReferenceImages.length}장 참고` : ''
    ]
        .filter(Boolean)
        .join(' | ');

    const slideResults = await mapInBatches(
        slidePaths,
        async (slidePath, index) => {
            const analysis = await analyzeSlideImage(
                slidePath,
                index + 1,
                sourceFileName,
                contextText,
                normalizedReferenceImages
            );

            return {
                page: index + 1,
                imageUrl: toPublicPath(publicDir, slidePath),
                analysis
            };
        }
    );

    const summaryResult = await summarizeSlideAnalyses(
        slideResults.map((slide) => slide.analysis),
        {
            ...context,
            sourceFileName
        },
        normalizedReferenceImages
    );

    return {
        pdfUrl: toPublicPath(publicDir, outputPdfPath),
        slideCount: slideResults.length,
        slides: slideResults,
        referenceImages: normalizedReferenceImages.map((image) => ({
            label: image.label,
            publicPath: image.publicPath
        })),
        summary: summaryResult
    };
}

module.exports = {
    runPptAiPipeline,
    normalizeUploadFileName
};
