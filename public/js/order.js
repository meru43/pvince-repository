document.addEventListener('DOMContentLoaded', async () => {
    const completeOrderBtn = document.getElementById('complete-order-btn');
    const orderProductsBox = document.getElementById('order-products-box');
    const orderProductPrice = document.getElementById('order-product-price');
    const orderTotalPrice = document.getElementById('order-total-price');

    const orderNameInput = document.getElementById('order-name');
    const orderEmailInput = document.getElementById('order-email');
    const orderPhoneInput = document.getElementById('order-phone');
    const orderPasswordInput = document.getElementById('order-password');

    const guestOrderForm = document.getElementById('guest-order-form');
    const memberOrderNotice = document.getElementById('member-order-notice');

    const pathParts = window.location.pathname.split('/');
    const maybeProductId = pathParts[pathParts.length - 1];

    let loggedIn = false;
    let orderItems = [];
    let directProductId = null;

    function getSelectedPaymentMethod() {
        const checkedInput = document.querySelector('input[name="payment"]:checked');
        return checkedInput?.value || 'card';
    }

    function getDisplayPrice(item) {
        if (Number(item.is_free) === 1) return 0;
        if (item.sale_price !== null && item.sale_price !== undefined && item.sale_price !== '') {
            return Number(item.sale_price);
        }
        return Number(item.price || 0);
    }

    function formatDisplayPrice(item) {
        if (Number(item.is_free) === 1) return '무료';
        return `${getDisplayPrice(item).toLocaleString()}원`;
    }

    function getThumbSrc(item) {
        if (item.thumbnail_path && String(item.thumbnail_path).trim() !== '') {
            return item.thumbnail_path;
        }

        return `https://via.placeholder.com/280x190?text=Product+${item.product_id || item.id}`;
    }

    function renderOrderItems(items) {
        if (!items || items.length === 0) {
            orderProductsBox.innerHTML = `<p class="empty-message">주문할 상품이 없습니다.</p>`;
            orderProductPrice.textContent = '0원';
            orderTotalPrice.textContent = '0원';
            return;
        }

        const totalPrice = items.reduce((sum, item) => sum + getDisplayPrice(item), 0);

        orderProductPrice.textContent = `${totalPrice.toLocaleString()}원`;
        orderTotalPrice.textContent = `${totalPrice.toLocaleString()}원`;

        orderProductsBox.innerHTML = items.map((item) => `
            <article class="order-product">
                <div class="order-product-thumb">
                    <img src="${getThumbSrc(item)}" alt="${item.title}" />
                </div>

                <div class="order-product-info">
                    <p class="order-product-category">상품</p>
                    <h4 class="order-product-title">${item.title}</h4>
                    <p class="order-product-price">${formatDisplayPrice(item)}</p>
                </div>
            </article>
        `).join('');
    }

    function toggleOrdererForm() {
        if (!guestOrderForm || !memberOrderNotice) return;

        if (loggedIn) {
            guestOrderForm.hidden = true;
            guestOrderForm.style.display = 'none';
            memberOrderNotice.hidden = false;
            memberOrderNotice.style.display = 'block';
            return;
        }

        guestOrderForm.hidden = false;
        guestOrderForm.style.display = 'grid';
        memberOrderNotice.hidden = true;
        memberOrderNotice.style.display = 'none';
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

    toggleOrdererForm();

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
        directProductId = maybeProductId;

        try {
            const response = await fetch(`/api/products/${directProductId}`, {
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
            console.error('단일 주문 상품 조회 실패:', error);
            orderProductsBox.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
        }
    }

    completeOrderBtn.addEventListener('click', async () => {
        try {
            let response;

            if (loggedIn && maybeProductId === 'order-page') {
                response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        paymentMethod: getSelectedPaymentMethod()
                    })
                });
            } else if (loggedIn && directProductId) {
                response = await fetch('/api/orders/direct', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        productId: directProductId,
                        paymentMethod: getSelectedPaymentMethod()
                    })
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
                        productId: directProductId,
                        guestName,
                        guestEmail,
                        guestPhone,
                        guestOrderPassword,
                        paymentMethod: getSelectedPaymentMethod()
                    })
                });
            }

            const data = await response.json();

            if (data.success) {
                sessionStorage.setItem('lastOrderNumber', data.orderNumber);
                sessionStorage.setItem('lastOrderTotalPrice', data.totalPrice);
                window.location.href = '/order-complete-page';
                return;
            }

            alert(data.message || '주문에 실패했습니다.');
        } catch (error) {
            console.error('주문 요청 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });
});
