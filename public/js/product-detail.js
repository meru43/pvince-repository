document.addEventListener('DOMContentLoaded', async () => {
    const detailBox = document.getElementById('product-detail-box');
    const pathParts = window.location.pathname.split('/');
    const productId = pathParts[pathParts.length - 1];

    let mainSwiper = null;
    let thumbSwiper = null;

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function htmlToPlainText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html || '';
        return (temp.textContent || temp.innerText || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeDescriptionHtml(html) {
        const rawHtml = String(html || '').trim();
        if (!rawHtml) {
            return '<p>상품 설명이 없습니다.</p>';
        }

        const hasHtmlTag = /<\/?[a-z][\s\S]*>/i.test(rawHtml);
        if (hasHtmlTag) {
            return rawHtml;
        }

        const plainText = htmlToPlainText(rawHtml);
        if (!plainText) {
            return '<p>상품 설명이 없습니다.</p>';
        }

        return plainText
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => `<p>${escapeHtml(line)}</p>`)
            .join('');
    }

    function formatPrice(value, isFree) {
        if (Number(isFree) === 1) {
            return '무료';
        }
        return `${Number(value || 0).toLocaleString()}원`;
    }

    function formatDateTime(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    function renderRatingStars(value) {
        const safeValue = Math.max(0, Math.min(5, Math.round(Number(value || 0))));
        return Array.from({ length: 5 }, (_, index) => (
            `<span class="detail-rating-star${index < safeValue ? ' is-active' : ''}">★</span>`
        )).join('');
    }

    window.__handleAdminReviewDelete = async function handleAdminReviewDelete(event, buttonEl) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        const button = buttonEl || event.currentTarget || event.target?.closest?.('.detail-review-remove-btn');
        const reviewId = Number(button?.dataset?.reviewId || 0);
        if (!reviewId) return false;

        const shouldDelete = window.confirm('정말 이 리뷰를 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.');
        if (!shouldDelete) return false;

        try {
            const response = await fetch(`/api/reviews/${reviewId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await response.json();

            if (!data.success) {
                alert(data.message || '리뷰 삭제에 실패했습니다.');
                return false;
            }

            alert(data.message || '리뷰가 삭제되었습니다.');
            window.location.reload();
        } catch (error) {
            console.error('review delete failed:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }

        return false;
    };

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
                return;
            }

            alert(data.message || '장바구니 담기에 실패했습니다.');
        } catch (error) {
            console.error('장바구니 담기 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    }

    function parseProductFiles(product) {
        if (product?.product_files_json) {
            try {
                const parsedFiles = JSON.parse(product.product_files_json);
                if (Array.isArray(parsedFiles)) {
                    return parsedFiles.filter((file) => file?.name && file?.path);
                }
            } catch (error) {
                console.error('상품 파일 목록 파싱 실패:', error);
            }
        }

        if (product?.file_name && product?.file_path) {
            return [{
                name: product.file_name,
                path: product.file_path
            }];
        }

        return [];
    }

    function parseThumbnailGallery(product) {
        if (product?.thumbnail_gallery_json) {
            try {
                const parsed = JSON.parse(product.thumbnail_gallery_json);
                if (Array.isArray(parsed) && parsed.length) {
                    return parsed
                        .filter((item) => item?.path)
                        .map((item) => ({
                            path: item.path,
                            name: item.name || product.title || '상품 이미지',
                            isRepresentative: Boolean(item.isRepresentative)
                        }));
                }
            } catch (error) {
                console.error('썸네일 갤러리 파싱 실패:', error);
            }
        }

        if (product?.thumbnail_path) {
            return [{
                path: product.thumbnail_path,
                name: product.title || '상품 이미지',
                isRepresentative: true
            }];
        }

        return [{
            path: `https://via.placeholder.com/1280x720?text=Product+${product.id}`,
            name: product.title || '상품 이미지',
            isRepresentative: true
        }];
    }

    function initializeSwipers() {
        if (thumbSwiper) {
            thumbSwiper.destroy(true, true);
            thumbSwiper = null;
        }

        if (mainSwiper) {
            mainSwiper.destroy(true, true);
            mainSwiper = null;
        }

        if (typeof Swiper === 'undefined') {
        }

        thumbSwiper = new Swiper('.detail-thumb-swiper', {
            spaceBetween: 10,
            slidesPerView: 'auto',
            freeMode: true,
            watchSlidesProgress: true,
            mousewheel: {
                forceToAxis: true
            }
        });

        mainSwiper = new Swiper('.detail-main-swiper', {
            slidesPerView: 1,
            spaceBetween: 12,
            grabCursor: true,
            navigation: {
                nextEl: '.detail-swiper-next',
                prevEl: '.detail-swiper-prev'
            },
            thumbs: {
                swiper: thumbSwiper
            }
        });
    }

    function renderProduct(product) {
        const galleryImages = parseThumbnailGallery(product);
        const productFiles = parseProductFiles(product);
        const descriptionHtml = normalizeDescriptionHtml(product.description || product.ai_summary_text || '');
        const aiSummaryHtml = product.ai_summary_text
            ? `
                <section class="detail-ai-summary-box">
                    <p class="detail-ai-summary-label">AI 분석</p>
                    <div class="detail-ai-summary-text">
                        <p>${escapeHtml(product.ai_summary_text)}</p>
                    </div>
                </section>
            `
            : '';
        const keywordHtml = (product.keywordList || [])
            .map((keyword) => `<span class="keyword-tag">${escapeHtml(keyword)}</span>`)
            .join('');
        const basePrice = Number(product.price || 0);
        const salePrice = Number(product.sale_price || 0);
        const hasDiscount = Number(product.is_free) !== 1
            && salePrice > 0
            && basePrice > salePrice;
        const discountPercent = hasDiscount
            ? Math.round(((basePrice - salePrice) / basePrice) * 100)
            : 0;
        const displayPrice = formatPrice(hasDiscount ? salePrice : product.sale_price || product.price, product.is_free);
        const originalPriceHtml = (
            Number(product.is_free) !== 1
            && product.sale_price
            && Number(product.price) > Number(product.sale_price)
        )
            ? `<p class="detail-original-price">${Number(product.price).toLocaleString()}원</p>`
            : '';
        const uploaderName = escapeHtml(product.uploader_name || '미정');
        const uploaderProfileImage = String(product.uploader_profile_image || '').trim();
        const ratingSummaryHtml = Number(product.review_count || 0) > 0
            ? `
                <div class="detail-rating-summary">
                    <div class="detail-rating-stars">${renderRatingStars(product.average_rating)}</div>
                    <span class="detail-rating-average">${Number(product.average_rating || 0).toFixed(1)}</span>
                    <span class="detail-rating-count">(${Number(product.review_count || 0)})</span>
                </div>
            `
            : `
                <div class="detail-rating-summary is-empty">
                    <span class="detail-rating-empty">아직 등록된 후기가 없습니다.</span>
                </div>
            `;
        const reviewsHtml = Array.isArray(product.reviews) && product.reviews.length
            ? product.reviews.map((review) => `
                <article class="detail-review-item">
                    <div class="detail-review-head">
                        <div class="detail-review-head-main">
                            <strong class="detail-review-author">${escapeHtml(review.author_name || '익명')}</strong>
                            <div class="detail-review-rating">${renderRatingStars(review.rating)}</div>
                        </div>
                        ${product.is_admin ? `<button type="button" class="detail-review-remove-btn" data-review-id="${Number(review.id || 0)}" onclick="window.__handleAdminReviewDelete(event, this)">삭제</button>` : ''}
                    </div>
                    <p class="detail-review-content">${escapeHtml(review.content || '').replace(/\n/g, '<br>')}</p>
                    <p class="detail-review-date">${escapeHtml(formatDateTime(review.created_at))}</p>
                </article>
            `).join('')
            : '<p class="detail-review-empty">첫 후기를 남겨보세요.</p>';

        const adminDownloadHtml = product.is_admin
            ? `
                <div class="detail-admin-download">
                    <button type="button" class="btn btn-primary" id="admin-download-toggle">다운로드</button>
                    <div class="detail-download-list" id="detail-download-list" hidden>
                        ${productFiles.map((file, index) => `
                            <a href="/download/${product.id}?file=${index}" class="detail-download-item">${escapeHtml(file.name)}</a>
                        `).join('')}
                    </div>
                </div>
            `
            : '';

        const actionHtml = product.is_owner
            ? `
                <div class="detail-owner-notice">
                    <strong>본인 상품</strong>
                    <p>직접 업로드한 상품이라 장바구니 담기와 바로 구매를 사용할 수 없습니다.</p>
                </div>
            `
            : product.is_admin
                ? adminDownloadHtml
                : `
                    <button type="button" class="btn btn-outline" id="add-cart-btn">장바구니 담기</button>
                    <button type="button" class="btn btn-primary" id="purchase-btn">바로 구매</button>
                `;

        detailBox.innerHTML = `
            <div class="detail-primary">
                <section class="detail-gallery">
                    <div class="detail-main-slider-wrap">
                        <div class="swiper detail-main-swiper">
                            <div class="swiper-wrapper">
                                ${galleryImages.map((image) => `
                                    <div class="swiper-slide">
                                        <div class="detail-image">
                                            <img src="${image.path}" alt="${escapeHtml(image.name)}">
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <button type="button" class="detail-swiper-nav detail-swiper-prev" aria-label="이전 이미지"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M199.7 299.8C189.4 312.4 190.2 330.9 201.9 342.6L329.9 470.6C339.1 479.8 352.8 482.5 364.8 477.5C376.8 472.5 384.6 460.9 384.6 447.9L384.6 191.9C384.6 179 376.8 167.3 364.8 162.3C352.8 157.3 339.1 160.1 329.9 169.2L201.9 297.2L199.7 299.6z"/></svg></button>
                        <button type="button" class="detail-swiper-nav detail-swiper-next" aria-label="다음 이미지"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M441.3 299.8C451.5 312.4 450.8 330.9 439.1 342.6L311.1 470.6C301.9 479.8 288.2 482.5 276.2 477.5C264.2 472.5 256.5 460.9 256.5 448L256.5 192C256.5 179.1 264.3 167.4 276.3 162.4C288.3 157.4 302 160.2 311.2 169.3L439.2 297.3L441.4 299.7z"/></svg></button>
                    </div>

                    <div class="swiper detail-thumb-swiper">
                        <div class="swiper-wrapper">
                            ${galleryImages.map((image) => `
                                <div class="swiper-slide">
                                    <button type="button" class="detail-gallery-thumb">
                                        <img src="${image.path}" alt="${escapeHtml(image.name)}">
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </section>

                <section class="detail-description-box">
                    <h3 class="section-title">상품 설명</h3>
                    <div class="description-content">
                        ${aiSummaryHtml}
                        <div class="detail-description-body">${descriptionHtml}</div>
                    </div>
                    <section class="detail-reviews-box">
                        <div class="detail-reviews-head">
                            <h3 class="section-title">리뷰</h3>
                        </div>
                        <div class="detail-reviews-list">
                            ${reviewsHtml}
                        </div>
                    </section>
                    <div class="product-keywords">${keywordHtml}</div>
                </section>
            </div>

            <aside class="detail-content">
                <div class="detail-info-hero">
                    <div class="detail-brand-row">
                        ${uploaderProfileImage
                            ? `<img src="${uploaderProfileImage}" alt="${uploaderName}" class="detail-brand-avatar">`
                            : `<span class="detail-brand-badge">${uploaderName.slice(0, 1)}</span>`}
                        <span class="detail-brand-name">${uploaderName}</span>
                    </div>
                    <h2 class="detail-title">${escapeHtml(product.title)}</h2>
                    ${ratingSummaryHtml}
                    ${Number(product.is_free) === 1
                        ? `
                            <div class="detail-price-summary detail-price-summary-free">
                                <p class="detail-price">${displayPrice}</p>
                            </div>
                        `
                        : hasDiscount
                            ? `
                                <div class="detail-price-summary">
                                    <div class="detail-price-breakdown">
                                        <div class="detail-price-row">
                                            <span class="detail-price-label">할인율</span>
                                            <span class="detail-discount-rate">${discountPercent}%</span>
                                        </div>
                                        <div class="detail-price-row">
                                            <span class="detail-price-label">판매가</span>
                                            <span class="detail-original-price">${basePrice.toLocaleString()}원</span>
                                        </div>
                                        <div class="detail-price-row detail-price-row-final">
                                            <span class="detail-price-label">할인가</span>
                                            <span class="detail-price">${salePrice.toLocaleString()}원</span>
                                        </div>
                                    </div>
                                </div>
                            `
                            : `
                                <div class="detail-price-summary">
                                    <div class="detail-price-row detail-price-row-final">
                                        <span class="detail-price-label">판매가</span>
                                        <span class="detail-price">${displayPrice}</span>
                                    </div>
                                </div>
                            `}
                </div>

                <div class="detail-actions">
                    ${actionHtml}
                </div>
            </aside>
        `;

        initializeSwipers();

        if (product.is_admin) {
            const downloadToggle = document.getElementById('admin-download-toggle');
            const downloadList = document.getElementById('detail-download-list');

            downloadToggle?.addEventListener('click', () => {
                if (!downloadList) return;
                downloadList.hidden = !downloadList.hidden;
            });

            return;
        }

        if (!product.is_owner) {
            const addCartBtn = document.getElementById('add-cart-btn');
            const purchaseBtn = document.getElementById('purchase-btn');

            addCartBtn?.addEventListener('click', () => addToCart(product));
            purchaseBtn?.addEventListener('click', () => {
                window.location.href = `/order-page/${product.id}`;
            });
        }

        if (product.is_admin) {
            detailBox.querySelectorAll('.detail-review-delete-action').forEach((button) => {
                button.addEventListener('click', async () => {
                    const reviewId = Number(button.dataset.reviewId || 0);
                    if (!reviewId) return;

                    const originalConfirm = window.confirm.bind(window);
                    if (!originalConfirm('정말 이 리뷰를 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.')) {
                        return;
                    }
                    window.confirm = () => true;

                    if (!window.confirm('정말 이 리뷰를 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.')) {
                        return;
                    }

                    if (!window.confirm('이 리뷰를 삭제할까요?')) {
                        return;
                    }

                    window.confirm = originalConfirm;

                    try {
                        const response = await fetch(`/api/reviews/${reviewId}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });
                        const data = await response.json();

                        if (!data.success) {
                            alert(data.message || '리뷰 삭제에 실패했습니다.');
                            return;
                        }

                        alert(data.message || '리뷰가 삭제되었습니다.');
                        window.location.reload();
                    } catch (error) {
                        console.error('review delete failed:', error);
                        alert('서버와 통신 중 오류가 발생했습니다.');
                    }
                });
            });

            detailBox.querySelectorAll('.detail-review-remove-btn').forEach((button) => {
                button.addEventListener('click', async () => {
                    const reviewId = Number(button.dataset.reviewId || 0);
                    if (!reviewId) return;

                    const shouldDelete = window.confirm('정말 이 리뷰를 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.');
                    if (!shouldDelete) {
                        return;
                    }

                    try {
                        const response = await fetch(`/api/reviews/${reviewId}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });
                        const data = await response.json();

                        if (!data.success) {
                            alert(data.message || '리뷰 삭제에 실패했습니다.');
                            return;
                        }

                        alert(data.message || '리뷰가 삭제되었습니다.');
                        window.location.reload();
                    } catch (error) {
                        console.error('review delete failed:', error);
                        alert('서버와 통신 중 오류가 발생했습니다.');
                    }
                });
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
            return;
        }

        detailBox.innerHTML = `<p class="empty-message">${escapeHtml(data.message || '상품 정보를 불러오지 못했습니다.')}</p>`;
    } catch (error) {
        console.error('상품 상세 불러오기 실패:', error);
        detailBox.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
    }
});
