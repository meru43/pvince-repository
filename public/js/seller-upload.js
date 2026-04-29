document.addEventListener('DOMContentLoaded', async () => {
    const MAX_PRODUCT_FILES = 5;
    const MAX_THUMBNAILS = 10;

    const form = document.getElementById('seller-upload-form');
    const errorText = document.getElementById('seller-upload-error');
    const submitButton = form.querySelector('button[type="submit"]');
    const loadingOverlay = document.getElementById('page-loading-overlay');
    const titleInput = document.getElementById('product-title');
    const thumbnailInput = document.getElementById('product-thumbnail');
    const thumbnailPreviewList = document.getElementById('thumbnail-preview-list');
    const priceInput = document.getElementById('product-price');
    const salePriceInput = document.getElementById('product-sale-price');
    const isFreeInput = document.getElementById('product-is-free');
    const descriptionInput = document.getElementById('product-description');
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
        }

        if (loadingOverlay) {
            loadingOverlay.classList.toggle('is-active', isLoading);
            loadingOverlay.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
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
                    <button type="button" class="preview-remove-btn" data-remove-index="${index}" aria-label="이미지 제거">X</button>
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
                <button type="button" class="preview-remove-btn" data-index="${index}" aria-label="파일 제거">X</button>
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

    thumbnailInput.addEventListener('change', () => {
        const incomingFiles = Array.from(thumbnailInput.files || []);
        if (!incomingFiles.length) {
            setError('');
            syncThumbnailInput();
            renderThumbnailPreview();
            return;
        }

        mergeFiles(selectedThumbnails, incomingFiles, MAX_THUMBNAILS);
        const totalRequested = new Set([
            ...selectedThumbnails,
            ...incomingFiles
        ].map((file) => `${file.name}-${file.size}-${file.lastModified}`)).size;

        setError(totalRequested > MAX_THUMBNAILS ? '상품 이미지는 최대 10장까지 업로드할 수 있습니다.' : '');

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

        mergeFiles(selectedProductFiles, incomingFiles, MAX_PRODUCT_FILES);
        const totalRequested = new Set([
            ...selectedProductFiles,
            ...incomingFiles
        ].map((file) => `${file.name}-${file.size}-${file.lastModified}`)).size;

        setError(totalRequested > MAX_PRODUCT_FILES ? '판매상품 파일은 최대 5개까지 업로드할 수 있습니다.' : '');

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

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setError('');

        const title = titleInput.value.trim();
        const price = priceInput.value.trim();
        const salePrice = salePriceInput.value.trim();
        const isFree = isFreeInput.checked;
        const description = String(
            window.normalizeProductEditorHtml
                ? window.normalizeProductEditorHtml(descriptionEditor ? descriptionEditor.value : descriptionInput.value)
                : (descriptionEditor ? descriptionEditor.value : descriptionInput.value)
        ).trim();
        const keywords = keywordsInput.value.trim();

        if (!title) {
            setError('상품명을 입력해 주세요.');
            return;
        }

        if (!isFree && !price) {
            setError('판매가를 입력해 주세요.');
            return;
        }

        if (!description) {
            setError('상품 설명을 입력해 주세요.');
            return;
        }

        if (!selectedThumbnails.length) {
            setError('상품 이미지를 업로드해 주세요.');
            return;
        }

        if (!selectedProductFiles.length) {
            setError('판매상품 파일을 업로드해 주세요.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', isFree ? '0' : price);
        formData.append('salePrice', isFree ? '0' : salePrice);
        formData.append('isFree', isFree ? '1' : '0');
        formData.append('description', description);
        formData.append('keywords', keywords);
        formData.append('representativeThumbnailIndex', String(representativeThumbnailIndex));

        selectedThumbnails.forEach((file) => formData.append('thumbnail', file));
        selectedProductFiles.forEach((file) => formData.append('productFile', file));

        try {
            setLoading(true);

            const response = await fetch('/api/seller/products', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                setError(data.message || '상품 등록에 실패했습니다.');
                return;
            }

            setLoading(false);
            alert(data.message);
            window.location.href = `/products-page/${data.productId}`;
        } catch (error) {
            console.error('상품 등록 실패:', error);
            setError('서버와 통신 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    });
});
