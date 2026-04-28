document.addEventListener('DOMContentLoaded', async () => {
    const detailBox = document.getElementById('product-detail-box');
    const descriptionBox = document.getElementById('product-description-box');
    const descriptionContent = document.getElementById('product-description');
    const keywordsBox = document.getElementById('product-keywords');

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

    function getDisplayPrice(product) {
        if (Number(product.is_free) === 1) {
            return '무료';
        }

        if (product.sale_price) {
            return `${Number(product.sale_price).toLocaleString()}원`;
        }

        return `${Number(product.price || 0).toLocaleString()}원`;
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
                            name: item.name || product.title,
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
            path: `https://via.placeholder.com/800x520?text=Product+${product.id}`,
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
            return;
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
        const summaryText = product.ai_summary_text || htmlToPlainText(product.description || '') || '';
        const descriptionHtml = normalizeDescriptionHtml(product.description || product.ai_summary_text || '');
        const keywordHtml = (product.keywordList || [])
            .map((keyword) => `<span class="keyword-tag">${escapeHtml(keyword)}</span>`)
            .join('');

        const galleryImages = parseThumbnailGallery(product);
        const displayPrice = getDisplayPrice(product);
        const originalPriceHtml = (
            Number(product.is_free) !== 1
            && product.sale_price
            && Number(product.price) > Number(product.sale_price)
        )
            ? `<p class="detail-original-price">${Number(product.price).toLocaleString()}원</p>`
            : '';

        const ownerTagHtml = product.is_owner
            ? '<span class="detail-owner-tag">본인 상품</span>'
            : '';

        const adminDownloadHtml = product.is_admin
            ? `
                <div class="detail-admin-download">
                    <button type="button" class="btn btn-primary" id="admin-download-toggle">다운로드</button>
                    <div class="detail-download-list" id="detail-download-list" hidden>
                        ${parseProductFiles(product).map((file, index) => `
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
            <div class="detail-gallery">
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
                    <button type="button" class="detail-swiper-nav detail-swiper-prev" aria-label="이전 이미지">&lt;</button>
                    <button type="button" class="detail-swiper-nav detail-swiper-next" aria-label="다음 이미지">&gt;</button>
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
            </div>

            <div class="detail-content">
                <p class="detail-category">상품 상세</p>
                ${ownerTagHtml}
                <h2 class="detail-title">${escapeHtml(product.title)}</h2>
                ${originalPriceHtml}
                <p class="detail-price">${displayPrice}</p>

                <div class="detail-summary">
                    <p>${escapeHtml(summaryText || '상품 설명이 없습니다.')}</p>
                </div>

                <ul class="detail-meta">
                    <li><strong>상품 번호</strong> <span>${product.id}</span></li>
                    <li><strong>업로더</strong> <span>${escapeHtml(product.uploader_name || '미정')}</span></li>
                    <li><strong>가격</strong> <span>${displayPrice}</span></li>
                </ul>

                <div class="detail-actions">
                    ${actionHtml}
                </div>
            </div>
        `;

        descriptionContent.innerHTML = `<div class="detail-description-body">${descriptionHtml}</div>`;

        if (keywordsBox) {
            keywordsBox.innerHTML = keywordHtml;
        }

        descriptionBox.style.display = 'block';
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
