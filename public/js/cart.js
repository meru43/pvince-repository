document.addEventListener('DOMContentLoaded', () => {
    const cartListBox = document.getElementById('cart-list-box');
    const summaryProductPrice = document.getElementById('summary-product-price');
    const summaryTotalPrice = document.getElementById('summary-total-price');
    const orderBtn = document.getElementById('order-btn');

    function getCartItems() {
        const stored = localStorage.getItem('cartItems');
        return stored ? JSON.parse(stored) : [];
    }

    function saveCartItems(items) {
        localStorage.setItem('cartItems', JSON.stringify(items));
    }

    function removeCartItem(productId) {
        const cartItems = getCartItems().filter(item => Number(item.id) !== Number(productId));
        saveCartItems(cartItems);
        renderCart();
    }

    function renderCart() {
        const cartItems = getCartItems();

        if (!cartItems || cartItems.length === 0) {
            cartListBox.innerHTML = `<p class="empty-message">장바구니에 담긴 상품이 없습니다.</p>`;
            summaryProductPrice.textContent = '0원';
            summaryTotalPrice.textContent = '0원';
            orderBtn.addEventListener('click', (e) => {
                e.preventDefault();
                alert('장바구니가 비어 있습니다.');
            }, { once: true });
            return;
        }

        const totalPrice = cartItems.reduce((sum, item) => sum + Number(item.price), 0);

        summaryProductPrice.textContent = `${totalPrice.toLocaleString()}원`;
        summaryTotalPrice.textContent = `${totalPrice.toLocaleString()}원`;

        cartListBox.innerHTML = cartItems.map(item => `
            <article class="cart-item">
                <div class="cart-thumb">
                    <img src="https://via.placeholder.com/320x220?text=Product+${item.id}" alt="${item.title}" />
                </div>

                <div class="cart-info">
                    <p class="cart-category">상품</p>
                    <h3 class="cart-title">${item.title}</h3>
                    <p class="cart-desc">${item.description || '상품 설명이 없습니다.'}</p>
                </div>

                <div class="cart-side">
                    <p class="cart-price">${Number(item.price).toLocaleString()}원</p>
                    <button type="button" class="btn btn-outline remove-btn" data-id="${item.id}">삭제</button>
                </div>
            </article>
        `).join('');

        const removeButtons = document.querySelectorAll('.remove-btn');

        removeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const productId = button.dataset.id;
                removeCartItem(productId);
            });
        });
    }

    orderBtn.addEventListener('click', (e) => {
        const cartItems = getCartItems();

        if (!cartItems || cartItems.length === 0) {
            e.preventDefault();
            alert('장바구니가 비어 있습니다.');
        }
    });

    renderCart();
});