document.addEventListener('DOMContentLoaded', async () => {
    const MAX_THUMBNAILS = 10;
    const MAX_PRODUCT_FILES = 10;
    const closeButtonSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="icon icon-tabler icons-tabler-filled icon-tabler-x" aria-hidden="true" focusable="false">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M6.707 5.293l5.293 5.292l5.293 -5.292a1 1 0 0 1 1.414 1.414l-5.292 5.293l5.292 5.293a1 1 0 0 1 -1.414 1.414l-5.293 -5.292l-5.293 5.292a1 1 0 1 1 -1.414 -1.414l5.292 -5.293l-5.292 -5.293a1 1 0 0 1 1.414 -1.414" />
        </svg>
    `.trim();

    const form = document.getElementById('seller-upload2-form');
    const errorText = document.getElementById('seller-upload-error');
    const submitButton = document.getElementById('seller-upload2-submit');
    const loadingOverlay = document.getElementById('page-loading-overlay');
    const loadingTitle = document.getElementById('page-loading-title');
    const loadingText = document.getElementById('page-loading-text');

    const titleInput = document.getElementById('product-title');
    const thumbnailInput = document.getElementById('product-thumbnail');
    const thumbnailPreviewList = document.getElementById('thumbnail-preview-list');
    const priceInput = document.getElementById('product-price');
    const salePriceInput = document.getElementById('product-sale-price');
    const isFreeInput = document.getElementById('product-is-free');
    const usePlaceInput = document.getElementById('product-use-place');
    const usePurposeInput = document.getElementById('product-use-purpose');
    const descriptionInput = document.getElementById('product-description');
    const aiSummaryInput = document.getElementById('product-ai-summary');
    const keywordsInput = document.getElementById('product-keywords');
    const productFileInput = document.getElementById('product-file');
    const productFilePreviewList = document.getElementById('product-file-preview-list');

    let selectedThumbnails = [];
    let selectedProductFiles = [];
    let representativeThumbnailIndex = 0;
    let isSubmitting = false;

    const descriptionEditor = window.createProductJoditEditor
        ? window.createProductJoditEditor(descriptionInput)
        : null;

    function setError(message = '') {
        errorText.textContent = message;
    }

    function setLoading(isLoading) {
        isSubmitting = isLoading;

        if (submitButton) {
            submitButton.disabled = isLoading;
            submitButton.classList.toggle('is-loading', isLoading);
            submitButton.textContent = isLoading ? '상품 등록 중...' : '상품 등록하기';
        }

        if (loadingOverlay) {
            loadingOverlay.classList.toggle('is-active', isLoading);
            loadingOverlay.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
        }

        if (loadingTitle) {
            loadingTitle.textContent = '상품을 등록하는 중입니다.';
        }

        if (loadingText) {
            loadingText.textContent = '등록이 끝날 때까지 페이지를 닫지 말아주세요.';
        }
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

    function syncProductFileInput() {
        const dataTransfer = new DataTransfer();
        selectedProductFiles.forEach((file) => dataTransfer.items.add(file));
        productFileInput.files = dataTransfer.files;
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
            });
        });

        thumbnailPreviewList.querySelectorAll('input[name="representative-thumbnail"]').forEach((input) => {
            input.addEventListener('change', () => {
                representativeThumbnailIndex = Number(input.value) || 0;
                renderThumbnailPreview();
            });
        });
    }

    function renderProductFilePreview() {
        if (!selectedProductFiles.length) {
            productFilePreviewList.innerHTML = '';
            return;
        }

        productFilePreviewList.innerHTML = selectedProductFiles.map((file, index) => `
            <div class="product-file-preview-item">
                <div class="product-file-preview-meta">
                    <strong class="product-file-preview-name">${file.name}</strong>
                    <span class="product-file-preview-size">${Math.max(1, Math.round(file.size / 1024))}KB</span>
                </div>
                <button type="button" class="preview-remove-btn" data-index="${index}" aria-label="파일 제거">${closeButtonSvg}</button>
            </div>
        `).join('');

        productFilePreviewList.querySelectorAll('.preview-remove-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number(button.dataset.index);
                if (Number.isNaN(index)) {
                    return;
                }

                selectedProductFiles.splice(index, 1);
                setError('');
                syncProductFileInput();
                renderProductFilePreview();
            });
        });
    }

    function mergeFiles(existingFiles, nextFiles, maxCount) {
        const existingKeys = new Set(existingFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`));

        nextFiles.forEach((file) => {
            const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
            if (!existingKeys.has(fileKey) && existingFiles.length < maxCount) {
                existingFiles.push(file);
                existingKeys.add(fileKey);
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

    function hasPptProductFile() {
        return selectedProductFiles.some((file) => {
            const ext = file.name.split('.').pop()?.toLowerCase();
            return ext === 'ppt' || ext === 'pptx';
        });
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
        formData.append('aiSummaryText', String(aiSummaryInput?.value || '').trim());
        formData.append('keywords', keywordsInput.value.trim());
        formData.append('representativeThumbnailIndex', String(representativeThumbnailIndex));

        selectedThumbnails.forEach((file) => formData.append('thumbnail', file));
        selectedProductFiles.forEach((file) => formData.append('productFile', file));

        return formData;
    }

    function validateForSubmit() {
        const title = titleInput.value.trim();
        const aiSummaryText = String(aiSummaryInput?.value || '').trim();

        if (!title) return '상품명을 입력해 주세요.';
        if (!selectedThumbnails.length) return '상품 이미지를 업로드해 주세요.';
        if (!selectedProductFiles.length) return '상품 파일을 업로드해 주세요.';
        if (selectedProductFiles.length > MAX_PRODUCT_FILES) return '상품 파일은 최대 10개까지 업로드할 수 있습니다.';
        if (!hasPptProductFile()) return '업로드한 파일 중 최소 1개는 PPT 또는 PPTX 파일이어야 합니다.';
        if (!aiSummaryText) return 'AI 분석결과를 입력해 주세요.';

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

        mergeFiles(selectedThumbnails, incomingFiles, MAX_THUMBNAILS);
        setError(requestedSize > MAX_THUMBNAILS ? '상품 이미지는 최대 10장까지 업로드할 수 있습니다.' : '');

        thumbnailInput.value = '';
        syncThumbnailInput();
        renderThumbnailPreview();
    });

    productFileInput.addEventListener('change', () => {
        const incomingFiles = Array.from(productFileInput.files || []);

        if (!incomingFiles.length) {
            setError('');
            syncProductFileInput();
            renderProductFilePreview();
            return;
        }

        const requestedSize = new Set([
            ...selectedProductFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
            ...incomingFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
        ]).size;

        mergeFiles(selectedProductFiles, incomingFiles, MAX_PRODUCT_FILES);
        setError(requestedSize > MAX_PRODUCT_FILES ? '상품 파일은 최대 10개까지 업로드할 수 있습니다.' : '');

        productFileInput.value = '';
        syncProductFileInput();
        renderProductFilePreview();
    });

    filterNumericInput(priceInput);
    filterNumericInput(salePriceInput);
    isFreeInput.addEventListener('change', togglePriceInputs);
    togglePriceInputs();

    try {
        const meResponse = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });
        const meData = await meResponse.json();

        if (!meData.loggedIn || (meData.role !== 'seller' && meData.role !== 'admin')) {
            alert('판매자 또는 관리자만 접근할 수 있습니다.');
            window.location.href = '/';
            return;
        }
    } catch (error) {
        console.error('권한 확인 실패:', error);
        alert('서버와 통신 중 오류가 발생했습니다.');
        window.location.href = '/';
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setError('');

        const validationError = validateForSubmit();
        if (validationError) {
            setError(validationError);
            return;
        }

        if (!isFreeInput.checked && !priceInput.value.trim()) {
            setError('판매가를 입력해 주세요.');
            return;
        }

        const formData = buildBaseFormData();

        try {
            setLoading(true);

            const response = await fetch('/api/seller/products-ai', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                setError(data.message || 'AI PPT 등록에 실패했습니다.');
                return;
            }

            setLoading(false);
            alert(data.message);
            window.location.href = `/products-page/${data.productId}`;
        } catch (error) {
            console.error('AI PPT 등록 실패:', error);
            setError('서버와 통신 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    });
});
