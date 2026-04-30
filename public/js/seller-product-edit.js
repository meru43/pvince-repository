document.addEventListener('DOMContentLoaded', async () => {
    const MAX_THUMBNAILS = 10;

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
    const reanalyzeGroup = document.getElementById('product-reanalyze-group');
    const reanalyzeInput = document.getElementById('product-ai-reanalyze');
    const excludedPagesGroup = document.getElementById('product-excluded-pages-group');
    const excludedPagesInput = document.getElementById('product-excluded-pages');

    const currentProductFile = document.getElementById('current-product-file');
    const productActiveStatus = document.getElementById('product-active-status');
    const productStopMemo = document.getElementById('product-stop-memo');
    const productStopMemoGroup = document.getElementById('product-stop-memo-group');

    let isSubmitting = false;
    let aiPptProduct = false;
    let thumbnailItems = [];
    let nextThumbnailToken = 1;

    const descriptionEditor = window.createProductJoditEditor
        ? window.createProductJoditEditor(descriptionInput)
        : null;

    const pathParts = window.location.pathname.split('/');
    const productId = pathParts[pathParts.length - 1];

    function setError(message = '') {
        errorText.textContent = message;
    }

    function setLoading(isLoading, phase = 'edit') {
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
            loadingTitle.textContent = phase === 'reanalyze'
                ? 'PPT를 다시 분석하는 중입니다.'
                : '상품 정보를 수정하는 중입니다.';
        }

        if (loadingText) {
            loadingText.textContent = phase === 'reanalyze'
                ? '재분석과 수정이 끝날 때까지 페이지를 나가지 말아주세요.'
                : '수정이 끝날 때까지 페이지를 나가지 말아주세요.';
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

    function isAiPptProduct(product) {
        const filePath = String(product?.file_path || '').toLowerCase();
        const fileName = String(product?.file_name || '').toLowerCase();
        return filePath.endsWith('.ppt')
            || filePath.endsWith('.pptx')
            || fileName.endsWith('.ppt')
            || fileName.endsWith('.pptx')
            || !!product?.ai_summary_text
            || !!product?.ai_slide_analysis_json;
    }

    function syncReanalyzeUi() {
        const shouldShowExcludedPages = aiPptProduct && !!reanalyzeInput?.checked;
        if (excludedPagesGroup) {
            excludedPagesGroup.style.display = shouldShowExcludedPages ? 'block' : 'none';
        }
    }

    function markRepresentative(index) {
        thumbnailItems = thumbnailItems.map((item, itemIndex) => ({
            ...item,
            isRepresentative: itemIndex === index
        }));
    }

    function ensureRepresentative() {
        if (!thumbnailItems.length) {
            return;
        }

        if (!thumbnailItems.some((item) => item.isRepresentative)) {
            thumbnailItems[0].isRepresentative = true;
        }
    }

    function createThumbnailItemFromFile(file) {
        return {
            clientId: `new-${Date.now()}-${nextThumbnailToken += 1}`,
            source: 'new',
            name: file.name,
            file,
            path: '',
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
                    <button type="button" class="preview-remove-btn" data-remove-index="${index}" aria-label="이미지 제거">X</button>
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
        const skipped = nextFiles.length - filesToAdd.length;

        filesToAdd.forEach((file) => {
            thumbnailItems.push(createThumbnailItemFromFile(file));
        });

        if (skipped > 0) {
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

    isFreeInput.addEventListener('change', togglePriceInputs);
    reanalyzeInput?.addEventListener('change', syncReanalyzeUi);

    thumbnailInput.addEventListener('change', () => {
        const files = Array.from(thumbnailInput.files || []);
        if (!files.length) {
            return;
        }

        appendThumbnailFiles(files);
        thumbnailInput.value = '';
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
        aiPptProduct = isAiPptProduct(product);

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

        if (reanalyzeGroup) {
            reanalyzeGroup.style.display = aiPptProduct ? 'block' : 'none';
        }

        if (excludedPagesInput) {
            try {
                const parsedExcludedPages = JSON.parse(product.ai_excluded_pages_json || '[]');
                excludedPagesInput.value = Array.isArray(parsedExcludedPages)
                    ? parsedExcludedPages.join(', ')
                    : '';
            } catch (error) {
                excludedPagesInput.value = '';
            }
        }

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
        syncReanalyzeUi();

        if (product.file_name) {
            currentProductFile.innerHTML = `<p>${product.file_name}</p>`;
        } else {
            currentProductFile.innerHTML = '<p>등록된 판매파일이 없습니다.</p>';
        }

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
        const shouldReanalyze = aiPptProduct && !!reanalyzeInput?.checked;
        const excludedPages = shouldReanalyze && excludedPagesInput ? excludedPagesInput.value.trim() : '';
        const hasNewProductFile = !!productFileInput.files[0];

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

        if (aiPptProduct && !shouldReanalyze && hasNewProductFile) {
            setError('PPT 파일을 변경한 경우 AI 분석 다시 실행을 체크해 주세요.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', isFree ? '0' : price);
        formData.append('salePrice', isFree ? '0' : salePrice);
        formData.append('isFree', isFree ? '1' : '0');
        formData.append('description', description);
        formData.append('keywords', keywords);
        formData.append('excludedPages', excludedPages);
        formData.append('aiReanalyze', shouldReanalyze ? '1' : '0');
        formData.append('thumbnailGalleryState', JSON.stringify(buildThumbnailPayload()));

        thumbnailItems
            .filter((item) => item.source === 'new' && item.file)
            .forEach((item) => {
                formData.append('thumbnail', item.file);
                formData.append('thumbnailClientId', item.clientId);
            });

        if (hasNewProductFile) {
            formData.append('productFile', productFileInput.files[0]);
        }

        try {
            setLoading(true, shouldReanalyze ? 'reanalyze' : 'edit');

            const response = await fetch(`/api/seller/products/${productId}`, {
                method: 'PATCH',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setLoading(false, 'edit');
                alert(data.message);
                window.location.href = '/seller-products-page';
            } else {
                setError(data.message || '상품 수정에 실패했습니다.');
            }
        } catch (error) {
            console.error('상품 수정 실패:', error);
            setError('서버와 통신 중 오류가 발생했습니다.');
        } finally {
            setLoading(false, 'edit');
        }
    });
});
