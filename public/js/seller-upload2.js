document.addEventListener('DOMContentLoaded', async () => {
    const MAX_THUMBNAILS = 10;

    const form = document.getElementById('seller-upload2-form');
    const errorText = document.getElementById('seller-upload-error');
    const submitButton = document.getElementById('seller-upload2-submit');
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

    let selectedThumbnails = [];
    let representativeThumbnailIndex = 0;
    let selectedProductFile = null;

    function setError(message = '') {
        errorText.textContent = message;
    }

    function setLoading(isLoading) {
        submitButton.disabled = isLoading;
        submitButton.classList.toggle('is-loading', isLoading);
        submitButton.textContent = isLoading ? 'AI 분석 및 등록 중...' : '상품등록2 + AI 분석';
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

        if (priceInput.value === '0') priceInput.value = '';
        if (salePriceInput.value === '0') salePriceInput.value = '';
    }

    function syncThumbnailInput() {
        const dataTransfer = new DataTransfer();
        selectedThumbnails.forEach((file) => dataTransfer.items.add(file));
        thumbnailInput.files = dataTransfer.files;
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
                if (Number.isNaN(index)) return;

                const removedWasRepresentative = representativeThumbnailIndex === index;
                selectedThumbnails.splice(index, 1);

                if (removedWasRepresentative) representativeThumbnailIndex = 0;
                else if (representativeThumbnailIndex > index) representativeThumbnailIndex -= 1;

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
                <button type="button" class="preview-remove-btn" id="product-file-remove-btn" aria-label="파일 제거">X</button>
            </div>
        `;

        document.getElementById('product-file-remove-btn')?.addEventListener('click', () => {
            selectedProductFile = null;
            productFileInput.value = '';
            setError('');
            renderProductFilePreview();
        });
    }

    function mergeThumbnailFiles(nextFiles) {
        const existingKeys = new Set(selectedThumbnails.map((file) => `${file.name}-${file.size}-${file.lastModified}`));

        nextFiles.forEach((file) => {
            const key = `${file.name}-${file.size}-${file.lastModified}`;
            if (!existingKeys.has(key) && selectedThumbnails.length < MAX_THUMBNAILS) {
                selectedThumbnails.push(file);
                existingKeys.add(key);
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

        const requestedSize = new Set([
            ...selectedThumbnails.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
            ...incomingFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
        ]).size;

        mergeThumbnailFiles(incomingFiles);
        setError(requestedSize > MAX_THUMBNAILS ? '상품 이미지는 최대 10장까지 업로드할 수 있습니다.' : '');

        thumbnailInput.value = '';
        syncThumbnailInput();
        renderThumbnailPreview();
    });

    productFileInput.addEventListener('change', () => {
        selectedProductFile = productFileInput.files?.[0] || null;
        setError('');
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
        const usePlace = usePlaceInput.value.trim();
        const usePurpose = usePurposeInput.value.trim();
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

        if (!usePlace) {
            setError('PPT를 어디에 사용할지 선택해 주세요.');
            return;
        }

        if (!usePurpose) {
            setError('PPT의 목적을 선택해 주세요.');
            return;
        }

        if (!description) {
            setError('상세 설명을 입력해 주세요.');
            return;
        }

        if (!selectedThumbnails.length) {
            setError('상품 이미지를 업로드해 주세요.');
            return;
        }

        if (!selectedProductFile) {
            setError('분석할 PPT 또는 PPTX 파일을 업로드해 주세요.');
            return;
        }

        const ext = selectedProductFile.name.split('.').pop()?.toLowerCase();
        if (!['ppt', 'pptx'].includes(ext || '')) {
            setError('상품등록2에서는 PPT 또는 PPTX 파일만 업로드할 수 있습니다.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', isFree ? '0' : price);
        formData.append('salePrice', isFree ? '0' : salePrice);
        formData.append('isFree', isFree ? '1' : '0');
        formData.append('usePlace', usePlace);
        formData.append('usePurpose', usePurpose);
        formData.append('description', description);
        formData.append('keywords', keywords);
        formData.append('representativeThumbnailIndex', String(representativeThumbnailIndex));

        selectedThumbnails.forEach((file) => formData.append('thumbnail', file));
        formData.append('productFile', selectedProductFile);

        try {
            setLoading(true);

            const response = await fetch('/api/seller/products-ai', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                setError(data.message || '상품등록2에 실패했습니다.');
                return;
            }

            alert(`${data.message}\n분석된 슬라이드 수: ${data.slideCount || 0}`);
            window.location.href = `/products-page/${data.productId}`;
        } catch (error) {
            console.error('상품등록2 실패:', error);
            setError('서버와 통신 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    });
});
