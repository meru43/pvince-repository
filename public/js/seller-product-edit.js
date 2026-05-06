document.addEventListener('DOMContentLoaded', async () => {
    const MAX_THUMBNAILS = 10;
    const MAX_PRODUCT_FILES = 10;
    const closeButtonSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="icon icon-tabler icons-tabler-filled icon-tabler-x" aria-hidden="true" focusable="false">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M6.707 5.293l5.293 5.292l5.293 -5.292a1 1 0 0 1 1.414 1.414l-5.292 5.293l5.292 5.293a1 1 0 0 1 -1.414 1.414l-5.293 -5.292l-5.293 5.292a1 1 0 1 1 -1.414 -1.414l5.292 -5.293l-5.292 -5.293a1 1 0 0 1 1.414 -1.414" />
        </svg>
    `.trim();

    const form = document.getElementById('seller-product-edit-form');
    const errorText = document.getElementById('seller-product-edit-error');
    const submitButton = form.querySelector('button[type="submit"]');
    const loadingOverlay = document.getElementById('page-loading-overlay');
    const loadingTitle = document.getElementById('page-loading-title');
    const loadingText = document.getElementById('page-loading-text');

    const titleInput = document.getElementById('product-title');
    const thumbnailInput = document.getElementById('product-thumbnail');
    const thumbnailPreviewList = document.getElementById('thumbnail-preview-list');
    const priceInput = document.getElementById('product-price');
    const salePriceInput = document.getElementById('product-sale-price');
    const isFreeInput = document.getElementById('product-is-free');
    const descriptionInput = document.getElementById('product-description');
    const keywordsInput = document.getElementById('product-keywords');
    const productFileInput = document.getElementById('product-file');
    const currentProductFile = document.getElementById('current-product-file');
    const newProductFileList = document.getElementById('new-product-file-list');
    const productActiveStatus = document.getElementById('product-active-status');
    const productStopMemo = document.getElementById('product-stop-memo');
    const productStopMemoGroup = document.getElementById('product-stop-memo-group');

    const descriptionEditor = window.createProductJoditEditor
        ? window.createProductJoditEditor(descriptionInput)
        : null;

    const pathParts = window.location.pathname.split('/');
    const productId = pathParts[pathParts.length - 1];

    let isSubmitting = false;
    let thumbnailItems = [];
    let existingProductFiles = [];
    let newProductFiles = [];
    let nextThumbnailToken = 1;

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

        if (loadingTitle) {
            loadingTitle.textContent = '상품 정보를 수정하는 중입니다.';
        }

        if (loadingText) {
            loadingText.textContent = '수정이 끝날 때까지 페이지를 나가지 말아 주세요.';
        }
    }

    window.addEventListener('beforeunload', (event) => {
        if (!isSubmitting) {
            return;
        }

        event.preventDefault();
        event.returnValue = '';
    });

    function togglePriceInputs() {
        const isFree = isFreeInput.checked;
        priceInput.disabled = isFree;
        salePriceInput.disabled = isFree;
    }

    function formatFileSize(size) {
        const kb = Math.max(1, Math.round(Number(size || 0) / 1024));
        return `${kb}KB`;
    }

    function ensureRepresentative() {
        if (!thumbnailItems.length) {
            return;
        }

        if (!thumbnailItems.some((item) => item.isRepresentative)) {
            thumbnailItems[0].isRepresentative = true;
        }
    }

    function markRepresentative(index) {
        thumbnailItems = thumbnailItems.map((item, itemIndex) => ({
            ...item,
            isRepresentative: itemIndex === index
        }));
    }

    function createThumbnailItemFromFile(file) {
        return {
            clientId: `new-${Date.now()}-${nextThumbnailToken += 1}`,
            source: 'new',
            name: file.name,
            file,
            path: '',
            localPath: '',
            previewUrl: URL.createObjectURL(file),
            isRepresentative: thumbnailItems.length === 0
        };
    }

    function renderThumbnailPreview() {
        ensureRepresentative();

        if (!thumbnailItems.length) {
            thumbnailPreviewList.innerHTML = '';
            return;
        }

        thumbnailPreviewList.innerHTML = thumbnailItems.map((item, index) => {
            const previewUrl = item.previewUrl || item.path || '';
            const checked = item.isRepresentative ? 'checked' : '';

            return `
                <div class="thumbnail-preview-card ${checked ? 'is-representative' : ''}">
                    <button type="button" class="preview-remove-btn" data-remove-index="${index}" aria-label="이미지 제거">${closeButtonSvg}</button>
                    <button type="button" class="thumbnail-replace-btn" data-replace-index="${index}">교체</button>
                    <img src="${previewUrl}" alt="${item.name || `상품 이미지 ${index + 1}`}" class="thumbnail-preview-image">
                    <label class="thumbnail-radio-label">
                        <input type="radio" name="representative-thumbnail" value="${index}" ${checked}>
                        <span>대표 이미지</span>
                    </label>
                    <p class="preview-file-name">${item.name || `상품 이미지 ${index + 1}`}</p>
                </div>
            `;
        }).join('');

        thumbnailPreviewList.querySelectorAll('.preview-remove-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number(button.dataset.removeIndex);
                if (Number.isNaN(index)) {
                    return;
                }

                const [removed] = thumbnailItems.splice(index, 1);
                if (removed?.previewUrl?.startsWith('blob:')) {
                    URL.revokeObjectURL(removed.previewUrl);
                }

                ensureRepresentative();
                renderThumbnailPreview();
            });
        });

        thumbnailPreviewList.querySelectorAll('.thumbnail-replace-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number(button.dataset.replaceIndex);
                if (Number.isNaN(index)) {
                    return;
                }

                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';

                input.addEventListener('change', () => {
                    const file = input.files?.[0];
                    if (!file) {
                        return;
                    }

                    const current = thumbnailItems[index];
                    const replacement = createThumbnailItemFromFile(file);
                    replacement.isRepresentative = !!current?.isRepresentative;

                    if (current?.previewUrl?.startsWith('blob:')) {
                        URL.revokeObjectURL(current.previewUrl);
                    }

                    thumbnailItems[index] = replacement;
                    ensureRepresentative();
                    renderThumbnailPreview();
                });

                input.click();
            });
        });

        thumbnailPreviewList.querySelectorAll('input[name="representative-thumbnail"]').forEach((input) => {
            input.addEventListener('change', () => {
                markRepresentative(Number(input.value) || 0);
                renderThumbnailPreview();
            });
        });
    }

    function appendThumbnailFiles(nextFiles) {
        const availableSlots = MAX_THUMBNAILS - thumbnailItems.length;

        if (availableSlots <= 0) {
            setError('상품 이미지는 최대 10장까지 유지할 수 있습니다.');
            return;
        }

        const filesToAdd = nextFiles.slice(0, availableSlots);
        filesToAdd.forEach((file) => {
            thumbnailItems.push(createThumbnailItemFromFile(file));
        });

        if (nextFiles.length > filesToAdd.length) {
            setError('상품 이미지는 최대 10장까지 유지할 수 있습니다.');
        } else {
            setError('');
        }

        ensureRepresentative();
        renderThumbnailPreview();
    }

    function buildThumbnailPayload() {
        return thumbnailItems.map((item, index) => ({
            clientId: item.clientId,
            source: item.source,
            path: item.source === 'existing' ? item.path : '',
            localPath: item.source === 'existing' ? (item.localPath || '') : '',
            name: item.name || '',
            isRepresentative: !!item.isRepresentative,
            order: index
        }));
    }

    function getProductFileKey(file) {
        if (file.source === 'existing') {
            return `existing:${file.path}`;
        }

        return `new:${file.name}-${file.size}-${file.lastModified}`;
    }

    function renderExistingProductFiles() {
        if (!existingProductFiles.length) {
            currentProductFile.innerHTML = '<p class="empty-file-message">등록된 판매파일이 없습니다.</p>';
            return;
        }

        currentProductFile.innerHTML = existingProductFiles.map((file, index) => `
            <div class="product-file-preview-item">
                <div class="product-file-preview-meta">
                    <strong class="product-file-preview-name">${file.name}</strong>
                    <span class="product-file-preview-size">기존 파일</span>
                </div>
                <div class="product-file-preview-actions">
                    <a href="${file.path}" target="_blank" rel="noopener noreferrer" class="product-file-link">보기</a>
                    <button type="button" class="preview-remove-btn" data-existing-file-index="${index}" aria-label="파일 제거">${closeButtonSvg}</button>
                </div>
            </div>
        `).join('');

        currentProductFile.querySelectorAll('[data-existing-file-index]').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number(button.dataset.existingFileIndex);
                if (Number.isNaN(index)) {
                    return;
                }

                existingProductFiles.splice(index, 1);
                setError('');
                renderExistingProductFiles();
            });
        });
    }

    function renderNewProductFiles() {
        if (!newProductFiles.length) {
            newProductFileList.innerHTML = '';
            return;
        }

        newProductFileList.innerHTML = newProductFiles.map((file, index) => `
            <div class="product-file-preview-item">
                <div class="product-file-preview-meta">
                    <strong class="product-file-preview-name">${file.name}</strong>
                    <span class="product-file-preview-size">${formatFileSize(file.size)}</span>
                </div>
                <button type="button" class="preview-remove-btn" data-new-file-index="${index}" aria-label="파일 제거">${closeButtonSvg}</button>
            </div>
        `).join('');

        newProductFileList.querySelectorAll('[data-new-file-index]').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number(button.dataset.newFileIndex);
                if (Number.isNaN(index)) {
                    return;
                }

                newProductFiles.splice(index, 1);
                setError('');
                renderNewProductFiles();
            });
        });
    }

    function mergeProductFiles(nextFiles) {
        const totalCount = existingProductFiles.length + newProductFiles.length;
        const availableSlots = MAX_PRODUCT_FILES - totalCount;

        if (availableSlots <= 0) {
            setError('상품 파일은 최대 10개까지 유지할 수 있습니다.');
            return;
        }

        const knownKeys = new Set([
            ...existingProductFiles.map(getProductFileKey),
            ...newProductFiles.map(getProductFileKey)
        ]);

        const acceptedFiles = [];
        nextFiles.forEach((file) => {
            const key = getProductFileKey(file);
            if (!knownKeys.has(key) && acceptedFiles.length < availableSlots) {
                acceptedFiles.push(file);
                knownKeys.add(key);
            }
        });

        newProductFiles.push(...acceptedFiles);

        if (acceptedFiles.length < nextFiles.length) {
            setError('상품 파일은 최대 10개까지 유지할 수 있습니다.');
        } else {
            setError('');
        }

        renderNewProductFiles();
    }

    isFreeInput.addEventListener('change', togglePriceInputs);

    thumbnailInput.addEventListener('change', () => {
        const files = Array.from(thumbnailInput.files || []);
        if (!files.length) {
            return;
        }

        appendThumbnailFiles(files);
        thumbnailInput.value = '';
    });

    productFileInput.addEventListener('change', () => {
        const files = Array.from(productFileInput.files || []);
        if (!files.length) {
            return;
        }

        mergeProductFiles(files);
        productFileInput.value = '';
    });

    try {
        const response = await fetch(`/api/seller/products/${productId}`, {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.success) {
            setError(data.message || '상품 정보를 불러오지 못했습니다.');
            form.style.display = 'none';
            return;
        }

        const product = data.product;

        if (productActiveStatus) {
            productActiveStatus.textContent = Number(product.is_active) === 1 ? '판매중' : '판매중지';
        }

        if (productStopMemoGroup && productStopMemo) {
            if (Number(product.is_active) === 0) {
                productStopMemoGroup.style.display = 'block';
                productStopMemo.textContent = product.stop_memo && String(product.stop_memo).trim() !== ''
                    ? product.stop_memo
                    : '등록된 메모가 없습니다.';
            } else {
                productStopMemoGroup.style.display = 'none';
            }
        }

        titleInput.value = product.title || '';
        priceInput.value = product.price ?? '';
        salePriceInput.value = product.sale_price ?? '';
        isFreeInput.checked = Number(product.is_free) === 1;

        if (descriptionEditor) {
            descriptionEditor.value = product.description || '';
        } else {
            descriptionInput.value = product.description || '';
        }

        keywordsInput.value = product.keywords || '';

        try {
            const parsedGallery = JSON.parse(product.thumbnail_gallery_json || '[]');
            if (Array.isArray(parsedGallery) && parsedGallery.length) {
                thumbnailItems = parsedGallery.map((item, index) => ({
                    clientId: `existing-${index + 1}`,
                    source: 'existing',
                    name: item.name || `상품 이미지 ${index + 1}`,
                    file: null,
                    path: item.path || '',
                    localPath: item.localPath || '',
                    previewUrl: item.path || '',
                    isRepresentative: !!item.isRepresentative
                }));
            }
        } catch (error) {
            thumbnailItems = [];
        }

        if (!thumbnailItems.length && product.thumbnail_path) {
            thumbnailItems = [{
                clientId: 'existing-1',
                source: 'existing',
                name: product.title || '대표 이미지',
                file: null,
                path: product.thumbnail_path,
                localPath: '',
                previewUrl: product.thumbnail_path,
                isRepresentative: true
            }];
        }

        renderThumbnailPreview();

        try {
            const parsedProductFiles = JSON.parse(product.product_files_json || '[]');
            if (Array.isArray(parsedProductFiles) && parsedProductFiles.length) {
                existingProductFiles = parsedProductFiles
                    .map((file) => ({
                        source: 'existing',
                        name: String(file?.name || '').trim(),
                        path: String(file?.path || '').trim()
                    }))
                    .filter((file) => file.name && file.path);
            }
        } catch (error) {
            existingProductFiles = [];
        }

        if (!existingProductFiles.length && product.file_name && product.file_path) {
            existingProductFiles = [{
                source: 'existing',
                name: product.file_name,
                path: product.file_path
            }];
        }

        renderExistingProductFiles();
        renderNewProductFiles();
        togglePriceInputs();
    } catch (error) {
        console.error('상품 수정 정보 조회 실패:', error);
        setError('서버와 통신 중 오류가 발생했습니다.');
        form.style.display = 'none';
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

        if (!thumbnailItems.length) {
            setError('상품 이미지를 최소 1장 유지해 주세요.');
            return;
        }

        if (!existingProductFiles.length && !newProductFiles.length) {
            setError('판매 파일을 최소 1개 유지해 주세요.');
            return;
        }

        if ((existingProductFiles.length + newProductFiles.length) > MAX_PRODUCT_FILES) {
            setError('상품 파일은 최대 10개까지 유지할 수 있습니다.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', isFree ? '0' : price);
        formData.append('salePrice', isFree ? '0' : salePrice);
        formData.append('isFree', isFree ? '1' : '0');
        formData.append('description', description);
        formData.append('keywords', keywords);
        formData.append('thumbnailGalleryState', JSON.stringify(buildThumbnailPayload()));
        formData.append('productFileState', JSON.stringify(existingProductFiles.map((file) => ({
            name: file.name,
            path: file.path
        }))));

        thumbnailItems
            .filter((item) => item.source === 'new' && item.file)
            .forEach((item) => {
                formData.append('thumbnail', item.file);
                formData.append('thumbnailClientId', item.clientId);
            });

        newProductFiles.forEach((file) => {
            formData.append('productFile', file);
        });

        try {
            setLoading(true);

            const response = await fetch(`/api/seller/products/${productId}`, {
                method: 'PATCH',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                window.location.href = '/seller-products-page';
            } else {
                setError(data.message || '상품 수정에 실패했습니다.');
            }
        } catch (error) {
            console.error('상품 수정 실패:', error);
            setError('서버와 통신 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    });
});
