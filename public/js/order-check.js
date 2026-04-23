document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('order-check-form');
    const orderNumberInput = document.getElementById('order-number');
    const orderPasswordInput = document.getElementById('order-password');
    const errorText = document.getElementById('order-check-error');

    const resultBox = document.getElementById('order-result-box');
    const resultInfoBox = document.getElementById('result-info-box');
    const resultProductsBox = document.getElementById('result-products-box');

    function formatDate(dateString) {
        if (!dateString) return '-';

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return dateString;

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');

        return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
    }

    function getThumbSrc(item) {
        if (item.thumbnail_path && String(item.thumbnail_path).trim() !== '') {
            return item.thumbnail_path;
        }

        return `https://via.placeholder.com/280x190?text=Product+${item.product_id}`;
    }

    function renderResult(order, items) {
        resultInfoBox.innerHTML = `
            <div class="result-info-row">
                <span>주문번호</span>
                <strong>${order.orderNumber}</strong>
            </div>
            <div class="result-info-row">
                <span>주문자</span>
                <strong>${order.guestName || '-'}</strong>
            </div>
            <div class="result-info-row">
                <span>결제금액</span>
                <strong>${Number(order.totalPrice).toLocaleString()}원</strong>
            </div>
            <div class="result-info-row">
                <span>주문일시</span>
                <strong>${formatDate(order.createdAt)}</strong>
            </div>
        `;

        resultProductsBox.innerHTML = items.map(item => `
            <div class="result-product-wrap">
                <a
                    href="/products-page/${item.product_id}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="result-product"
                >
                    <div class="result-product-thumb">
                        <img src="${getThumbSrc(item)}" alt="${item.title}" />
                    </div>

                    <div class="result-product-info">
                        <p class="result-product-category">상품</p>
                        <h4 class="result-product-title">${item.title}</h4>
                        <p class="result-product-desc">${item.description || '상품 설명이 없습니다.'}</p>
                    </div>

                    <div class="result-product-side">${Number(item.price).toLocaleString()}원</div>
                </a>

                <div class="result-product-download">
                    <button
                        type="button"
                        class="btn btn-primary guest-download-btn"
                        data-product-id="${item.product_id}"
                    >
                        다운로드
                    </button>
                </div>
            </div>
        `).join('');

        resultBox.style.display = 'block';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const orderNumber = orderNumberInput.value.trim();
        const guestOrderPassword = orderPasswordInput.value.trim();

        errorText.textContent = '';
        resultBox.style.display = 'none';

        if (!orderNumber || !guestOrderPassword) {
            errorText.textContent = '주문번호와 비밀번호를 모두 입력해주세요.';
            return;
        }

        try {
            const response = await fetch('/api/guest-orders/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    orderNumber,
                    guestOrderPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                renderResult(data.order, data.items);
            } else {
                errorText.textContent = data.message || '주문 정보를 조회하지 못했습니다.';
            }
        } catch (error) {
            console.error('비회원 주문조회 실패:', error);
            errorText.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });

    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.guest-download-btn');
        if (!btn) return;

        const productId = btn.dataset.productId;
        const orderNumber = orderNumberInput.value.trim();
        const guestOrderPassword = orderPasswordInput.value.trim();

        if (!orderNumber || !guestOrderPassword || !productId) {
            alert('주문번호와 비밀번호를 다시 확인해주세요.');
            return;
        }

        try {
            const response = await fetch('/api/guest-orders/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    orderNumber,
                    guestOrderPassword,
                    productId
                })
            });

            const contentType = response.headers.get('Content-Type') || '';

            if (contentType.includes('application/json')) {
                const errorData = await response.json();
                alert(errorData.message || '파일 다운로드에 실패했습니다.');
                return;
            }

            if (!response.ok) {
                alert('파일 다운로드에 실패했습니다.');
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const disposition = response.headers.get('Content-Disposition') || '';
            let fileName = 'downloaded-file';

            const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
            const normalMatch = disposition.match(/filename="?([^"]+)"?/i);

            if (utf8Match && utf8Match[1]) {
                fileName = decodeURIComponent(utf8Match[1]);
            } else if (normalMatch && normalMatch[1]) {
                fileName = normalMatch[1];
            }

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('비회원 다운로드 요청 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });
});