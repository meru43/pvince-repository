document.addEventListener('DOMContentLoaded', async () => {
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const accountUsername = document.getElementById('account-username');
    const accountStatus = document.getElementById('account-status');

    const purchaseCount = document.getElementById('purchase-count');
    const downloadCount = document.getElementById('download-count');

    const purchaseListBox = document.getElementById('purchase-list-box');
    const downloadHistoryBox = document.getElementById('download-history-box');

    const logoutBtn = document.getElementById('logout-btn');

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

    function renderPurchaseList(products) {
        if (!products || products.length === 0) {
            purchaseListBox.innerHTML = `<p class="empty-message">구매한 상품이 없습니다.</p>`;
            purchaseCount.textContent = '총 0건';
            return;
        }

        purchaseCount.textContent = `총 ${products.length}건`;

        purchaseListBox.innerHTML = products.map(product => `
            <article class="purchase-item">
                <div class="purchase-thumb">
                    <img src="https://via.placeholder.com/320x220?text=Product+${product.product_id}" alt="${product.title}">
                </div>

                <div class="purchase-info">
                    <p class="purchase-category">상품</p>
                    <h4 class="purchase-title">${product.title}</h4>
                    <p class="purchase-date">구매일: ${formatDate(product.purchased_at)}</p>
                </div>

                <div class="purchase-side">
                    <p class="purchase-price">${Number(product.price).toLocaleString()}원</p>
                    <a href="/download/${product.product_id}" class="btn btn-primary">다운로드</a>
                </div>
            </article>
        `).join('');
    }

    function renderDownloadLogs(logs) {
        if (!logs || logs.length === 0) {
            downloadHistoryBox.innerHTML = `<p class="empty-message">다운로드 내역이 없습니다.</p>`;
            downloadCount.textContent = '총 0건';
            return;
        }

        downloadCount.textContent = `총 ${logs.length}건`;

        downloadHistoryBox.innerHTML = `
            <div class="history-row history-head">
                <span>다운로드일</span>
                <span>상품명</span>
                <span>파일명</span>
            </div>
            ${logs.map(log => `
                <div class="history-row">
                    <span>${formatDate(log.downloaded_at)}</span>
                    <span>${log.title}</span>
                    <span>${log.file_name}</span>
                </div>
            `).join('')}
        `;
    }

    async function loadMyPage() {
        try {
            const meResponse = await fetch('/me', {
                method: 'GET',
                credentials: 'include'
            });

            const meData = await meResponse.json();

            if (!meData.loggedIn) {
                alert('로그인이 필요합니다.');
                window.location.href = '/login-page';
                return;
            }

            profileName.textContent = `${meData.username} 님`;
            profileEmail.textContent = '로그인된 회원입니다.';
            accountUsername.textContent = meData.username;
            accountStatus.textContent = '로그인됨';

            const productsResponse = await fetch('/my-products', {
                method: 'GET',
                credentials: 'include'
            });

            const productsData = await productsResponse.json();

            if (productsData.success) {
                renderPurchaseList(productsData.products);
            } else {
                purchaseListBox.innerHTML = `<p class="empty-message">${productsData.message || '구매 상품을 불러오지 못했습니다.'}</p>`;
            }

            const logsResponse = await fetch('/my-download-logs', {
                method: 'GET',
                credentials: 'include'
            });

            const logsData = await logsResponse.json();

            if (logsData.success) {
                renderDownloadLogs(logsData.logs);
            } else {
                downloadHistoryBox.innerHTML = `<p class="empty-message">${logsData.message || '다운로드 내역을 불러오지 못했습니다.'}</p>`;
            }

        } catch (error) {
            console.error('마이페이지 불러오기 실패:', error);
            alert('마이페이지 정보를 불러오는 중 오류가 발생했습니다.');
        }
    }

    logoutBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                alert('로그아웃되었습니다.');
                window.location.href = '/login-page';
            } else {
                alert(data.message || '로그아웃에 실패했습니다.');
            }
        } catch (error) {
            console.error('로그아웃 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    await loadMyPage();
});