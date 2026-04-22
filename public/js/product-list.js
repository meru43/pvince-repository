document.addEventListener('DOMContentLoaded', async () => {
    const productGrid = document.getElementById('product-grid');

    function getDisplayPrice(product) {
        if (Number(product.is_free) === 1) {
            return '무료';
        }

        if (product.sale_price !== null && product.sale_price !== undefined && product.sale_price !== '') {
            return `${Number(product.sale_price).toLocaleString()}원`;
        }

        if (product.price !== null && product.price !== undefined && product.price !== '') {
            return `${Number(product.price).toLocaleString()}원`;
        }

        return '-';
    }

    function getThumbnailSrc(product) {
        if (product.thumbnail_path && String(product.thumbnail_path).trim() !== '') {
            return product.thumbnail_path;
        }

        return `https://via.placeholder.com/600x400?text=Product+${product.id}`;
    }

    function renderProducts(products) {
        if (!products || products.length === 0) {
            productGrid.innerHTML = `<p class="empty-message">등록된 상품이 없습니다.</p>`;
            return;
        }

        productGrid.innerHTML = products.map(product => {
            const thumbnailSrc = getThumbnailSrc(product);
            const displayPrice = getDisplayPrice(product);

            return `
                <article class="product-card">
                    <a href="/products-page/${product.id}" class="product-thumb">
                        <img src="${thumbnailSrc}" alt="${product.title}">
                    </a>

                    <div class="product-info">
                        <p class="product-category">상품</p>
                        <h3 class="product-name">
                            <a href="/products-page/${product.id}">${product.title}</a>
                        </h3>
                        <p class="product-uploader">업로더: ${product.uploader_name || '미지정'}</p>
                        <p class="product-price">${displayPrice}</p>
                        <a href="/products-page/${product.id}" class="btn btn-outline">상세보기</a>
                    </div>
                </article>
            `;
        }).join('');
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