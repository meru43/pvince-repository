document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ppt-match-form');
    const messageEl = document.getElementById('ppt-match-message');
    const submitBtn = document.getElementById('ppt-match-submit');
    const resultCount = document.getElementById('ppt-result-count');
    const resultList = document.getElementById('ppt-result-list');
    const selectedColorChip = document.getElementById('ppt-selected-color-chip');
    const selectedColorText = document.getElementById('ppt-selected-color-text');
    const paletteInputs = Array.from(document.querySelectorAll('input[name="preferredColor"]'));
    const usePlaceInput = document.getElementById('ppt-use-place');
    const usePurposeInput = document.getElementById('ppt-use-purpose');
    const requestDetailInput = document.getElementById('ppt-request-detail');

    const colorCache = new Map();
    const queryParams = new URLSearchParams(window.location.search);
    const initialQuery = (queryParams.get('q') || '').trim();
    let products = [];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function tokenize(value) {
        return String(value || '')
            .toLowerCase()
            .split(/[\s,./#|()[\]-]+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 2);
    }

    function hexToRgb(hex) {
        const normalized = String(hex || '').replace('#', '');
        if (normalized.length !== 6) return { r: 0, g: 0, b: 0 };
        return {
            r: parseInt(normalized.slice(0, 2), 16),
            g: parseInt(normalized.slice(2, 4), 16),
            b: parseInt(normalized.slice(4, 6), 16)
        };
    }

    function rgbToHex({ r, g, b }) {
        const toHex = (value) => Number(value || 0).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }

    function clampColorChannel(value) {
        return Math.max(0, Math.min(255, Number(value || 0)));
    }

    function isNeutralColor({ r, g, b }) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return (max - min) <= 28;
    }

    function getColorSaturation({ r, g, b }) {
        return Math.max(r, g, b) - Math.min(r, g, b);
    }

    function getColorBrightness({ r, g, b }) {
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    function getDisplayPrice(product) {
        if (Number(product.is_free) === 1) return '무료';
        if (product.sale_price) return `${Number(product.sale_price).toLocaleString()}원`;
        return `${Number(product.price || 0).toLocaleString()}원`;
    }

    function setMessage(message = '', isError = false) {
        messageEl.textContent = message;
        messageEl.classList.toggle('is-error', Boolean(isError));
        messageEl.classList.toggle('is-success', Boolean(message && !isError));
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        submitBtn.textContent = isLoading ? '매칭 계산 중...' : '매칭 검색하기';
    }

    function getSelectedPaletteColor() {
        return paletteInputs.find((input) => input.checked)?.value || '#6D2E9B';
    }

    function updateSelectedColorUi(color) {
        const hex = String(color || '#000000').toUpperCase();
        selectedColorChip.style.background = hex;
        selectedColorText.textContent = `선택 색상 ${hex}`;
    }

    function calculateTextMatch(product, request) {
        const requestTokens = Array.from(new Set([
            ...tokenize(request.usePlace),
            ...tokenize(request.usePurpose),
            ...tokenize(request.requestDetail)
        ]));

        if (!requestTokens.length) {
            return { score: 0, matchedKeywords: [] };
        }

        const haystack = [
            product.title,
            product.description,
            product.ai_summary_text,
            product.keywords,
            product.use_place,
            product.use_purpose,
            product.uploader_name
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        const matchedKeywords = requestTokens.filter((token) => haystack.includes(token));
        return {
            score: matchedKeywords.length / requestTokens.length,
            matchedKeywords
        };
    }

    function calculateColorMatch(selectedColor, productColors) {
        const selected = hexToRgb(selectedColor);
        const palette = Array.isArray(productColors) && productColors.length ? productColors : [{ r: 0, g: 0, b: 0 }];
        const maxDistance = Math.sqrt((255 ** 2) * 3);

        return palette.reduce((best, color) => {
            const distance = Math.sqrt(
                ((selected.r - color.r) ** 2) +
                ((selected.g - color.g) ** 2) +
                ((selected.b - color.b) ** 2)
            );
            const score = Math.max(0, 1 - (distance / maxDistance));
            return Math.max(best, score);
        }, 0);
    }

    function buildReasonText(textMatch, colorMatch) {
        const reasons = [];
        if (!textMatch.matchedKeywords.length) {
            reasons.push('직접 일치한 키워드는 적지만 전체 맥락으로 비교했습니다.');
        }
        reasons.push(`색상 유사도 ${Math.round(colorMatch * 100)}% 반영`);
        return reasons.join(' / ');
    }

    async function extractTopColors(imageUrl) {
        if (!imageUrl) return [{ r: 0, g: 0, b: 0 }];
        if (colorCache.has(imageUrl)) return colorCache.get(imageUrl);

        const colors = await new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 32;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                if (!ctx) {
                    resolve([{ r: 0, g: 0, b: 0 }]);
                    return;
                }

                ctx.drawImage(img, 0, 0, size, size);
                const { data } = ctx.getImageData(0, 0, size, size);
                const buckets = new Map();

                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    if (alpha < 30) continue;

                    const r = clampColorChannel(Math.round(data[i] / 32) * 32);
                    const g = clampColorChannel(Math.round(data[i + 1] / 32) * 32);
                    const b = clampColorChannel(Math.round(data[i + 2] / 32) * 32);
                    const key = `${r}-${g}-${b}`;
                    const current = buckets.get(key) || { r, g, b, count: 0 };
                    current.count += 1;
                    buckets.set(key, current);
                }

                const rankedColors = Array.from(buckets.values())
                    .map(({ r, g, b, count }) => ({
                        r,
                        g,
                        b,
                        count,
                        saturation: getColorSaturation({ r, g, b }),
                        brightness: getColorBrightness({ r, g, b }),
                        neutral: isNeutralColor({ r, g, b })
                    }))
                    .sort((a, b) => b.count - a.count);

                const vividColors = rankedColors
                    .filter((color) => !color.neutral)
                    .sort((a, b) => b.saturation - a.saturation || b.count - a.count);

                const mainColors = rankedColors
                    .filter((color) => !color.neutral)
                    .sort((a, b) => b.count - a.count || b.saturation - a.saturation);

                const neutralColors = rankedColors
                    .filter((color) => color.neutral)
                    .sort((a, b) => b.count - a.count || a.brightness - b.brightness);

                const selectedColors = [];

                function pushUnique(color) {
                    if (!color) return;
                    const exists = selectedColors.some((picked) =>
                        picked.r === color.r && picked.g === color.g && picked.b === color.b
                    );
                    if (!exists) {
                        selectedColors.push({ r: color.r, g: color.g, b: color.b });
                    }
                }

                pushUnique(vividColors[0]);
                pushUnique(mainColors[0]);
                pushUnique(neutralColors[0]);

                rankedColors.forEach((color) => {
                    if (selectedColors.length >= 3) return;
                    pushUnique(color);
                });

                resolve(selectedColors.length ? selectedColors.slice(0, 3) : [{ r: 0, g: 0, b: 0 }]);
            };

            img.onerror = () => resolve([{ r: 0, g: 0, b: 0 }]);
            img.src = imageUrl;
        });

        colorCache.set(imageUrl, colors);
        return colors;
    }

    async function loadProducts() {
        const response = await fetch('/api/products', {
            method: 'GET',
            credentials: 'include'
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || '상품 목록을 불러오지 못했습니다.');
        }

        products = (data.products || []).filter((product) => (
            Boolean(product.ai_summary_text && product.ai_slide_analysis_json)
        ));
    }

    async function buildMatches(request) {
        const selectedColor = request.preferredColor || '#6D2E9B';

        const enriched = await Promise.all(products.map(async (product) => {
            const topColors = await extractTopColors(product.thumbnail_path || '');
            const textMatch = calculateTextMatch(product, request);
            const colorMatch = calculateColorMatch(selectedColor, topColors);
            const overallScore = Math.round(((textMatch.score * 0.75) + (colorMatch * 0.25)) * 100);

            return {
                product,
                overallScore,
                textScore: Math.round(textMatch.score * 100),
                colorScore: Math.round(colorMatch * 100),
                matchedKeywords: textMatch.matchedKeywords,
                topColorHexes: topColors.map((color) => rgbToHex(color)),
                reason: buildReasonText(textMatch, colorMatch)
            };
        }));

        return enriched
            .sort((a, b) => b.overallScore - a.overallScore)
            .filter((item) => item.overallScore > 0);
    }

    function renderMatches(matches) {
        if (!matches.length) {
            resultCount.textContent = '현재 조건과 비슷한 템플릿을 아직 찾지 못했습니다.';
            resultList.innerHTML = `
                <article class="ppt-empty-card">
                    <strong>매칭 결과가 없습니다.</strong>
                    <p>검색어를 조금 더 구체적으로 적거나 다른 색상을 골라 다시 시도해 보세요.</p>
                    <a href="/products-page" class="btn btn-outline ppt-empty-link">상품리스트 바로가기</a>
                </article>
            `;
            return;
        }

        resultCount.textContent = `총 ${matches.length}개의 템플릿을 찾았고 매치율 높은 순으로 정렬했습니다.`;
        resultList.innerHTML = matches.map(({ product, overallScore, textScore, colorScore, topColorHexes, reason }) => `
            <article class="ppt-result-item">
                <a href="/products-page/${product.id}" class="ppt-result-thumb">
                    <img src="${escapeHtml(product.thumbnail_path || 'https://via.placeholder.com/800x520?text=PPT')}" alt="${escapeHtml(product.title)}" />
                </a>
                <div class="ppt-result-body">
                    <div class="ppt-result-top">
                        <div>
                            <p class="ppt-result-category">${escapeHtml(product.uploader_name || '판매자')}</p>
                            <h4 class="ppt-result-title">${escapeHtml(product.title)}</h4>
                        </div>
                        <div class="ppt-match-rate">
                            <span>매치율</span>
                            <strong>${overallScore}%</strong>
                        </div>
                    </div>

                    <p class="ppt-result-summary">${escapeHtml(product.ai_summary_text || product.description || '아직 AI 요약이 없는 상품입니다.')}</p>

                    <div class="ppt-score-grid">
                        <div class="ppt-score-card">
                            <span>내용 매칭</span>
                            <strong>${textScore}%</strong>
                        </div>
                        <div class="ppt-score-card">
                            <span>색상 매칭</span>
                            <strong>${colorScore}%</strong>
                        </div>
                        <div class="ppt-score-card color">
                            <span>대표 색상</span>
                            <strong class="ppt-color-palette">
                                ${topColorHexes.map((hex) => `<i title="${escapeHtml(hex)}" style="background:${escapeHtml(hex)}"></i>`).join('')}
                            </strong>
                            <p class="ppt-color-labels">${topColorHexes.map((hex) => escapeHtml(hex)).join(' / ')}</p>
                        </div>
                    </div>

                    <p class="ppt-result-reason">${escapeHtml(reason)}</p>

                    <div class="ppt-result-actions">
                        <span class="ppt-result-price">${escapeHtml(getDisplayPrice(product))}</span>
                        <a href="/products-page/${product.id}" class="btn btn-outline">상품 보기</a>
                    </div>
                </div>
            </article>
        `).join('');
    }

    async function runSearch() {
        const request = {
            usePlace: String(usePlaceInput.value || '').trim(),
            usePurpose: String(usePurposeInput.value || '').trim(),
            requestDetail: String(requestDetailInput.value || '').trim(),
            preferredColor: String(getSelectedPaletteColor())
        };

        if (!request.usePlace && !request.usePurpose && !request.requestDetail) {
            setMessage('사용처, 목적, 상세 설명 중 하나 이상을 입력해 주세요.', true);
            return;
        }

        try {
            setLoading(true);
            setMessage('');
            updateSelectedColorUi(request.preferredColor);

            if (!products.length) {
                await loadProducts();
            }

            const matches = await buildMatches(request);
            renderMatches(matches);

            if (matches.length) {
                setMessage('매칭 검색이 완료되었습니다.');
            } else {
                setMessage('검색은 완료되었지만 현재 조건과 비슷한 상품이 없습니다.', true);
            }
        } catch (error) {
            console.error('ppt match search error:', error);
            setMessage(error.message || '매칭 검색 중 오류가 발생했습니다.', true);
        } finally {
            setLoading(false);
        }
    }

    paletteInputs.forEach((input) => {
        input.addEventListener('change', () => updateSelectedColorUi(getSelectedPaletteColor()));
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await runSearch();
    });

    updateSelectedColorUi(getSelectedPaletteColor());

    if (initialQuery) {
        requestDetailInput.value = initialQuery;
        runSearch();
    }
});
