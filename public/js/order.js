document.addEventListener('DOMContentLoaded', async () => {
    const completeOrderBtn = document.getElementById('complete-order-btn');
    const orderProductsBox = document.getElementById('order-products-box');
    const orderProductPrice = document.getElementById('order-product-price');
    const orderTotalPrice = document.getElementById('order-total-price');

    const orderNameInput = document.getElementById('order-name');
    const orderEmailInput = document.getElementById('order-email');
    const orderPhoneInput = document.getElementById('order-phone');
    const orderPasswordInput = document.getElementById('order-password');

    const pathParts = window.location.pathname.split('/');
    const maybeProductId = pathParts[pathParts.length - 1];

    let loggedIn = false;
    let orderItems = [];
    let guestProductId = null;

    function renderOrderItems(items) {
        if (!items || items.length === 0) {
            orderProductsBox.innerHTML = `<p class="empty-message">주문할 상품이 없습니다.</p>`;
            orderProductPrice.textContent = '0원';
            orderTotalPrice.textContent = '0원';
            return;
        }

        const totalPrice = items.reduce((sum, item) => sum + Number(item.price), 0);

        orderProductPrice.textContent = `${totalPrice.toLocaleString()}원`;
        orderTotalPrice.textContent = `${totalPrice.toLocaleString()}원`;

        orderProductsBox.innerHTML = items.map(item => `
            <article class="order-product">
                <div class="order-product-thumb">
                    <img src="https://via.placeholder.com/280x190?text=Product+${item.product_id || item.id}" alt="${item.title}" />
                </div>

                <div class="order-product-info">
                    <p class="order-product-category">상품</p>
                    <h4 class="order-product-title">${item.title}</h4>
                    <p class="order-product-price">${Number(item.price).toLocaleString()}원</p>
                </div>
            </article>
        `).join('');
    }

    try {
        const meResponse = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });

        const meData = await meResponse.json();
        loggedIn = !!meData.loggedIn;
    } catch (error) {
        console.error('로그인 상태 확인 실패:', error);
    }

    if (loggedIn && maybeProductId === 'order-page') {
        try {
            const cartResponse = await fetch('/api/cart', {
                method: 'GET',
                credentials: 'include'
            });

            const cartData = await cartResponse.json();

            if (cartData.success) {
                orderItems = cartData.items;
                renderOrderItems(orderItems);
            } else {
                orderProductsBox.innerHTML = `<p class="empty-message">${cartData.message || '주문 상품을 불러오지 못했습니다.'}</p>`;
            }
        } catch (error) {
            console.error('회원 주문용 장바구니 조회 실패:', error);
            orderProductsBox.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
        }
    } else {
        guestProductId = maybeProductId;

        try {
            const response = await fetch(`/api/products/${guestProductId}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                orderItems = [data.product];
                renderOrderItems(orderItems);
            } else {
                orderProductsBox.innerHTML = `<p class="empty-message">${data.message || '상품 정보를 불러오지 못했습니다.'}</p>`;
            }
        } catch (error) {
            console.error('비회원 주문용 상품 조회 실패:', error);
            orderProductsBox.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
        }
    }

    completeOrderBtn.addEventListener('click', async () => {
        try {
            let response;

            if (loggedIn && !guestProductId) {
                response = await fetch('/api/orders', {
                    method: 'POST',
                    credentials: 'include'
                });
            } else {
                const guestName = orderNameInput.value.trim();
                const guestEmail = orderEmailInput.value.trim();
                const guestPhone = orderPhoneInput.value.trim();
                const guestOrderPassword = orderPasswordInput.value.trim();

                if (!guestName || !guestEmail || !guestPhone || !guestOrderPassword) {
                    alert('비회원 주문 시 이름, 이메일, 연락처, 주문조회 비밀번호를 모두 입력해주세요.');
                    return;
                }

                response = await fetch('/api/guest-orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        productId: guestProductId,
                        guestName,
                        guestEmail,
                        guestPhone,
                        guestOrderPassword
                    })
                });
            }

            const data = await response.json();

            if (data.success) {
                sessionStorage.setItem('lastOrderNumber', data.orderNumber);
                sessionStorage.setItem('lastOrderTotalPrice', data.totalPrice);
                window.location.href = '/order-complete-page';
            } else {
                alert(data.message || '주문에 실패했습니다.');
            }
        } catch (error) {
            console.error('주문 요청 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });
});