document.addEventListener('DOMContentLoaded', async () => {
    const MAX_THUMBNAILS = 10;
    const closeButtonSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="icon icon-tabler icons-tabler-filled icon-tabler-x" aria-hidden="true" focusable="false">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M6.707 5.293l5.293 5.292l5.293 -5.292a1 1 0 0 1 1.414 1.414l-5.292 5.293l5.292 5.293a1 1 0 0 1 -1.414 1.414l-5.293 -5.292l-5.293 5.292a1 1 0 1 1 -1.414 -1.414l5.292 -5.293l-5.292 -5.293a1 1 0 0 1 1.414 -1.414" />
        </svg>
    `.trim();

    const form = document.getElementById('seller-upload2-form');
    const errorText = document.getElementById('seller-upload-error');
    const analyzeButton = document.getElementById('seller-upload2-analyze');
    const submitButton = document.getElementById('seller-upload2-submit');
    const loadingOverlay = document.getElementById('page-loading-overlay');
    const loadingTitle = document.getElementById('page-loading-title');
    const loadingText = document.getElementById('page-loading-text');
    const analysisResultBox = document.getElementById('analysis-result-box');
    const analysisLoadingBox = document.getElementById('analysis-loading-box');
    const analysisResultMeta = document.getElementById('analysis-result-meta');
    const analysisResultSummary = document.getElementById('analysis-result-summary');

    const titleInput = document.getElementById('product-title');
    const thumbnailInput = document.getElementById('product-thumbnail');
    const thumbnailPreviewList = document.getElementById('thumbnail-preview-list');
    const priceInput = document.getElementById('product-price');
    const salePriceInput = document.getElementById('product-sale-price');
    const isFreeInput = document.getElementById('product-is-free');
    const usePlaceInput = document.getElementById('product-use-place');
    const usePurposeInput = document.getElementById('product-use-purpose');
    const descriptionInput = document.getElementById('product-description');
    const keywordsInput = document.getElementById('product-keywords');
    const productFileInput = document.getElementById('product-file');
    const productFilePreviewList = document.getElementById('product-file-preview-list');
    const excludedPagesInput = document.getElementById('product-excluded-pages');
    const isPptAiAnalysisSupported = form?.dataset?.pptAiAnalysisSupported === '1';

    let selectedThumbnails = [];
    let representativeThumbnailIndex = 0;
    let selectedProductFile = null;
    let isSubmitting = false;
    let analyzedPayload = null;

    const descriptionEditor = window.createProductJoditEditor
        ? window.createProductJoditEditor(descriptionInput)
        : null;

    function setError(message = '') {
        errorText.textContent = message;
    }

    function setLoading(isLoading, phase = 'analyze') {
        isSubmitting = isLoading;

        if (analyzeButton) {
            analyzeButton.disabled = isLoading;
            analyzeButton.classList.toggle('is-loading', isLoading && phase === 'analyze');
            analyzeButton.textContent = isLoading && phase === 'analyze'
                ? 'AI 분석 중...'
                : 'AI 분석하기';
        }

        if (submitButton) {
            submitButton.disabled = isLoading || !analyzedPayload;
            submitButton.classList.toggle('is-loading', isLoading && phase === 'register');
            submitButton.textContent = isLoading && phase === 'register'
                ? '상품 등록 중...'
                : '상품 등록하기';
        }

        const usePageOverlay = phase === 'register';

        if (loadingOverlay) {
            loadingOverlay.classList.toggle('is-active', isLoading);
            loadingOverlay.setAttribute('aria-hidden', isLoading && usePageOverlay ? 'false' : 'true');
            if (!usePageOverlay) {
                loadingOverlay.classList.remove('is-active');
                loadingOverlay.setAttribute('aria-hidden', 'true');
            }
        }

        if (loadingTitle) {
            loadingTitle.textContent = phase === 'register'
                ? '상품을 등록하는 중입니다.'
                : 'PPT를 분석하는 중입니다.';
        }

        if (loadingText) {
            loadingText.textContent = phase === 'register'
                ? '등록이 끝날 때까지 페이지를 나가지 말아주세요.'
                : '분석이 끝날 때까지 페이지를 나가지 말아주세요.';
        }

        if (analysisLoadingBox) {
            analysisLoadingBox.style.display = isLoading && phase === 'analyze' ? 'block' : 'none';
        }
    }

    function clearAnalysisResult() {
        analyzedPayload = null;

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = '상품 등록하기';
        }

        if (analysisResultBox) {
            analysisResultBox.style.display = 'none';
        }

        if (analysisResultMeta) {
            analysisResultMeta.textContent = '';
        }

        if (analysisResultSummary) {
            analysisResultSummary.textContent = '';
        }

        if (analysisLoadingBox) {
            analysisLoadingBox.style.display = 'none';
        }
    }

    function renderAnalysisResult(payload) {
        analyzedPayload = payload;

        if (submitButton) {
            submitButton.disabled = false;
        }

        if (!analysisResultBox || !analysisResultMeta || !analysisResultSummary) {
            return;
        }

        const totalSummary = payload.totalSlideCount ? `전체 ${payload.totalSlideCount}장` : '';
        const analyzedSummary = payload.slideCount ? `분석 ${payload.slideCount}장` : '';
        const excludedSummary = Array.isArray(payload.excludedPages) && payload.excludedPages.length
            ? `제외 ${payload.excludedPages.join(', ')}`
            : '';

        analysisResultMeta.textContent = [totalSummary, analyzedSummary, excludedSummary]
            .filter(Boolean)
            .join(' · ');
        analysisResultSummary.textContent = payload.summary?.summary
            || payload.aiSummary
            || 'AI 분석 요약이 없습니다.';
        if (analysisLoadingBox) {
            analysisLoadingBox.style.display = 'none';
        }
        analysisResultBox.style.display = 'block';
    }

    window.addEventListener('beforeunload', (event) => {
        if (!isSubmitting) {
            return;
        }

        event.preventDefault();
        event.returnValue = '';
    });

    function filterNumericInput(input) {
        input.addEventListener('input', () => {
            input.value = input.value.replace(/[^\d]/g, '');
        });
    }

    function togglePriceInputs() {
        const isFree = isFreeInput.checked;

        if (isFree) {
            priceInput.value = '0';
            salePriceInput.value = '0';
            priceInput.disabled = true;
            salePriceInput.disabled = true;
            return;
        }

        priceInput.disabled = false;
        salePriceInput.disabled = false;

        if (priceInput.value === '0') {
            priceInput.value = '';
        }

        if (salePriceInput.value === '0') {
            salePriceInput.value = '';
        }
    }

    function syncThumbnailInput() {
        const dataTransfer = new DataTransfer();
        selectedThumbnails.forEach((file) => dataTransfer.items.add(file));
        thumbnailInput.files = dataTransfer.files;
    }

    function markAnalysisDirty() {
        if (!analyzedPayload) {
            return;
        }

        clearAnalysisResult();
        setError('입력 내용이 변경되어 AI 분석을 다시 실행해야 합니다.');
    }

    function renderThumbnailPreview() {
        if (!selectedThumbnails.length) {
            thumbnailPreviewList.innerHTML = '';
            representativeThumbnailIndex = 0;
            return;
        }

        if (representativeThumbnailIndex >= selectedThumbnails.length) {
            representativeThumbnailIndex = 0;
        }

        thumbnailPreviewList.innerHTML = selectedThumbnails.map((file, index) => {
            const previewUrl = URL.createObjectURL(file);
            const checked = index === representativeThumbnailIndex ? 'checked' : '';

            return `
                <div class="thumbnail-preview-card ${checked ? 'is-representative' : ''}">
                    <button type="button" class="preview-remove-btn" data-remove-index="${index}" aria-label="이미지 제거">${closeButtonSvg}</button>
                    <img src="${previewUrl}" alt="${file.name}" class="thumbnail-preview-image">
                    <label class="thumbnail-radio-label">
                        <input type="radio" name="representative-thumbnail" value="${index}" ${checked}>
                        <span>대표 이미지</span>
                    </label>
                    <p class="preview-file-name">${file.name}</p>
                </div>
            `;
        }).join('');

        thumbnailPreviewList.querySelectorAll('.preview-remove-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number(button.dataset.removeIndex);
                if (Number.isNaN(index)) {
                    return;
                }

                const removedWasRepresentative = representativeThumbnailIndex === index;
                selectedThumbnails.splice(index, 1);

                if (removedWasRepresentative) {
                    representativeThumbnailIndex = 0;
                } else if (representativeThumbnailIndex > index) {
                    representativeThumbnailIndex -= 1;
                }

                setError('');
                syncThumbnailInput();
                renderThumbnailPreview();
                markAnalysisDirty();
            });
        });

        thumbnailPreviewList.querySelectorAll('input[name="representative-thumbnail"]').forEach((input) => {
            input.addEventListener('change', () => {
                representativeThumbnailIndex = Number(input.value) || 0;
                renderThumbnailPreview();
                markAnalysisDirty();
            });
        });
    }

    function renderProductFilePreview() {
        if (!selectedProductFile) {
            productFilePreviewList.innerHTML = '';
            return;
        }

        productFilePreviewList.innerHTML = `
            <div class="product-file-preview-item">
                <div class="product-file-preview-meta">
                    <strong class="product-file-preview-name">${selectedProductFile.name}</strong>
                    <span class="product-file-preview-size">${Math.max(1, Math.round(selectedProductFile.size / 1024))}KB</span>
                </div>
                <button type="button" class="preview-remove-btn" id="product-file-remove-btn" aria-label="파일 제거">${closeButtonSvg}</button>
            </div>
        `;

        document.getElementById('product-file-remove-btn')?.addEventListener('click', () => {
            selectedProductFile = null;
            productFileInput.value = '';
            setError('');
            renderProductFilePreview();
            markAnalysisDirty();
        });
    }

    function mergeThumbnailFiles(nextFiles) {
        const existingKeys = new Set(
            selectedThumbnails.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
        );

        nextFiles.forEach((file) => {
            const key = `${file.name}-${file.size}-${file.lastModified}`;
            if (!existingKeys.has(key) && selectedThumbnails.length < MAX_THUMBNAILS) {
                selectedThumbnails.push(file);
                existingKeys.add(key);
            }
        });
    }

    function getNormalizedDescription() {
        return String(
            window.normalizeProductEditorHtml
                ? window.normalizeProductEditorHtml(descriptionEditor ? descriptionEditor.value : descriptionInput.value)
                : (descriptionEditor ? descriptionEditor.value : descriptionInput.value)
        ).trim();
    }

    function buildBaseFormData() {
        const formData = new FormData();
        formData.append('title', titleInput.value.trim());
        formData.append('price', isFreeInput.checked ? '0' : priceInput.value.trim());
        formData.append('salePrice', isFreeInput.checked ? '0' : salePriceInput.value.trim());
        formData.append('isFree', isFreeInput.checked ? '1' : '0');
        formData.append('usePlace', usePlaceInput.value.trim());
        formData.append('usePurpose', usePurposeInput.value.trim());
        formData.append('description', getNormalizedDescription());
        formData.append('keywords', keywordsInput.value.trim());
        formData.append('excludedPages', excludedPagesInput.value.trim());
        formData.append('representativeThumbnailIndex', String(representativeThumbnailIndex));

        selectedThumbnails.forEach((file) => formData.append('thumbnail', file));

        if (selectedProductFile) {
            formData.append('productFile', selectedProductFile);
        }

        return formData;
    }

    function validateForAnalysis() {
        const title = titleInput.value.trim();

        if (!title) return '상품명을 입력해 주세요.';
        if (!selectedThumbnails.length) return '상품 이미지를 업로드해 주세요.';
        if (!selectedProductFile) return '분석할 PPT 또는 PPTX 파일을 업로드해 주세요.';

        const ext = selectedProductFile.name.split('.').pop()?.toLowerCase();
        if (!['ppt', 'pptx'].includes(ext || '')) {
            return 'AI PPT등록에서는 PPT 또는 PPTX 파일만 업로드할 수 있습니다.';
        }

        return '';
    }

    thumbnailInput.addEventListener('change', () => {
        const incomingFiles = Array.from(thumbnailInput.files || []);

        if (!incomingFiles.length) {
            setError('');
            syncThumbnailInput();
            renderThumbnailPreview();
            return;
        }

        const requestedSize = new Set([
            ...selectedThumbnails.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
            ...incomingFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
        ]).size;

        mergeThumbnailFiles(incomingFiles);
        setError(requestedSize > MAX_THUMBNAILS ? '상품 이미지는 최대 10장까지 업로드할 수 있습니다.' : '');

        thumbnailInput.value = '';
        syncThumbnailInput();
        renderThumbnailPreview();
        markAnalysisDirty();
    });

    productFileInput.addEventListener('change', () => {
        selectedProductFile = productFileInput.files?.[0] || null;
        setError('');
        renderProductFilePreview();
        markAnalysisDirty();
    });

    filterNumericInput(priceInput);
    filterNumericInput(salePriceInput);
    isFreeInput.addEventListener('change', togglePriceInputs);
    togglePriceInputs();

    [
        titleInput,
        usePlaceInput,
        usePurposeInput,
        keywordsInput,
        excludedPagesInput
    ].forEach((input) => {
        input?.addEventListener('input', markAnalysisDirty);
        input?.addEventListener('change', markAnalysisDirty);
    });

    if (descriptionEditor) {
        descriptionEditor.events.on('change', markAnalysisDirty);
    } else {
        descriptionInput?.addEventListener('input', markAnalysisDirty);
    }

    try {
        const meResponse = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });
        const meData = await meResponse.json();

        if (!meData.loggedIn || (meData.role !== 'seller' && meData.role !== 'admin')) {
            alert('셀러 또는 관리자만 접근할 수 있습니다.');
            window.location.href = '/';
            return;
        }
    } catch (error) {
        console.error('권한 확인 실패:', error);
        alert('서버와 통신 중 오류가 발생했습니다.');
        window.location.href = '/';
        return;
    }

    if (!isPptAiAnalysisSupported) {
        if (analyzeButton) {
            analyzeButton.disabled = true;
            analyzeButton.title = '현재 배포 환경에서는 AI PPT 분석을 지원하지 않습니다.';
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.title = 'AI 분석이 지원되는 Windows 환경에서만 등록할 수 있습니다.';
        }

        setError('현재 배포 환경에서는 AI PPT 분석을 지원하지 않습니다. 이 기능은 Windows 서버 또는 로컬 Windows 환경에서만 사용할 수 있습니다.');
    }

    analyzeButton?.addEventListener('click', async () => {
        setError('');

        if (!isPptAiAnalysisSupported) {
            setError('현재 배포 환경에서는 AI PPT 분석을 지원하지 않습니다. 이 기능은 Windows 서버 또는 로컬 Windows 환경에서만 사용할 수 있습니다.');
            return;
        }

        const validationError = validateForAnalysis();
        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            setLoading(true, 'analyze');
            if (analysisResultBox) {
                analysisResultBox.style.display = 'none';
            }

            const response = await fetch('/api/seller/products-ai/analyze', {
                method: 'POST',
                credentials: 'include',
                body: buildBaseFormData()
            });

            const data = await response.json();

            if (!data.success) {
                clearAnalysisResult();
                setError(data.message || 'AI 분석에 실패했습니다.');
                return;
            }

            renderAnalysisResult(data.analysisResult || data);
            alert(data.message || 'AI 분석이 완료되었습니다.');
        } catch (error) {
            console.error('AI 분석 실패:', error);
            clearAnalysisResult();
            setError('서버와 통신 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setError('');

        if (!isPptAiAnalysisSupported) {
            setError('현재 배포 환경에서는 AI PPT 분석을 지원하지 않습니다. 이 기능은 Windows 서버 또는 로컬 Windows 환경에서만 사용할 수 있습니다.');
            return;
        }

        if (!analyzedPayload) {
            setError('먼저 AI 분석을 완료해 주세요.');
            return;
        }

        const validationError = validateForAnalysis();
        if (validationError) {
            setError(validationError);
            return;
        }

        if (!isFreeInput.checked && !priceInput.value.trim()) {
            setError('판매가를 입력해 주세요.');
            return;
        }

        const formData = buildBaseFormData();
        formData.append('analysisPayload', JSON.stringify(analyzedPayload));

        try {
            setLoading(true, 'register');

            const response = await fetch('/api/seller/products-ai', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                setError(data.message || 'AI PPT등록에 실패했습니다.');
                return;
            }

            setLoading(false);
            alert(data.message);
            window.location.href = `/products-page/${data.productId}`;
        } catch (error) {
            console.error('AI PPT등록 실패:', error);
            setError('서버와 통신 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    });
});
