document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('seller-product-edit-form');
    const errorText = document.getElementById('seller-product-edit-error');

    const titleInput = document.getElementById('product-title');
    const thumbnailInput = document.getElementById('product-thumbnail');
    const priceInput = document.getElementById('product-price');
    const salePriceInput = document.getElementById('product-sale-price');
    const isFreeInput = document.getElementById('product-is-free');
    const descriptionInput = document.getElementById('product-description');
    const keywordsInput = document.getElementById('product-keywords');
    const productFileInput = document.getElementById('product-file');

    const currentThumbnailPreview = document.getElementById('current-thumbnail-preview');
    const currentProductFile = document.getElementById('current-product-file');

    const pathParts = window.location.pathname.split('/');
    const productId = pathParts[pathParts.length - 1];

    const productActiveStatus = document.getElementById('product-active-status');
    const productStopMemo = document.getElementById('product-stop-memo');
    const productStopMemoGroup = document.getElementById('product-stop-memo-group');

    function togglePriceInputs() {
        const isFree = isFreeInput.checked;

        if (isFree) {
            priceInput.disabled = true;
            salePriceInput.disabled = true;
        } else {
            priceInput.disabled = false;
            salePriceInput.disabled = false;
        }
    }

    isFreeInput.addEventListener('change', togglePriceInputs);

    try {
        const response = await fetch(`/api/seller/products/${productId}`, {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.success) {
            errorText.textContent = data.message || '상품 정보를 불러오지 못했습니다.';
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
        descriptionInput.value = product.description || '';
        keywordsInput.value = product.keywords || '';

        if (product.thumbnail_path) {
            currentThumbnailPreview.innerHTML = `
                <img src="${product.thumbnail_path}" alt="${product.title}" style="max-width: 240px; border-radius: 12px;" />
            `;
        } else {
            currentThumbnailPreview.innerHTML = `<p>등록된 썸네일이 없습니다.</p>`;
        }

        if (product.file_name) {
            currentProductFile.innerHTML = `<p>${product.file_name}</p>`;
        } else {
            currentProductFile.innerHTML = `<p>등록된 판매파일이 없습니다.</p>`;
        }

        togglePriceInputs();
    } catch (error) {
        console.error('상품 수정용 정보 조회 실패:', error);
        errorText.textContent = '서버와 통신 중 오류가 발생했습니다.';
        form.style.display = 'none';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorText.textContent = '';

        const title = titleInput.value.trim();
        const price = priceInput.value.trim();
        const salePrice = salePriceInput.value.trim();
        const isFree = isFreeInput.checked;
        const description = descriptionInput.value.trim();
        const keywords = keywordsInput.value.trim();

        if (!title) {
            errorText.textContent = '상품명을 입력해주세요.';
            return;
        }

        if (!isFree && !price) {
            errorText.textContent = '판매가를 입력해주세요.';
            return;
        }

        if (!description) {
            errorText.textContent = '상품 설명을 입력해주세요.';
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', isFree ? '0' : price);
        formData.append('salePrice', isFree ? '0' : salePrice);
        formData.append('isFree', isFree ? '1' : '0');
        formData.append('description', description);
        formData.append('keywords', keywords);

        if (thumbnailInput.files[0]) {
            formData.append('thumbnail', thumbnailInput.files[0]);
        }

        if (productFileInput.files[0]) {
            formData.append('productFile', productFileInput.files[0]);
        }

        try {
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
                errorText.textContent = data.message || '상품 수정에 실패했습니다.';
            }
        } catch (error) {
            console.error('상품 수정 실패:', error);
            errorText.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });
});