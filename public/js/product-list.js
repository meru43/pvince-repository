document.addEventListener('DOMContentLoaded', async () => {
    const productGrid = document.getElementById('product-grid');

    function renderProducts(products) {
        if (!products || products.length === 0) {
            productGrid.innerHTML = `<p class="empty-message">등록된 상품이 없습니다.</p>`;
            return;
        }

        productGrid.innerHTML = products.map(product => `
            <article class="product-card">
                <a href="/products-page/${product.id}" class="product-thumb">
                    <img src="https://via.placeholder.com/600x400?text=Product+${product.id}" alt="${product.title}">
                </a>

                <div class="product-info">
                    <p class="product-category">상품</p>
                    <h3 class="product-name">
                        <a href="/products-page/${product.id}">${product.title}</a>
                    </h3>
                    <p class="product-price">${Number(product.price).toLocaleString()}원</p>
                    <a href="/products-page/${product.id}" class="btn btn-outline">상세보기</a>
                </div>
            </article>
        `).join('');
    }

    try {
        const response = await fetch('/api/products', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            renderProducts(data.products);
        } else {
            productGrid.innerHTML = `<p class="empty-message">${data.message || '상품을 불러오지 못했습니다.'}</p>`;
        }
    } catch (error) {
        console.error('상품 목록 불러오기 실패:', error);
        productGrid.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
    }
});