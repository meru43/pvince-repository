document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('seller-products-grid');
    const searchInput = document.getElementById('seller-product-search');
    const statusSelect = document.getElementById('seller-product-status');
    const priceTypeSelect = document.getElementById('seller-product-price-type');
    const searchBtn = document.getElementById('seller-product-search-btn');

    let currentUserRole = '';

    async function loadMe() {
        try {
            const response = await fetch('/me', {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();
            currentUserRole = data.role || '';
        } catch (error) {
            console.error('사용자 정보 조회 실패:', error);
        }
    }

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

    function getStatusText(product) {
        return Number(product.is_active) === 1 ? '판매중' : '판매중지';
    }

    function getFeaturedText(product) {
        return Number(product.is_featured) === 1 ? '추천 상품' : '';
    }

    function renderAdminStatusControl(product) {
        if (Number(product.is_active) === 1) {
            return `
                <div class="admin-status-control">
                    <div class="admin-stop-box">
                        <textarea
                            class="admin-stop-memo-input"
                            id="admin-stop-memo-${product.id}"
                            placeholder="판매중지 사유를 입력하세요. (선택사항)"
                        ></textarea>

                        <button
                            type="button"
                            class="btn btn-outline admin-stop-submit-btn"
                            data-product-id="${product.id}"
                        >
                            판매중지
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="admin-status-control">
                <div class="admin-stop-result">
                    <p class="seller-product-status">상태: 판매중지</p>
                    ${product.stop_memo
                ? `<p class="seller-product-stop-memo">사유: ${product.stop_memo}</p>`
                : ''
            }
                </div>

                <button
                    type="button"
                    class="btn btn-outline seller-status-btn"
                    data-product-id="${product.id}"
                    data-next-status="1"
                >
                    판매중으로 변경
                </button>
            </div>
        `;
    }

    function renderSellerStatusInfo(product) {
        return `
            <div class="admin-status-control">
                <p class="seller-product-status">상태: ${getStatusText(product)}</p>
                ${Number(product.is_active) === 0 && product.stop_memo
                ? `<p class="seller-product-stop-memo">사유: ${product.stop_memo}</p>`
                : ''
            }
            </div>
        `;
    }

    function renderFeaturedControl(product) {
        if (currentUserRole !== 'admin') return '';

        return `
            <button
                type="button"
                class="btn btn-outline seller-featured-btn"
                data-product-id="${product.id}"
                data-next-featured="${Number(product.is_featured) === 1 ? 0 : 1}"
            >
                ${Number(product.is_featured) === 1 ? '추천 해제' : '추천으로 설정'}
            </button>
        `;
    }

    function renderDetailButton(product) {
        if (Number(product.is_active) === 1) {
            return `<a href="/products-page/${product.id}" class="btn btn-outline">상세보기</a>`;
        }

        return `
            <button
                type="button"
                class="btn btn-outline stopped-detail-btn"
                data-message="현재 판매중지 상태인 상품입니다. 상세보기는 제한됩니다."
            >
                상세보기
            </button>
        `;
    }

    function renderProducts(products) {
        if (!products || products.length === 0) {
            grid.innerHTML = `<p class="empty-message">등록한 상품이 없습니다.</p>`;
            return;
        }

        grid.innerHTML = products.map(product => `
            <article class="seller-product-card">
                <div class="seller-product-thumb">
                    <img src="${getThumbSrc(product)}" alt="${product.title}">
                </div>

                <div class="seller-product-info">
                    <p class="seller-product-category">상품</p>
                    <h3 class="seller-product-title">${product.title}</h3>
                    <p class="seller-product-price">${getDisplayPrice(product)}</p>
                    <p class="seller-product-date">등록일: ${new Date(product.created_at).toLocaleDateString()}</p>
                    <p class="seller-product-uploader">업로더: ${product.uploader_name || '-'}</p>
                    <p class="seller-product-status">상태: ${getStatusText(product)}</p>
                    ${getFeaturedText(product) ? `<p class="seller-product-featured">${getFeaturedText(product)}</p>` : ''}

                    <div class="seller-product-actions">
                        ${renderDetailButton(product)}
                        <a href="/seller-products/edit/${product.id}" class="btn btn-outline">수정</a>
                        <button
                            type="button"
                            class="btn btn-outline seller-delete-btn"
                            data-product-id="${product.id}"
                        >
                            삭제
                        </button>
                        ${renderFeaturedControl(product)}
                    </div>

                    ${currentUserRole === 'admin'
                ? renderAdminStatusControl(product)
                : renderSellerStatusInfo(product)
            }
                </div>
            </article>
        `).join('');
    }

    async function loadProducts() {
        try {
            const params = new URLSearchParams({
                q: searchInput?.value?.trim() || '',
                status: statusSelect?.value || '',
                priceType: priceTypeSelect?.value || ''
            });

            const response = await fetch(`/api/seller/products?${params.toString()}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                renderProducts(data.products);
            } else {
                grid.innerHTML = `<p class="empty-message">${data.message || '상품 목록을 불러오지 못했습니다.'}</p>`;
            }
        } catch (error) {
            console.error('판매자 상품 목록 조회 실패:', error);
            grid.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
        }
    }

    async function deleteProduct(productId) {
        const response = await fetch(`/api/seller/products/${productId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        return response.json();
    }

    async function updateProductStatus(productId, isActive, stopMemo = '') {
        const response = await fetch(`/api/admin/products/${productId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                isActive,
                stopMemo
            })
        });

        return response.json();
    }

    async function updateFeaturedStatus(productId, isFeatured) {
        const response = await fetch(`/api/admin/products/${productId}/featured`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                isFeatured
            })
        });

        return response.json();
    }

    document.addEventListener('click', async (e) => {
        const stoppedDetailBtn = e.target.closest('.stopped-detail-btn');
        if (stoppedDetailBtn) {
            const message = stoppedDetailBtn.dataset.message || '현재 판매중지 상태인 상품입니다. 상세보기는 제한됩니다.';
            alert(message);
            return;
        }

        const deleteBtn = e.target.closest('.seller-delete-btn');
        if (deleteBtn) {
            const productId = deleteBtn.dataset.productId;

            if (!confirm('정말 이 상품을 삭제하시겠습니까?')) {
                return;
            }

            try {
                const data = await deleteProduct(productId);

                if (data.success) {
                    alert(data.message);
                    await loadProducts();
                } else {
                    alert(data.message || '상품 삭제에 실패했습니다.');
                }
            } catch (error) {
                console.error('상품 삭제 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }

            return;
        }

        const stopSubmitBtn = e.target.closest('.admin-stop-submit-btn');
        if (stopSubmitBtn) {
            const productId = stopSubmitBtn.dataset.productId;
            const memoInput = document.getElementById(`admin-stop-memo-${productId}`);
            const stopMemo = memoInput ? memoInput.value.trim() : '';

            try {
                const data = await updateProductStatus(productId, 0, stopMemo);

                if (data.success) {
                    alert(data.message);
                    await loadProducts();
                } else {
                    alert(data.message || '판매 상태 변경에 실패했습니다.');
                }
            } catch (error) {
                console.error('판매중지 처리 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }

            return;
        }

        const statusBtn = e.target.closest('.seller-status-btn');
        if (statusBtn) {
            const productId = statusBtn.dataset.productId;
            const nextStatus = Number(statusBtn.dataset.nextStatus);

            try {
                const data = await updateProductStatus(productId, nextStatus, '');

                if (data.success) {
                    alert(data.message);
                    await loadProducts();
                } else {
                    alert(data.message || '판매 상태 변경에 실패했습니다.');
                }
            } catch (error) {
                console.error('판매 상태 변경 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }

            return;
        }

        const featuredBtn = e.target.closest('.seller-featured-btn');
        if (featuredBtn) {
            const productId = featuredBtn.dataset.productId;
            const nextFeatured = Number(featuredBtn.dataset.nextFeatured);

            try {
                const data = await updateFeaturedStatus(productId, nextFeatured);

                if (data.success) {
                    alert(data.message);
                    await loadProducts();
                } else {
                    alert(data.message || '추천 상품 설정에 실패했습니다.');
                }
            } catch (error) {
                console.error('추천 상품 설정 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }

            return;
        }
    });

    searchBtn?.addEventListener('click', async () => {
        await loadProducts();
    });

    searchInput?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await loadProducts();
        }
    });

    statusSelect?.addEventListener('change', async () => {
        await loadProducts();
    });

    priceTypeSelect?.addEventListener('change', async () => {
        await loadProducts();
    });

    await loadMe();
    await loadProducts();
});