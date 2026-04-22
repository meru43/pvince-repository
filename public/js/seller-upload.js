document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('seller-upload-form');
    const errorText = document.getElementById('seller-upload-error');

    const titleInput = document.getElementById('product-title');
    const thumbnailInput = document.getElementById('product-thumbnail');
    const priceInput = document.getElementById('product-price');
    const salePriceInput = document.getElementById('product-sale-price');
    const isFreeInput = document.getElementById('product-is-free');
    const descriptionInput = document.getElementById('product-description');
    const keywordsInput = document.getElementById('product-keywords');
    const productFileInput = document.getElementById('product-file');

    function togglePriceInputs() {
        const isFree = isFreeInput.checked;

        if (isFree) {
            priceInput.value = '0';
            salePriceInput.value = '0';
            priceInput.disabled = true;
            salePriceInput.disabled = true;
        } else {
            priceInput.disabled = false;
            salePriceInput.disabled = false;
        }
    }

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
        errorText.textContent = '';

        const title = titleInput.value.trim();
        const price = priceInput.value.trim();
        const salePrice = salePriceInput.value.trim();
        const isFree = isFreeInput.checked;
        const description = descriptionInput.value.trim();
        const keywords = keywordsInput.value.trim();
        const thumbnailFile = thumbnailInput.files[0];
        const productFile = productFileInput.files[0];

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

        if (!thumbnailFile) {
            errorText.textContent = '상품 썸네일을 업로드해주세요.';
            return;
        }

        if (!productFile) {
            errorText.textContent = '판매상품 파일을 업로드해주세요.';
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', isFree ? '0' : price);
        formData.append('salePrice', isFree ? '0' : salePrice);
        formData.append('isFree', isFree ? '1' : '0');
        formData.append('description', description);
        formData.append('keywords', keywords);
        formData.append('thumbnail', thumbnailFile);
        formData.append('productFile', productFile);

        try {
            const response = await fetch('/api/seller/products', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                window.location.href = `/products-page/${data.productId}`;
            } else {
                errorText.textContent = data.message || '상품 등록에 실패했습니다.';
            }
        } catch (error) {
            console.error('상품 등록 실패:', error);
            errorText.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });
});