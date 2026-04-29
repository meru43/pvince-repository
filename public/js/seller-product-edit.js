document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('seller-product-edit-form');
    const errorText = document.getElementById('seller-product-edit-error');
    const submitButton = form.querySelector('button[type="submit"]');
    const loadingOverlay = document.getElementById('page-loading-overlay');
    const loadingTitle = document.getElementById('page-loading-title');
    const loadingText = document.getElementById('page-loading-text');

    const titleInput = document.getElementById('product-title');
    const thumbnailInput = document.getElementById('product-thumbnail');
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

    const currentThumbnailPreview = document.getElementById('current-thumbnail-preview');
    const currentProductFile = document.getElementById('current-product-file');
    const productActiveStatus = document.getElementById('product-active-status');
    const productStopMemo = document.getElementById('product-stop-memo');
    const productStopMemoGroup = document.getElementById('product-stop-memo-group');

    let isSubmitting = false;
    let aiPptProduct = false;

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

    isFreeInput.addEventListener('change', togglePriceInputs);
    reanalyzeInput?.addEventListener('change', syncReanalyzeUi);

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

        syncReanalyzeUi();

        if (product.thumbnail_path) {
            currentThumbnailPreview.innerHTML = `<img src="${product.thumbnail_path}" alt="${product.title}" style="max-width: 240px;" />`;
        } else {
            currentThumbnailPreview.innerHTML = '<p>등록된 썸네일이 없습니다.</p>';
        }

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

        if (aiPptProduct && !shouldReanalyze && (thumbnailInput.files[0] || productFileInput.files[0])) {
            setError('PPT 파일이나 대표 이미지를 변경한 경우 AI 분석 다시 실행을 체크해 주세요.');
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

        if (thumbnailInput.files[0]) {
            formData.append('thumbnail', thumbnailInput.files[0]);
        }

        if (productFileInput.files[0]) {
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
