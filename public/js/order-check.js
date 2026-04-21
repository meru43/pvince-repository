document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('order-check-form');
    const orderNumberInput = document.getElementById('order-number');
    const orderEmailInput = document.getElementById('order-email');
    const errorText = document.getElementById('order-check-error');

    const resultBox = document.getElementById('order-result-box');
    const resultInfoBox = document.getElementById('result-info-box');
    const resultProductsBox = document.getElementById('result-products-box');

    function getLastOrder() {
        const stored = localStorage.getItem('lastOrder');
        return stored ? JSON.parse(stored) : null;
    }

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

    function renderResult(orderData) {
        resultInfoBox.innerHTML = `
            <div class="result-info-row">
                <span>주문번호</span>
                <strong>${orderData.orderNumber}</strong>
            </div>
            <div class="result-info-row">
                <span>주문일시</span>
                <strong>${formatDate(orderData.orderedAt)}</strong>
            </div>
            <div class="result-info-row">
                <span>결제금액</span>
                <strong>${Number(orderData.totalPrice).toLocaleString()}원</strong>
            </div>
        `;

        resultProductsBox.innerHTML = orderData.items.map(item => `
            <div class="result-product">
                <div class="result-product-thumb">
                    <img src="https://via.placeholder.com/280x190?text=Product+${item.id}" alt="${item.title}" />
                </div>

                <div class="result-product-info">
                    <p class="result-product-category">상품</p>
                    <h4 class="result-product-title">${item.title}</h4>
                    <p class="result-product-desc">${item.description || '상품 설명이 없습니다.'}</p>
                </div>

                <div class="result-product-side">
                    <span class="btn btn-outline">${Number(item.price).toLocaleString()}원</span>
                </div>
            </div>
        `).join('');

        resultBox.style.display = 'block';
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const inputOrderNumber = orderNumberInput.value.trim();
        const inputEmail = orderEmailInput.value.trim();

        errorText.textContent = '';
        resultBox.style.display = 'none';

        if (!inputOrderNumber || !inputEmail) {
            errorText.textContent = '주문번호와 이메일을 모두 입력해주세요.';
            return;
        }

        const lastOrder = getLastOrder();

        if (!lastOrder) {
            errorText.textContent = '조회 가능한 주문 정보가 없습니다.';
            return;
        }

        if (inputOrderNumber !== lastOrder.orderNumber) {
            errorText.textContent = '주문번호가 일치하지 않습니다.';
            return;
        }

        renderResult(lastOrder);
    });
});