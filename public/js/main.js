document.addEventListener('DOMContentLoaded', async () => {
    const featuredGrid = document.getElementById('featured-products-grid');
    if (!featuredGrid) return;

    function getDisplayPrice(product) {
        if (Number(product.is_free) === 1) {
            return '무료';
        }

        if (product.sale_price !== null && product.sale_price !== undefined && product.sale_price !== '') {
            return `${Number(product.sale_price).toLocaleString()}원`;
        }

        return `${Number(product.price || 0).toLocaleString()}원`;
    }

    function getThumbSrc(product) {
        if (product.thumbnail_path && String(product.thumbnail_path).trim() !== '') {
            return product.thumbnail_path;
        }

        return `https://via.placeholder.com/600x400?text=Product+${product.id}`;
    }

    try {
        const response = await fetch('/api/featured-products', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.success || !data.products || data.products.length === 0) {
            featuredGrid.innerHTML = `<p class="empty-message">추천 템플릿이 없습니다.</p>`;
            return;
        }

        featuredGrid.innerHTML = data.products.map(product => `
            <a href="/products-page/${product.id}" class="home-product-card">
                <div class="home-product-thumb">
                    <img src="${getThumbSrc(product)}" alt="${product.title}" />
                </div>
                <div class="home-product-info">
                    <h4 class="home-product-title">${product.title}</h4>
                </div>
            </a>
        `).join('');
    } catch (error) {
        console.error('추천 템플릿 조회 실패:', error);
        featuredGrid.innerHTML = `<p class="empty-message">추천 템플릿을 불러오지 못했습니다.</p>`;
    }
});