document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('seller-upload-form');
    const errorText = document.getElementById('seller-upload-error');

    const titleInput = document.getElementById('product-title');
    const priceInput = document.getElementById('product-price');
    const fileNameInput = document.getElementById('product-file-name');
    const filePathInput = document.getElementById('product-file-path');
    const descriptionInput = document.getElementById('product-description');

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
        const fileName = fileNameInput.value.trim();
        const filePath = filePathInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!title || !price || !fileName || !filePath || !description) {
            errorText.textContent = '모든 항목을 입력해주세요.';
            return;
        }

        try {
            const response = await fetch('/api/seller/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    title,
                    price,
                    fileName,
                    filePath,
                    description
                })
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