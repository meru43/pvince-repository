document.addEventListener('DOMContentLoaded', async () => {
    const cartListBox = document.getElementById('cart-list-box');
    const summaryProductPrice = document.getElementById('summary-product-price');
    const summaryTotalPrice = document.getElementById('summary-total-price');
    const orderBtn = document.getElementById('order-btn');

    function getThumbSrc(item) {
        if (item.thumbnail_path && String(item.thumbnail_path).trim() !== '') {
            return item.thumbnail_path;
        }

        return `https://via.placeholder.com/600x400?text=Product+${item.product_id || ''}`;
    }

    function getItemPrice(item) {
        if (Number(item.is_free) === 1) {
            return 0;
        }

        if (item.sale_price !== null && item.sale_price !== undefined && item.sale_price !== '') {
            return Number(item.sale_price) || 0;
        }

        return Number(item.price) || 0;
    }

    function formatPrice(value) {
        return `${Number(value || 0).toLocaleString()}원`;
    }

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
            cartListBox.innerHTML = '<p class="empty-message">장바구니에 담긴 상품이 없습니다.</p>';
            summaryProductPrice.textContent = '0원';
            summaryTotalPrice.textContent = '0원';
            return;
        }

        const totalPrice = items.reduce((sum, item) => sum + getItemPrice(item), 0);

        summaryProductPrice.textContent = formatPrice(totalPrice);
        summaryTotalPrice.textContent = formatPrice(totalPrice);

        cartListBox.innerHTML = items.map((item) => `
            <article class="cart-item">
                <a href="/products-page/${item.product_id}" class="cart-thumb">
                    <img src="${getThumbSrc(item)}" alt="${item.title}">
                </a>

                <div class="cart-info">
                    <p class="cart-category">상품</p>
                    <h3 class="cart-title">
                        <a href="/products-page/${item.product_id}">${item.title}</a>
                    </h3>
                    <p class="cart-desc">${item.description || '상품 설명이 없습니다.'}</p>
                </div>

                <div class="cart-side">
                    <p class="cart-price">${formatPrice(getItemPrice(item))}</p>
                    <button type="button" class="btn btn-outline remove-btn" data-id="${item.cart_id}">삭제</button>
                </div>
            </article>
        `).join('');

        const removeButtons = document.querySelectorAll('.remove-btn');

        removeButtons.forEach((button) => {
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
            cartListBox.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
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
