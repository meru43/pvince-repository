document.addEventListener('DOMContentLoaded', async () => {
    const featuredGrid = document.getElementById('featured-products-grid');
    const searchForm = document.getElementById('main-ppt-search-form');
    const searchInput = document.getElementById('main-ppt-search');

    function getThumbSrc(product) {
        if (product.thumbnail_path && String(product.thumbnail_path).trim() !== '') {
            return product.thumbnail_path;
        }

        return `https://via.placeholder.com/600x400?text=PPT+${product.id}`;
    }

    searchForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = searchInput?.value.trim() || '';

        if (!value) {
            searchInput?.focus();
            return;
        }

        window.location.href = `/ppt-lab-page?q=${encodeURIComponent(value)}`;
    });

    if (!featuredGrid) return;

    try {
        const response = await fetch('/api/featured-products', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.success || !data.products || data.products.length === 0) {
            featuredGrid.innerHTML = '<p class="empty-message">추천 템플릿이 없습니다.</p>';
            return;
        }

        featuredGrid.innerHTML = data.products.map((product) => `
            <a href="/products-page/${product.id}" class="home-product-card">
                <div class="home-product-thumb">
                    <img src="${getThumbSrc(product)}" alt="${product.title}" />
                </div>
                <div class="home-product-info">
                    <h3 class="home-product-title">${product.title}</h3>
                </div>
            </a>
        `).join('');
    } catch (error) {
        console.error('추천 템플릿 조회 실패:', error);
        featuredGrid.innerHTML = '<p class="empty-message">추천 템플릿을 불러오지 못했습니다.</p>';
    }
});
