document.addEventListener('DOMContentLoaded', () => {
    const orderProductsBox = document.getElementById('order-products-box');
    const orderProductPrice = document.getElementById('order-product-price');
    const orderTotalPrice = document.getElementById('order-total-price');
    const completeOrderBtn = document.getElementById('complete-order-btn');

    function getCartItems() {
        const stored = localStorage.getItem('cartItems');
        return stored ? JSON.parse(stored) : [];
    }

    function saveLastOrder(orderData) {
        localStorage.setItem('lastOrder', JSON.stringify(orderData));
    }

    function clearCartItems() {
        localStorage.removeItem('cartItems');
    }

    function createOrderNumber() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        return `${yyyy}${mm}${dd}-${random}`;
    }

    function renderOrderItems(cartItems) {
        if (!cartItems || cartItems.length === 0) {
            orderProductsBox.innerHTML = `<p class="empty-message">주문할 상품이 없습니다.</p>`;
            orderProductPrice.textContent = '0원';
            orderTotalPrice.textContent = '0원';
            return;
        }

        const totalPrice = cartItems.reduce((sum, item) => sum + Number(item.price), 0);

        orderProductPrice.textContent = `${totalPrice.toLocaleString()}원`;
        orderTotalPrice.textContent = `${totalPrice.toLocaleString()}원`;

        orderProductsBox.innerHTML = cartItems.map(item => `
            <article class="order-product">
                <div class="order-product-thumb">
                    <img src="https://via.placeholder.com/280x190?text=Product+${item.id}" alt="${item.title}" />
                </div>

                <div class="order-product-info">
                    <p class="order-product-category">상품</p>
                    <h4 class="order-product-title">${item.title}</h4>
                    <p class="order-product-price">${Number(item.price).toLocaleString()}원</p>
                </div>
            </article>
        `).join('');
    }

    const cartItems = getCartItems();
    renderOrderItems(cartItems);

    completeOrderBtn.addEventListener('click', () => {
        const currentCartItems = getCartItems();

        if (!currentCartItems || currentCartItems.length === 0) {
            alert('주문할 상품이 없습니다.');
            return;
        }

        const totalPrice = currentCartItems.reduce((sum, item) => sum + Number(item.price), 0);

        const lastOrder = {
            orderNumber: createOrderNumber(),
            items: currentCartItems,
            totalPrice: totalPrice,
            orderedAt: new Date().toISOString()
        };

        saveLastOrder(lastOrder);
        clearCartItems();

        window.location.href = '/order-complete-page';
    });
});