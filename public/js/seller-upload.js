document.addEventListener('DOMContentLoaded', async () => {
    const MAX_PRODUCT_FILES = 5;

    const form = document.getElementById('seller-upload-form');
    const errorText = document.getElementById('seller-upload-error');

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

    let selectedThumbnail = null;
    let selectedThumbnailPreviewUrl = '';
    let selectedProductFiles = [];

    function setError(message = '') {
        errorText.textContent = message;
    }

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

    function revokeThumbnailPreviewUrl() {
        if (selectedThumbnailPreviewUrl) {
            URL.revokeObjectURL(selectedThumbnailPreviewUrl);
            selectedThumbnailPreviewUrl = '';
        }
    }

    function renderThumbnailPreview() {
        revokeThumbnailPreviewUrl();

        if (!selectedThumbnail) {
            thumbnailPreviewList.innerHTML = '';
            return;
        }

        selectedThumbnailPreviewUrl = URL.createObjectURL(selectedThumbnail);

        thumbnailPreviewList.innerHTML = `
            <div class="thumbnail-preview-card">
                <button type="button" class="preview-remove-btn" id="thumbnail-remove-btn" aria-label="썸네일 삭제">X</button>
                <img src="${selectedThumbnailPreviewUrl}" alt="${selectedThumbnail.name}" class="thumbnail-preview-image">
                <p class="preview-file-name">${selectedThumbnail.name}</p>
            </div>
        `;

        const removeButton = document.getElementById('thumbnail-remove-btn');

        if (removeButton) {
            removeButton.addEventListener('click', () => {
                selectedThumbnail = null;
                thumbnailInput.value = '';
                setError('');
                renderThumbnailPreview();
            });
        }
    }

    function syncProductFileInput() {
        const dataTransfer = new DataTransfer();

        selectedProductFiles.forEach((file) => {
            dataTransfer.items.add(file);
        });

        productFileInput.files = dataTransfer.files;
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
                <button type="button" class="preview-remove-btn" data-index="${index}" aria-label="파일 삭제">X</button>
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

    function mergeProductFiles(nextFiles) {
        const existingKeys = new Set(
            selectedProductFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
        );

        nextFiles.forEach((file) => {
            const fileKey = `${file.name}-${file.size}-${file.lastModified}`;

            if (!existingKeys.has(fileKey) && selectedProductFiles.length < MAX_PRODUCT_FILES) {
                selectedProductFiles.push(file);
                existingKeys.add(fileKey);
            }
        });
    }

    thumbnailInput.addEventListener('change', () => {
        selectedThumbnail = thumbnailInput.files?.[0] || null;
        setError('');
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

        mergeProductFiles(incomingFiles);

        if (selectedProductFiles.length >= MAX_PRODUCT_FILES && incomingFiles.length > 0) {
            const mergedCount = new Set(
                [...selectedProductFiles, ...incomingFiles].map((file) => `${file.name}-${file.size}-${file.lastModified}`)
            ).size;

            if (mergedCount > MAX_PRODUCT_FILES) {
                setError('판매상품 파일은 최대 5개까지 업로드할 수 있습니다.');
            } else {
                setError('');
            }
        } else {
            setError('');
        }

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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setError('');

        const title = titleInput.value.trim();
        const price = priceInput.value.trim();
        const salePrice = salePriceInput.value.trim();
        const isFree = isFreeInput.checked;
        const description = descriptionInput.value.trim();
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

        if (!selectedThumbnail) {
            setError('상품 썸네일을 업로드해 주세요.');
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
        formData.append('thumbnail', selectedThumbnail);

        selectedProductFiles.forEach((file) => {
            formData.append('productFile', file);
        });

        try {
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

            alert(data.message);
            window.location.href = `/products-page/${data.productId}`;
        } catch (error) {
            console.error('상품 등록 실패:', error);
            setError('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    window.addEventListener('beforeunload', revokeThumbnailPreviewUrl);
});
