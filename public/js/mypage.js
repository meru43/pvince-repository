document.addEventListener('DOMContentLoaded', async () => {
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const accountUsername = document.getElementById('account-username');
    const accountNickname = document.getElementById('account-nickname');
    const accountStatus = document.getElementById('account-status');

    const nicknameInput = document.getElementById('nickname-input');
    const nicknameCheckBtn = document.getElementById('nickname-check-btn');
    const nicknameSaveBtn = document.getElementById('nickname-save-btn');
    const nicknameMessage = document.getElementById('nickname-message');

    const orderCount = document.getElementById('order-count');
    const orderHistoryBox = document.getElementById('order-history-box');

    const purchaseCount = document.getElementById('purchase-count');
    const purchaseListBox = document.getElementById('purchase-list-box');

    const downloadCount = document.getElementById('download-count');
    const downloadHistoryBox = document.getElementById('download-history-box');

    let nicknameChecked = false;
    let checkedNicknameValue = '';

    function formatPrice(value) {
        return `${Number(value || 0).toLocaleString()}원`;
    }

    function getThumbSrc(item) {
        if (item.thumbnailPath && String(item.thumbnailPath).trim() !== '') {
            return item.thumbnailPath;
        }

        if (item.thumbnail_path && String(item.thumbnail_path).trim() !== '') {
            return item.thumbnail_path;
        }

        return `https://via.placeholder.com/160x110?text=Product+${item.productId || item.product_id || ''}`;
    }

    async function loadMyInfo() {
        const meResponse = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });

        const meData = await meResponse.json();

        if (!meData.loggedIn) {
            alert('로그인이 필요합니다.');
            window.location.href = '/login-page';
            return false;
        }

        profileName.textContent = `${meData.nickname || meData.username} 님`;
        profileEmail.textContent = '로그인된 회원입니다.';
        accountUsername.textContent = meData.username;
        accountNickname.textContent = meData.nickname || '-';
        accountStatus.textContent = '로그인됨';

        nicknameInput.value = meData.nickname || '';
        return true;
    }

    async function loadMyOrders() {
        if (!orderHistoryBox || !orderCount) return;

        try {
            const response = await fetch('/api/my-orders', {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                orderHistoryBox.innerHTML = `<p class="empty-message">${data.message || '주문내역을 불러오지 못했습니다.'}</p>`;
                orderCount.textContent = '총 0건';
                return;
            }

            const orders = data.orders || [];
            orderCount.textContent = `총 ${orders.length}건`;

            if (orders.length === 0) {
                orderHistoryBox.innerHTML = `<p class="empty-message">주문내역이 없습니다.</p>`;
                return;
            }

            orderHistoryBox.innerHTML = orders.map(order => `
                <div class="history-row">
                    <div class="history-main">
                        <p><strong>주문번호</strong> ${order.orderNumber}</p>
                        <p><strong>주문상태</strong> ${order.status}</p>
                        <p><strong>주문금액</strong> ${formatPrice(order.totalPrice)}</p>
                        <p><strong>주문일시</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                    </div>

                    <div class="history-items">
                        ${(order.items || []).map(item => `
                            <div class="history-item">
                                <img src="${getThumbSrc(item)}" alt="${item.title}">
                                <div>
                                    <p>${item.title}</p>
                                    <p>${formatPrice(item.price)}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('주문내역 조회 실패:', error);
            orderHistoryBox.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
            orderCount.textContent = '총 0건';
        }
    }

    async function loadMyProducts() {
        if (!purchaseListBox || !purchaseCount) return;

        try {
            const response = await fetch('/my-products', {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                purchaseListBox.innerHTML = `<p class="empty-message">${data.message || '구매한 상품을 불러오지 못했습니다.'}</p>`;
                purchaseCount.textContent = '총 0건';
                return;
            }

            const products = data.products || [];
            purchaseCount.textContent = `총 ${products.length}건`;

            if (products.length === 0) {
                purchaseListBox.innerHTML = `<p class="empty-message">구매한 상품이 없습니다.</p>`;
                return;
            }

            purchaseListBox.innerHTML = products.map(product => `
                <article class="product-card">
                    <a href="/products-page/${product.product_id}" class="product-thumb">
                        <img src="${getThumbSrc(product)}" alt="${product.title}">
                    </a>

                    <div class="product-info">
                        <p class="product-category">구매 완료</p>
                        <h3 class="product-name">
                            <a href="/products-page/${product.product_id}">${product.title}</a>
                        </h3>
                        <p class="product-price">${formatPrice(product.price)}</p>
                        <div class="product-actions">
                            <a href="/download/${product.product_id}" class="btn btn-outline">다운로드</a>
                        </div>
                    </div>
                </article>
            `).join('');
        } catch (error) {
            console.error('구매한 상품 조회 실패:', error);
            purchaseListBox.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
            purchaseCount.textContent = '총 0건';
        }
    }

    async function loadMyDownloadLogs() {
        if (!downloadHistoryBox || !downloadCount) return;

        try {
            const response = await fetch('/my-download-logs', {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                downloadHistoryBox.innerHTML = `<p class="empty-message">${data.message || '다운로드 내역을 불러오지 못했습니다.'}</p>`;
                downloadCount.textContent = '총 0건';
                return;
            }

            const logs = data.logs || [];
            downloadCount.textContent = `총 ${logs.length}건`;

            if (logs.length === 0) {
                downloadHistoryBox.innerHTML = `<p class="empty-message">다운로드 내역이 없습니다.</p>`;
                return;
            }

            downloadHistoryBox.innerHTML = logs.map(log => `
                <div class="history-row">
                    <p><strong>상품명</strong> ${log.title}</p>
                    <p><strong>가격</strong> ${formatPrice(log.sale_price || log.price)}</p>
                    <p><strong>파일명</strong> ${log.file_name || '-'}</p>
                    <p><strong>다운로드 일시</strong> ${new Date(log.downloaded_at).toLocaleString()}</p>
                </div>
            `).join('');
        } catch (error) {
            console.error('다운로드 내역 조회 실패:', error);
            downloadHistoryBox.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
            downloadCount.textContent = '총 0건';
        }
    }

    nicknameInput.addEventListener('input', () => {
        nicknameChecked = false;
        checkedNicknameValue = '';
        nicknameMessage.textContent = '';
    });

    nicknameCheckBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();

        nicknameMessage.textContent = '';

        if (!nickname) {
            nicknameMessage.textContent = '닉네임을 입력해주세요.';
            return;
        }

        try {
            const response = await fetch('/check-nickname', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ nickname })
            });

            const data = await response.json();

            if (data.success) {
                nicknameChecked = true;
                checkedNicknameValue = nickname;
                nicknameMessage.textContent = data.message;
            } else {
                nicknameChecked = false;
                checkedNicknameValue = '';
                nicknameMessage.textContent = data.message || '중복확인에 실패했습니다.';
            }
        } catch (error) {
            console.error('닉네임 중복확인 실패:', error);
            nicknameMessage.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });

    nicknameSaveBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();

        if (!nickname) {
            nicknameMessage.textContent = '닉네임을 입력해주세요.';
            return;
        }

        if (!nicknameChecked || checkedNicknameValue !== nickname) {
            nicknameMessage.textContent = '닉네임 중복확인을 완료해주세요.';
            return;
        }

        try {
            const response = await fetch('/my-nickname', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ nickname })
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                nicknameChecked = false;
                checkedNicknameValue = '';
                nicknameMessage.textContent = '';
                await loadMyInfo();
            } else {
                nicknameMessage.textContent = data.message || '닉네임 변경에 실패했습니다.';
            }
        } catch (error) {
            console.error('닉네임 변경 실패:', error);
            nicknameMessage.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });

    const ok = await loadMyInfo();
    if (!ok) return;

    await loadMyOrders();
    await loadMyProducts();
    await loadMyDownloadLogs();
});