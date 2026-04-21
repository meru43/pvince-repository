document.addEventListener('DOMContentLoaded', async () => {
    const cartListBox = document.getElementById('cart-list-box');
    const summaryProductPrice = document.getElementById('summary-product-price');
    const summaryTotalPrice = document.getElementById('summary-total-price');
    const orderBtn = document.getElementById('order-btn');

    async function removeCartItem(cartId) {
        try {
            const response = await fetch(`/api/cart/${cartId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                loadCart();
            } else {
                alert(data.message || '장바구니 삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('장바구니 삭제 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    }

    function renderCart(items) {
        if (!items || items.length === 0) {
            cartListBox.innerHTML = `<p class="empty-message">장바구니에 담긴 상품이 없습니다.</p>`;
            summaryProductPrice.textContent = '0원';
            summaryTotalPrice.textContent = '0원';
            return;
        }

        const totalPrice = items.reduce((sum, item) => sum + Number(item.price), 0);

        summaryProductPrice.textContent = `${totalPrice.toLocaleString()}원`;
        summaryTotalPrice.textContent = `${totalPrice.toLocaleString()}원`;

        cartListBox.innerHTML = items.map(item => `
            <article class="cart-item">
                <div class="cart-thumb">
                    <img src="https://via.placeholder.com/320x220?text=Product+${item.product_id}" alt="${item.title}" />
                </div>

                <div class="cart-info">
                    <p class="cart-category">상품</p>
                    <h3 class="cart-title">${item.title}</h3>
                    <p class="cart-desc">${item.description || '상품 설명이 없습니다.'}</p>
                </div>

                <div class="cart-side">
                    <p class="cart-price">${Number(item.price).toLocaleString()}원</p>
                    <button type="button" class="btn btn-outline remove-btn" data-id="${item.cart_id}">삭제</button>
                </div>
            </article>
        `).join('');

        const removeButtons = document.querySelectorAll('.remove-btn');

        removeButtons.forEach(button => {
            button.addEventListener('click', () => {
                removeCartItem(button.dataset.id);
            });
        });
    }

    async function loadCart() {
        try {
            const response = await fetch('/api/cart', {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                renderCart(data.items);
            } else {
                cartListBox.innerHTML = `<p class="empty-message">${data.message || '장바구니를 불러오지 못했습니다.'}</p>`;
            }
        } catch (error) {
            console.error('장바구니 불러오기 실패:', error);
            cartListBox.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
        }
    }

    orderBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                sessionStorage.setItem('lastOrderNumber', data.orderNumber);
                sessionStorage.setItem('lastOrderTotalPrice', data.totalPrice);
                window.location.href = '/order-complete-page';
            } else {
                alert(data.message || '주문에 실패했습니다.');
            }
        } catch (error) {
            console.error('주문 생성 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    loadCart();
});