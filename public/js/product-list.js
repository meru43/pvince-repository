document.addEventListener('DOMContentLoaded', async () => {
    const productGrid = document.getElementById('product-grid');
    const searchInput = document.getElementById('product-search-input');
    const priceFilter = document.getElementById('product-price-filter');
    const sortSelect = document.getElementById('product-sort-select');
    const resetButton = document.getElementById('product-filter-reset');
    const filterCount = document.getElementById('product-filter-count');

    const ROWS_PER_PAGE = 5;
    let cachedProducts = [];
    let currentPage = 1;

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

    function getNumericPrice(product) {
        if (Number(product.is_free) === 1) {
            return 0;
        }

        if (product.sale_price !== null && product.sale_price !== undefined && product.sale_price !== '') {
            return Number(product.sale_price) || 0;
        }

        return Number(product.price) || 0;
    }

    function getThumbnailSrc(product) {
        if (product.thumbnail_path && String(product.thumbnail_path).trim() !== '') {
            return product.thumbnail_path;
        }

        return `https://via.placeholder.com/600x400?text=Product+${product.id}`;
    }

    function getTargetHeight() {
        if (window.innerWidth <= 480) return 180;
        if (window.innerWidth <= 768) return 200;
        if (window.innerWidth <= 1024) return 240;
        return 280;
    }

    function getGap() {
        if (window.innerWidth <= 480) return 14;
        if (window.innerWidth <= 768) return 16;
        return 24;
    }

    function loadImageRatio(src) {
        return new Promise((resolve) => {
            const img = new Image();

            img.onload = () => {
                const ratio = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 4 / 3;
                resolve(ratio || 4 / 3);
            };

            img.onerror = () => resolve(4 / 3);
            img.src = src;
        });
    }

    async function enrichProducts(products) {
        const ratios = await Promise.all(
            products.map((product) => loadImageRatio(getThumbnailSrc(product)))
        );

        return products.map((product, index) => ({
            ...product,
            _thumbnailSrc: getThumbnailSrc(product),
            _ratio: ratios[index] || 4 / 3
        }));
    }

    function buildRows(products, containerWidth, gap, targetHeight) {
        const rows = [];
        let row = [];
        let ratioSum = 0;

        products.forEach((product, index) => {
            row.push(product);
            ratioSum += product._ratio;

            const totalGap = gap * (row.length - 1);
            const expectedWidth = ratioSum * targetHeight + totalGap;
            const isLastProduct = index === products.length - 1;

            if (expectedWidth >= containerWidth || isLastProduct) {
                const availableWidth = Math.max(containerWidth - totalGap, 0);
                const shouldFillRow = expectedWidth >= containerWidth;
                const rowHeight = shouldFillRow
                    ? availableWidth / ratioSum
                    : targetHeight;

                let usedWidth = 0;

                const items = row.map((rowProduct, rowIndex) => {
                    const isLastItem = rowIndex === row.length - 1;

                    if (shouldFillRow && isLastItem) {
                        return {
                            product: rowProduct,
                            width: Math.max(0, availableWidth - usedWidth)
                        };
                    }

                    const width = rowProduct._ratio * rowHeight;
                    usedWidth += width;

                    return {
                        product: rowProduct,
                        width
                    };
                });

                rows.push({
                    items,
                    height: rowHeight
                });

                row = [];
                ratioSum = 0;
            }
        });

        return rows;
    }

    function getFilteredProducts() {
        const query = (searchInput?.value || '').trim().toLowerCase();
        const priceType = priceFilter?.value || 'all';
        const sortType = sortSelect?.value || 'latest';

        let filtered = cachedProducts.filter((product) => {
            const matchesQuery = !query || [
                product.title,
                product.description,
                product.keywords,
                product.uploader_name,
                ...(product.keywordList || [])
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));

            const isFree = Number(product.is_free) === 1;
            const matchesPrice = priceType === 'all'
                || (priceType === 'free' && isFree)
                || (priceType === 'paid' && !isFree);

            return matchesQuery && matchesPrice;
        });

        filtered = filtered.sort((a, b) => {
            if (sortType === 'price-low') return getNumericPrice(a) - getNumericPrice(b);
            if (sortType === 'price-high') return getNumericPrice(b) - getNumericPrice(a);
            if (sortType === 'name') return String(a.title || '').localeCompare(String(b.title || ''), 'ko');
            return Number(b.id) - Number(a.id);
        });

        return filtered;
    }

    function getPaginationMarkup(totalPages) {
        const pageButtons = Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            const activeClass = page === currentPage ? ' active' : '';

            return `
                <button type="button" class="pagination-btn page-number${activeClass}" data-page="${page}">
                    ${page}
                </button>
            `;
        }).join('');

        return `
            <div class="product-pagination">
                <button
                    type="button"
                    class="pagination-btn pagination-nav"
                    data-page="${currentPage - 1}"
                    ${currentPage === 1 ? 'disabled' : ''}
                >
                    이전
                </button>
                <div class="pagination-numbers">
                    ${pageButtons}
                </div>
                <button
                    type="button"
                    class="pagination-btn pagination-nav"
                    data-page="${currentPage + 1}"
                    ${currentPage === totalPages ? 'disabled' : ''}
                >
                    다음
                </button>
            </div>
        `;
    }

    function renderRows(products) {
        if (filterCount) {
            filterCount.textContent = String(products.length);
        }

        if (!products || products.length === 0) {
            productGrid.innerHTML = '<p class="empty-message">조건에 맞는 상품이 없습니다.</p>';
            return;
        }

        const containerWidth = productGrid.clientWidth;
        const gap = getGap();
        const targetHeight = getTargetHeight();
        const rows = buildRows(products, containerWidth, gap, targetHeight);
        const totalPages = Math.max(Math.ceil(rows.length / ROWS_PER_PAGE), 1);

        currentPage = Math.min(currentPage, totalPages);

        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        const visibleRows = rows.slice(startIndex, startIndex + ROWS_PER_PAGE);

        productGrid.innerHTML = `
            ${visibleRows.map((row) => `
                <div class="product-row" style="gap:${gap}px;">
                    ${row.items.map(({ product, width }) => `
                        <a
                            href="/products-page/${product.id}"
                            class="product-card"
                            style="--card-width:${width}px;"
                        >
                            <span class="product-thumb">
                                <img
                                    src="${product._thumbnailSrc}"
                                    alt="${product.title}"
                                >
                            </span>

                            <span class="product-info">
                                <strong class="product-name">${product.title}</strong>
                                <span class="product-price">${getDisplayPrice(product)}</span>
                            </span>
                        </a>
                    `).join('')}
                </div>
            `).join('')}
            ${getPaginationMarkup(totalPages)}
        `;
    }

    function applyFilters(resetPage = false) {
        if (resetPage) {
            currentPage = 1;
        }

        const filtered = getFilteredProducts();
        renderRows(filtered);
    }

    productGrid.addEventListener('click', (event) => {
        const button = event.target.closest('.pagination-btn[data-page]');
        if (!button || button.disabled) return;

        const nextPage = Number(button.dataset.page);
        if (!Number.isFinite(nextPage) || nextPage < 1) return;

        currentPage = nextPage;
        applyFilters(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    searchInput?.addEventListener('input', () => {
        applyFilters(true);
    });

    priceFilter?.addEventListener('change', () => {
        applyFilters(true);
    });

    sortSelect?.addEventListener('change', () => {
        applyFilters(true);
    });

    resetButton?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (priceFilter) priceFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'latest';
        applyFilters(true);
    });

    let resizeTimer = null;

    window.addEventListener('resize', () => {
        if (!cachedProducts.length) return;

        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            applyFilters(false);
        }, 80);
    });

    try {
        const response = await fetch('/api/products', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.success) {
            productGrid.innerHTML = `<p class="empty-message">${data.message || '상품을 불러오지 못했습니다.'}</p>`;
            return;
        }

        cachedProducts = await enrichProducts(data.products || []);
        applyFilters(true);
    } catch (error) {
        console.error('상품 목록 불러오기 실패:', error);
        productGrid.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
    }
});
