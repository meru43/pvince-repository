document.addEventListener('DOMContentLoaded', async () => {
    const detailBox = document.getElementById('product-detail-box');
    const descriptionBox = document.getElementById('product-description-box');
    const descriptionContent = document.getElementById('product-description');
    const keywordsBox = document.getElementById('product-keywords');

    const pathParts = window.location.pathname.split('/');
    const productId = pathParts[pathParts.length - 1];

    async function addToCart(product) {
        try {
            const response = await fetch('/api/cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    productId: product.id
                })
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
            } else {
                alert(data.message || '장바구니 담기에 실패했습니다.');
            }
        } catch (error) {
            console.error('장바구니 담기 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    }

    function renderProduct(product) {
        const keywordHtml = (product.keywordList || [])
            .map(keyword => `<span class="keyword-tag">${keyword}</span>`)
            .join('');

        const displayPrice = product.is_free
            ? '무료'
            : product.sale_price
                ? `${Number(product.sale_price).toLocaleString()}원`
                : `${Number(product.price).toLocaleString()}원`;

        const originalPriceHtml = (!product.is_free && product.sale_price && Number(product.price) > Number(product.sale_price))
            ? `<p class="detail-original-price">${Number(product.price).toLocaleString()}원</p>`
            : '';

        const thumbnailSrc = product.thumbnail_path
            ? product.thumbnail_path
            : `https://via.placeholder.com/800x520?text=Product+${product.id}`;

        detailBox.innerHTML = `
            <div class="detail-image">
                <img src="${thumbnailSrc}" alt="${product.title}">
            </div>

            <div class="detail-content">
                <p class="detail-category">상품 상세</p>
                <h2 class="detail-title">${product.title}</h2>
                ${originalPriceHtml}
                <p class="detail-price">${displayPrice}</p>

                <div class="detail-summary">
                    <p>${product.description || '상품 설명이 없습니다.'}</p>
                </div>

                <ul class="detail-meta">
                    <li><strong>상품 번호</strong> <span>${product.id}</span></li>
                    <li><strong>업로더</strong> <span>${product.uploader_name || '미지정'}</span></li>
                    <li><strong>파일명</strong> <span>${product.file_name || '-'}</span></li>
                    <li><strong>가격</strong> <span>${displayPrice}</span></li>
                </ul>


                <div class="detail-actions">
                    <button type="button" class="btn btn-outline" id="add-cart-btn">장바구니 담기</button>
                    <button type="button" class="btn btn-primary" id="purchase-btn">바로 구매</button>
                </div>
            </div>
        `;

        descriptionContent.innerHTML = `
            <p>${product.description || '상품 설명이 없습니다.'}</p>
        `;

        if (keywordsBox) {
            keywordsBox.innerHTML = keywordHtml;
        }

        descriptionBox.style.display = 'block';

        const addCartBtn = document.getElementById('add-cart-btn');
        if (addCartBtn) {
            addCartBtn.addEventListener('click', () => {
                addToCart(product);
            });
        }

        const purchaseBtn = document.getElementById('purchase-btn');
        if (purchaseBtn) {
            purchaseBtn.addEventListener('click', () => {
                window.location.href = `/order-page/${product.id}`;
            });
        }
    }

    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            renderProduct(data.product);
        } else {
            detailBox.innerHTML = `<p class="empty-message">${data.message || '상품 정보를 불러오지 못했습니다.'}</p>`;
        }
    } catch (error) {
        console.error('상품 상세 불러오기 실패:', error);
        detailBox.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
    }
});