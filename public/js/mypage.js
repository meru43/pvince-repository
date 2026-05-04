document.addEventListener('DOMContentLoaded', async () => {
    const PURCHASES_PER_PAGE = 6;
    const DEFAULT_PROFILE_IMAGE = '/images/normal user.jpg';
    const closeButtonSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="icon icon-tabler icons-tabler-filled icon-tabler-x" aria-hidden="true" focusable="false">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M6.707 5.293l5.293 5.292l5.293 -5.292a1 1 0 0 1 1.414 1.414l-5.292 5.293l5.292 5.293a1 1 0 0 1 -1.414 1.414l-5.293 -5.292l-5.293 5.292a1 1 0 1 1 -1.414 -1.414l5.292 -5.293l-5.292 -5.293a1 1 0 0 1 1.414 -1.414" />
        </svg>
    `.trim();
    const pageRoot = document.querySelector('main.container.page');
    const viewerRole = pageRoot?.dataset.userRole || 'member';

    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileCardImage = document.getElementById('profile-card-image');
    const profileImagePreview = document.getElementById('profile-image-preview');
    const profileImageInput = document.getElementById('profile-image-input');
    const profileImageSaveBtn = document.getElementById('profile-image-save-btn');
    const profileImageMessage = document.getElementById('profile-image-message');

    const accountUsername = document.getElementById('account-username');
    const accountNickname = document.getElementById('account-nickname');
    const accountEmail = document.getElementById('account-email');
    const accountName = document.getElementById('account-name');
    const accountPhone = document.getElementById('account-phone');

    const accountNicknameInput = document.getElementById('account-nickname-input');
    const accountEmailInput = document.getElementById('account-email-input');
    const accountNameInput = document.getElementById('account-name-input');
    const accountPhoneInput = document.getElementById('account-phone-input');

    const purchaseCount = document.getElementById('purchase-count');
    const purchaseListBox = document.getElementById('purchase-list-box');
    const purchasePagination = document.getElementById('purchase-pagination');
    const logoutBtn = document.getElementById('logout-btn');

    const currentPasswordInput = document.getElementById('current-password-input');
    const newPasswordInput = document.getElementById('new-password-input');
    const newPasswordConfirmInput = document.getElementById('new-password-confirm-input');
    const passwordSaveBtn = document.getElementById('password-save-btn');
    const passwordMessage = document.getElementById('password-message');
    const passwordChangeBox = document.querySelector('.password-change-box');

    const sidebarMenuItems = Array.from(document.querySelectorAll('.mypage-menu-item'));
    const managementTabs = Array.from(document.querySelectorAll('.mypage-management-tab'));
    const panels = Array.from(document.querySelectorAll('.mypage-panel'));

    const sellerProductsCount = document.getElementById('seller-products-count');
    const sellerProductsList = document.getElementById('seller-products-list');
    const sellerProductsSearch = document.getElementById('seller-products-search');
    const sellerProductsSearchBtn = document.getElementById('seller-products-search-btn');

    const sellerSalesCount = document.getElementById('seller-sales-count');
    const sellerSalesSummary = document.getElementById('seller-sales-summary');
    const sellerSalesList = document.getElementById('seller-sales-list');
    const sellerSalesSearch = document.getElementById('seller-sales-search');
    const sellerSalesSearchBtn = document.getElementById('seller-sales-search-btn');
    const sellerSettlementRequestBtn = document.getElementById('seller-settlement-request-btn');

    const adminUsersCount = document.getElementById('admin-users-count');
    const adminUsersListInline = document.getElementById('admin-users-list-inline');
    const adminUsersSearch = document.getElementById('admin-users-search');
    const adminUsersSearchBtn = document.getElementById('admin-users-search-btn');

    const adminSettlementsCount = document.getElementById('admin-settlements-count');
    const adminSettlementsListInline = document.getElementById('admin-settlements-list-inline');
    const adminSettlementsSearch = document.getElementById('admin-settlements-search');
    const adminSettlementsSearchBtn = document.getElementById('admin-settlements-search-btn');

    const purchasedProducts = new Map();
    const loadedPanels = new Set(['purchase-list', 'account-info']);

    let profilePreviewUrl = '';
    let purchaseItems = [];
    let currentPurchasePage = 1;
    let currentViewerName = '-';

    function formatPrice(value) {
        return `${Number(value || 0).toLocaleString()}원`;
    }

    function displayValue(value) {
        return value && String(value).trim() !== '' ? value : '-';
    }

    function formatDateTime(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);

        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function escapeHtml(value) {
        return String(value ?? '-')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isValidPassword(password) {
        return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password);
    }

    function getThumbSrc(item) {
        const thumb = item?.thumbnailPath || item?.thumbnail_path || item?.thumbnailPath;
        return thumb && String(thumb).trim() !== ''
            ? thumb
            : `https://via.placeholder.com/160x110?text=Product+${item?.product_id || item?.id || ''}`;
    }

    function getProfileImageSrc(value) {
        return value && String(value).trim() !== '' ? value : DEFAULT_PROFILE_IMAGE;
    }

    function getPaymentMethodLabel(value) {
        if (value === 'bank') return '계좌이체';
        if (value === 'simple') return '간편결제';
        return '신용카드';
    }

    function setProfileImages(src) {
        const profileSrc = src || DEFAULT_PROFILE_IMAGE;

        if (profileCardImage) profileCardImage.src = profileSrc;
        if (profileImagePreview) profileImagePreview.src = profileSrc;

        const headerAvatar = document.getElementById('header-user-avatar-image');
        const headerAvatarLarge = document.getElementById('header-user-avatar-large-image');

        if (headerAvatar) headerAvatar.src = profileSrc;
        if (headerAvatarLarge) headerAvatarLarge.src = profileSrc;
    }

    function getFieldElements(field) {
        return {
            valueEl: document.getElementById(`account-${field}`),
            inputEl: document.getElementById(`account-${field}-input`),
            toggleBtn: document.querySelector(`.account-toggle-btn[data-field="${field}"]`),
            messageEl: document.getElementById(`account-${field}-message`)
        };
    }

    function enterEditMode(field) {
        const { valueEl, inputEl, toggleBtn, messageEl } = getFieldElements(field);
        if (!valueEl || !inputEl || !toggleBtn) return;

        if (messageEl) messageEl.textContent = '';

        valueEl.hidden = true;
        inputEl.hidden = false;
        toggleBtn.textContent = '저장';
        toggleBtn.classList.remove('btn-outline');
        toggleBtn.classList.add('btn-primary');
        toggleBtn.dataset.mode = 'save';
        inputEl.focus();
        inputEl.select?.();
    }

    function exitEditMode(field) {
        const { valueEl, inputEl, toggleBtn } = getFieldElements(field);
        if (!valueEl || !inputEl || !toggleBtn) return;

        valueEl.hidden = false;
        inputEl.hidden = true;
        toggleBtn.textContent = '수정';
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-outline');
        toggleBtn.dataset.mode = 'edit';
    }

    function setPasswordMessage(message = '', isError = false) {
        if (!passwordMessage) return;
        passwordMessage.textContent = message;
        passwordMessage.classList.toggle('is-error', isError);
    }

    function parseProductFiles(product) {
        if (product?.product_files_json) {
            try {
                const parsedFiles = JSON.parse(product.product_files_json);
                if (Array.isArray(parsedFiles)) {
                    return parsedFiles.filter((file) => file?.name && file?.path);
                }
            } catch (error) {
                console.error('상품 파일 목록 파싱 실패:', error);
            }
        }

        if (product?.file_name && product?.file_path) {
            return [{ name: product.file_name, path: product.file_path }];
        }

        return [];
    }

    async function checkNicknameAvailable(nickname) {
        const response = await fetch('/check-nickname', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nickname })
        });

        return response.json();
    }

    function downloadCsv(csvRows, fileName) {
        const csvContent = `\uFEFF${csvRows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function createDownloadModal() {
        const modal = document.createElement('div');
        modal.className = 'download-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="download-modal-backdrop" data-download-modal-close></div>
            <div class="download-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="download-modal-title">
                <div class="download-modal-head">
                    <div>
                        <p class="download-modal-label">DOWNLOAD</p>
                        <h3 class="download-modal-title" id="download-modal-title">다운로드 파일 선택</h3>
                    </div>
                    <button type="button" class="download-modal-close" data-download-modal-close aria-label="팝업 닫기">${closeButtonSvg}</button>
                </div>
                <p class="download-modal-desc" id="download-modal-desc">다운로드할 파일을 선택해주세요.</p>
                <div class="download-file-list" id="download-file-list"></div>
            </div>
        `;

        document.body.appendChild(modal);

        const titleEl = modal.querySelector('#download-modal-title');
        const descEl = modal.querySelector('#download-modal-desc');
        const listEl = modal.querySelector('#download-file-list');

        function closeModal() {
            modal.hidden = true;
            document.body.classList.remove('modal-open');
            listEl.innerHTML = '';
        }

        function openModal(product) {
            const files = parseProductFiles(product);
            titleEl.textContent = product.title || '다운로드 파일 선택';
            descEl.textContent = files.length > 1
                ? '구매한 파일 중 하나를 선택해 다운로드할 수 있습니다.'
                : '다운로드할 파일을 선택해주세요.';

            listEl.innerHTML = files.map((file, index) => `
                <button type="button" class="download-file-item" data-download-file-index="${index}">
                    <strong>${escapeHtml(file.name)}</strong>
                    <span>파일 ${index + 1}</span>
                </button>
            `).join('');

            listEl.querySelectorAll('.download-file-item').forEach((button) => {
                button.addEventListener('click', () => {
                    const fileIndex = Number(button.dataset.downloadFileIndex || 0);
                    closeModal();
                    window.location.href = `/download/${product.product_id}?file=${fileIndex}`;
                });
            });

            modal.hidden = false;
            document.body.classList.add('modal-open');
        }

        modal.addEventListener('click', (event) => {
            if (event.target.closest('[data-download-modal-close]')) {
                closeModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.hidden) {
                closeModal();
            }
        });

        return { openModal };
    }

    function createInvoiceModal() {
        const modal = document.createElement('div');
        modal.className = 'download-modal invoice-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="download-modal-backdrop" data-invoice-modal-close></div>
            <div class="download-modal-dialog invoice-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
                <div class="download-modal-head">
                    <div>
                        <p class="download-modal-label">RECEIPT</p>
                        <h3 class="download-modal-title" id="invoice-modal-title">영수증</h3>
                    </div>
                    <div class="invoice-modal-actions">
                        <button type="button" class="btn btn-outline invoice-save-btn" id="invoice-save-btn">인쇄</button>
                        <button type="button" class="download-modal-close" data-invoice-modal-close aria-label="팝업 닫기">${closeButtonSvg}</button>
                    </div>
                </div>
                <div class="invoice-sheet" id="invoice-sheet"></div>
            </div>
        `;

        document.body.appendChild(modal);

        const sheetEl = modal.querySelector('#invoice-sheet');
        const saveBtn = modal.querySelector('#invoice-save-btn');

        function closeModal() {
            modal.hidden = true;
            document.body.classList.remove('modal-open');
            sheetEl.innerHTML = '';
        }

        function openModal(product) {
            const fileCount = parseProductFiles(product).length;
            const orderNumber = product.order_number || product.product_id || '-';

            sheetEl.innerHTML = `
                <div class="invoice-sheet-head">
                    <div>
                        <p class="invoice-sheet-label">SJ SHOP</p>
                        <div class="invoice-store-name">구매 영수증</div>
                    </div>
                    <span class="invoice-status">구매 완료</span>
                </div>
                <div class="invoice-section">
                    <div class="invoice-row">
                        <span class="invoice-label">구매자</span>
                        <strong class="invoice-value">${escapeHtml(currentViewerName)}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">주문번호</span>
                        <strong class="invoice-value">${escapeHtml(orderNumber)}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">구매일시</span>
                        <strong class="invoice-value">${escapeHtml(formatDateTime(product.created_at))}</strong>
                    </div>
                </div>
                <div class="invoice-section">
                    <div class="invoice-row">
                        <span class="invoice-label">상품명</span>
                        <strong class="invoice-value">${escapeHtml(product.title || '-')}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">파일 수</span>
                        <strong class="invoice-value">${fileCount}개</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">결제수단</span>
                        <strong class="invoice-value">${escapeHtml(getPaymentMethodLabel(product.payment_method))}</strong>
                    </div>
                    <div class="invoice-row total">
                        <span class="invoice-label">결제금액</span>
                        <strong class="invoice-value">${escapeHtml(formatPrice(product.sale_price || product.price))}</strong>
                    </div>
                </div>
            `;

            modal.hidden = false;
            document.body.classList.add('modal-open');
        }

        saveBtn?.addEventListener('click', () => {
            window.print();
        });

        modal.addEventListener('click', (event) => {
            if (event.target.closest('[data-invoice-modal-close]')) {
                closeModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.hidden) {
                closeModal();
            }
        });

        return { openModal };
    }

    const downloadModal = createDownloadModal();
    const invoiceModal = createInvoiceModal();

    function setActivePanel(panelId) {
        panels.forEach((panel) => {
            panel.hidden = panel.id !== panelId;
        });

        sidebarMenuItems.forEach((item) => {
            item.classList.toggle('active', item.dataset.target === panelId);
        });

        managementTabs.forEach((tab) => {
            tab.classList.toggle('is-active', tab.dataset.target === panelId);
        });
    }

    async function ensurePanelLoaded(panelId) {
        if (loadedPanels.has(panelId)) return;

        switch (panelId) {
            case 'seller-products':
                await loadSellerProducts();
                break;
            case 'seller-sales':
                await loadSellerSales();
                break;
            case 'admin-users':
                await loadAdminUsers();
                break;
            case 'admin-settlements':
                await loadAdminSettlements();
                break;
            default:
                break;
        }

        loadedPanels.add(panelId);
    }

    function bindPanelSwitcher(buttons) {
        buttons.forEach((button) => {
            button.addEventListener('click', async () => {
                const target = button.dataset.target;
                if (!target) return;
                setActivePanel(target);
                await ensurePanelLoaded(target);
            });
        });
    }

    function renderPurchasePagination(totalPages) {
        if (!purchasePagination) return;

        if (totalPages <= 1) {
            purchasePagination.innerHTML = '';
            return;
        }

        const pageButtons = Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            return `
                <button
                    type="button"
                    class="mypage-pagination-btn${page === currentPurchasePage ? ' is-active' : ''}"
                    data-page="${page}"
                >
                    ${page}
                </button>
            `;
        }).join('');

        purchasePagination.innerHTML = `
            <button type="button" class="mypage-pagination-btn" data-page-move="prev" ${currentPurchasePage === 1 ? 'disabled' : ''}>이전</button>
            ${pageButtons}
            <button type="button" class="mypage-pagination-btn" data-page-move="next" ${currentPurchasePage === totalPages ? 'disabled' : ''}>다음</button>
        `;
    }

    function renderPurchasePage() {
        if (!purchaseListBox || !purchaseCount) return;

        purchaseCount.textContent = `총 ${purchaseItems.length}건`;

        if (!purchaseItems.length) {
            purchaseListBox.innerHTML = '<p class="empty-message">구매한 상품이 없습니다.</p>';
            renderPurchasePagination(1);
            return;
        }

        const totalPages = Math.max(1, Math.ceil(purchaseItems.length / PURCHASES_PER_PAGE));
        currentPurchasePage = Math.min(currentPurchasePage, totalPages);

        const startIndex = (currentPurchasePage - 1) * PURCHASES_PER_PAGE;
        const visibleItems = purchaseItems.slice(startIndex, startIndex + PURCHASES_PER_PAGE);

        purchaseListBox.innerHTML = visibleItems.map((product) => {
            const files = parseProductFiles(product);
            const fileCountText = files.length > 1 ? `${files.length}개 파일` : '1개 파일';

            return `
                <article class="product-card-wrap">
                    <a href="/products-page/${product.product_id}" target="_blank" rel="noopener noreferrer" class="product-card">
                        <div class="product-thumb">
                            <img src="${getThumbSrc(product)}" alt="${escapeHtml(product.title)}">
                        </div>

                        <div class="product-info">
                            <p class="product-category">구매 완료</p>
                            <h3 class="product-name">${escapeHtml(product.title)}</h3>
                            <p class="product-price">${formatPrice(product.sale_price || product.price)}</p>
                            <p class="purchase-file-count">${fileCountText}</p>
                        </div>
                    </a>

                    <div class="product-download-area">
                        <button type="button" class="btn btn-outline purchase-download-btn" data-product-id="${product.product_id}">다운로드</button>
                        <button type="button" class="btn btn-outline purchase-invoice-btn" data-product-id="${product.product_id}">영수증</button>
                    </div>
                </article>
            `;
        }).join('');

        renderPurchasePagination(totalPages);
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

        const roleTextMap = {
            member: '일반회원입니다.',
            seller: '판매자회원입니다.',
            admin: '관리자회원입니다.'
        };

        setProfileImages(meData.profileImage);

        if (profileName) profileName.textContent = meData.nickname || meData.username || '회원';
        currentViewerName = meData.nickname || meData.name || meData.username || '-';
        if (profileEmail) profileEmail.textContent = roleTextMap[meData.role] || '회원입니다.';
        if (accountUsername) accountUsername.textContent = displayValue(meData.username);
        if (accountNickname) accountNickname.textContent = displayValue(meData.nickname);
        if (accountEmail) accountEmail.textContent = displayValue(meData.email);
        if (accountName) accountName.textContent = displayValue(meData.name);
        if (accountPhone) accountPhone.textContent = displayValue(meData.phone);

        if (accountNicknameInput) accountNicknameInput.value = meData.nickname || '';
        if (accountEmailInput) accountEmailInput.value = meData.email || '';
        if (accountNameInput) accountNameInput.value = meData.name || '';
        if (accountPhoneInput) accountPhoneInput.value = meData.phone || '';

        if (passwordChangeBox) {
            passwordChangeBox.hidden = Boolean(meData.isGoogleUser);
        }

        return true;
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
                purchaseItems = [];
                purchaseListBox.innerHTML = `<p class="empty-message">${escapeHtml(data.message || '구매한 상품을 불러오지 못했습니다.')}</p>`;
                renderPurchasePage();
                return;
            }

            purchaseItems = data.products || [];
            purchasedProducts.clear();
            purchaseItems.forEach((product) => {
                purchasedProducts.set(String(product.product_id), product);
            });

            currentPurchasePage = 1;
            renderPurchasePage();
        } catch (error) {
            console.error('구매한 상품 조회 실패:', error);
            purchaseItems = [];
            purchaseListBox.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
            renderPurchasePage();
        }
    }

    function renderSellerProducts(products) {
        if (!sellerProductsList || !sellerProductsCount) return;

        sellerProductsCount.textContent = `총 ${products.length}개`;

        if (!products.length) {
            sellerProductsList.innerHTML = '<p class="empty-message">등록된 판매 상품이 없습니다.</p>';
            return;
        }

        sellerProductsList.innerHTML = products.map((product) => {
            const priceText = Number(product.is_free) === 1 ? '무료' : formatPrice(product.price);
            const statusText = Number(product.is_active) === 1 ? '판매중' : '비활성';

            return `
                <article class="management-product-card">
                    <a href="/products-page/${product.id}" class="management-product-thumb" target="_blank" rel="noopener noreferrer">
                        <img src="${getThumbSrc(product)}" alt="${escapeHtml(product.title)}">
                    </a>
                    <div class="management-product-meta">
                        <div class="status-badge ${Number(product.is_active) === 1 ? 'is-active' : ''}">${statusText}</div>
                        <h4 class="management-product-title">${escapeHtml(product.title)}</h4>
                        <p class="management-product-sub">판매자: ${escapeHtml(product.uploader_name || '-')}</p>
                        <p class="management-product-sub">등록일: ${escapeHtml(formatDateTime(product.created_at))}</p>
                        <p class="management-product-price">${priceText}</p>
                    </div>
                    <div class="management-product-actions">
                        <a href="/products-page/${product.id}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">상세보기</a>
                        <a href="/seller-products/edit/${product.id}" class="btn btn-primary">수정</a>
                    </div>
                </article>
            `;
        }).join('');
    }

    async function loadSellerProducts() {
        if (!sellerProductsList) return;

        try {
            const params = new URLSearchParams({
                q: sellerProductsSearch?.value?.trim() || ''
            });

            const response = await fetch(`/api/seller/products?${params.toString()}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                sellerProductsList.innerHTML = `<p class="empty-message">${escapeHtml(data.message || '판매 상품을 불러오지 못했습니다.')}</p>`;
                if (sellerProductsCount) sellerProductsCount.textContent = '총 0개';
                return;
            }

            renderSellerProducts(Array.isArray(data.products) ? data.products : []);
        } catch (error) {
            console.error('판매상품 조회 실패:', error);
            sellerProductsList.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
            if (sellerProductsCount) sellerProductsCount.textContent = '총 0개';
        }
    }

    function renderSellerSales(summary, sales) {
        if (sellerSalesCount) sellerSalesCount.textContent = `총 ${sales.length}건`;

        if (sellerSalesSummary) {
            sellerSalesSummary.innerHTML = `
                <div class="sales-summary-card">
                    <p class="sales-summary-label">정산 대기 건수</p>
                    <p class="sales-summary-value">${Number(summary.pendingCount || 0).toLocaleString()}</p>
                </div>
                <div class="sales-summary-card">
                    <p class="sales-summary-label">총 판매금액</p>
                    <p class="sales-summary-value">${formatPrice(summary.totalSalesAmount || 0)}</p>
                </div>
                <div class="sales-summary-card">
                    <p class="sales-summary-label">수수료</p>
                    <p class="sales-summary-value">${formatPrice(summary.feeAmount || 0)}</p>
                </div>
                <div class="sales-summary-card">
                    <p class="sales-summary-label">예상 정산금액</p>
                    <p class="sales-summary-value">${formatPrice(summary.settlementAmount || 0)}</p>
                </div>
            `;
        }

        if (!sellerSalesList) return;

        if (!sales.length) {
            sellerSalesList.innerHTML = '<tr><td colspan="7" class="empty-message table-empty">판매 내역이 없습니다.</td></tr>';
            return;
        }

        sellerSalesList.innerHTML = sales.map((sale) => {
            const requested = Boolean(sale.settlement_request_id);

            return `
                <tr>
                    <td>${escapeHtml(formatDateTime(sale.created_at))}</td>
                    <td>${escapeHtml(sale.order_number || '-')}</td>
                    <td>${escapeHtml(sale.product_title || '-')}</td>
                    <td>${escapeHtml(sale.buyer_name || '-')}</td>
                    <td>${escapeHtml(sale.payment_method_label || getPaymentMethodLabel(sale.payment_method))}</td>
                    <td>${formatPrice(sale.price)}</td>
                    <td><span class="status-badge ${requested ? 'is-requested' : 'is-pending'}">${requested ? '정산신청 완료' : '정산 대기'}</span></td>
                </tr>
            `;
        }).join('');
    }

    async function loadSellerSales() {
        if (!sellerSalesList) return;

        try {
            const params = new URLSearchParams({
                q: sellerSalesSearch?.value?.trim() || ''
            });

            const response = await fetch(`/api/seller/sales-dashboard?${params.toString()}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                sellerSalesList.innerHTML = `<tr><td colspan="7" class="empty-message table-empty">${escapeHtml(data.message || '판매 내역을 불러오지 못했습니다.')}</td></tr>`;
                if (sellerSalesSummary) sellerSalesSummary.innerHTML = '';
                if (sellerSalesCount) sellerSalesCount.textContent = '총 0건';
                return;
            }

            renderSellerSales(data.summary || {}, Array.isArray(data.sales) ? data.sales : []);

            if (sellerSettlementRequestBtn) {
                sellerSettlementRequestBtn.hidden = viewerRole !== 'seller';
            }
        } catch (error) {
            console.error('판매관리 조회 실패:', error);
            sellerSalesList.innerHTML = '<tr><td colspan="7" class="empty-message table-empty">서버와 통신 중 오류가 발생했습니다.</td></tr>';
            if (sellerSalesSummary) sellerSalesSummary.innerHTML = '';
            if (sellerSalesCount) sellerSalesCount.textContent = '총 0건';
        }
    }

    function renderAdminUsers(users) {
        if (!adminUsersListInline || !adminUsersCount) return;

        adminUsersCount.textContent = `총 ${users.length}명`;

        if (!users.length) {
            adminUsersListInline.innerHTML = '<tr><td colspan="6" class="empty-message table-empty">등록된 회원이 없습니다.</td></tr>';
            return;
        }

        adminUsersListInline.innerHTML = users.map((user) => {
            const isAdmin = user.role === 'admin';
            const isGoogleUser = Boolean(
                (user.google_id && String(user.google_id).trim() !== '')
                || (user.google_email && String(user.google_email).trim() !== '')
            );

            return `
                <tr>
                    <td>
                        <div class="inline-user-cell">
                            <img src="${getProfileImageSrc(user.profile_image)}" alt="${escapeHtml(user.username)} 프로필" class="inline-user-avatar">
                            <div class="inline-user-meta">
                                <strong class="inline-user-name">${escapeHtml(user.nickname || user.username || '-')}</strong>
                                <span class="inline-user-sub">${escapeHtml(user.username || '-')}</span>
                            </div>
                        </div>
                    </td>
                    <td>${escapeHtml(user.email || '-')}</td>
                    <td>${escapeHtml(user.phone || '-')}</td>
                    <td><span class="status-badge">${escapeHtml(user.role || '-')}</span></td>
                    <td><span class="status-badge ${Number(user.is_active) === 1 ? 'is-active' : 'is-pending'}">${Number(user.is_active) === 1 ? '활성' : '중지'}</span></td>
                    <td>
                        ${isAdmin
                            ? '<span class="inline-user-sub">관리자 계정</span>'
                            : `
                                <div class="inline-actions">
                                    <button type="button" class="btn btn-outline inline-role-btn" data-user-id="${user.id}" data-next-role="${user.role === 'seller' ? 'member' : 'seller'}">
                                        ${user.role === 'seller' ? '일반회원 전환' : '판매자 전환'}
                                    </button>
                                    <button type="button" class="btn btn-outline inline-status-btn" data-user-id="${user.id}" data-next-status="${Number(user.is_active) === 1 ? 0 : 1}">
                                        ${Number(user.is_active) === 1 ? '중지' : '활성'}
                                    </button>
                                    ${isGoogleUser ? '' : `<button type="button" class="btn btn-outline inline-password-btn" data-user-id="${user.id}" data-username="${escapeHtml(user.username)}">비밀번호 초기화</button>`}
                                </div>
                            `
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function loadAdminUsers() {
        if (!adminUsersListInline) return;

        try {
            const params = new URLSearchParams({
                q: adminUsersSearch?.value?.trim() || ''
            });

            const response = await fetch(`/api/admin/users?${params.toString()}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                adminUsersListInline.innerHTML = `<tr><td colspan="6" class="empty-message table-empty">${escapeHtml(data.message || '회원 목록을 불러오지 못했습니다.')}</td></tr>`;
                if (adminUsersCount) adminUsersCount.textContent = '총 0명';
                return;
            }

            renderAdminUsers(Array.isArray(data.users) ? data.users : []);
        } catch (error) {
            console.error('회원관리 조회 실패:', error);
            adminUsersListInline.innerHTML = '<tr><td colspan="6" class="empty-message table-empty">서버와 통신 중 오류가 발생했습니다.</td></tr>';
            if (adminUsersCount) adminUsersCount.textContent = '총 0명';
        }
    }

    function renderAdminSettlements(items) {
        if (!adminSettlementsListInline || !adminSettlementsCount) return;

        adminSettlementsCount.textContent = `총 ${items.length}건`;

        if (!items.length) {
            adminSettlementsListInline.innerHTML = '<tr><td colspan="8" class="empty-message table-empty">정산 신청 내역이 없습니다.</td></tr>';
            return;
        }

        adminSettlementsListInline.innerHTML = items.map((item) => `
            <tr>
                <td>${escapeHtml(formatDateTime(item.requested_at))}</td>
                <td>${escapeHtml(item.seller_name || '-')}</td>
                <td>${Number(item.sales_count || 0).toLocaleString()}건</td>
                <td>${formatPrice(item.total_sales_amount)}</td>
                <td>${formatPrice(item.fee_amount)}</td>
                <td>${formatPrice(item.settlement_amount)}</td>
                <td><span class="status-badge is-requested">${escapeHtml(item.status_label || '정산신청 완료')}</span></td>
                <td>
                    <button type="button" class="btn btn-outline inline-settlement-export-btn" data-request-id="${item.id}" data-seller-name="${escapeHtml(item.seller_name || 'seller')}">CSV 출력</button>
                </td>
            </tr>
        `).join('');
    }

    async function loadAdminSettlements() {
        if (!adminSettlementsListInline) return;

        try {
            const params = new URLSearchParams({
                q: adminSettlementsSearch?.value?.trim() || ''
            });

            const response = await fetch(`/api/admin/settlement-requests?${params.toString()}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                adminSettlementsListInline.innerHTML = `<tr><td colspan="8" class="empty-message table-empty">${escapeHtml(data.message || '정산 신청 내역을 불러오지 못했습니다.')}</td></tr>`;
                if (adminSettlementsCount) adminSettlementsCount.textContent = '총 0건';
                return;
            }

            renderAdminSettlements(Array.isArray(data.requests) ? data.requests : []);
        } catch (error) {
            console.error('정산관리 조회 실패:', error);
            adminSettlementsListInline.innerHTML = '<tr><td colspan="8" class="empty-message table-empty">서버와 통신 중 오류가 발생했습니다.</td></tr>';
            if (adminSettlementsCount) adminSettlementsCount.textContent = '총 0건';
        }
    }

    async function exportSettlementRequest(requestId, sellerName) {
        try {
            const response = await fetch(`/api/admin/settlement-requests/${requestId}/items`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                alert(data.message || '정산 내역을 불러오지 못했습니다.');
                return;
            }

            const csvRows = [
                ['정산신청번호', '요청일시', '판매자', '주문번호', '구매일시', '구매자', '상품명', '결제수단', '판매금액'],
                ...(data.items || []).map((item) => [
                    item.request_id || requestId,
                    formatDateTime(item.requested_at),
                    item.seller_name || sellerName || '-',
                    item.order_number || '-',
                    formatDateTime(item.created_at),
                    item.buyer_name || '-',
                    item.product_title || '-',
                    getPaymentMethodLabel(item.payment_method),
                    formatPrice(item.price)
                ])
            ];

            const safeSellerName = String(sellerName || 'seller').replace(/[\\/:*?"<>|]/g, '_');
            downloadCsv(csvRows, `settlement-${requestId}-${safeSellerName}.csv`);
        } catch (error) {
            console.error('정산 CSV 출력 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    }

    async function saveProfileField(field) {
        const nickname = accountNicknameInput?.value.trim() || '';
        const email = accountEmailInput?.value.trim() || '';
        const name = accountNameInput?.value.trim() || '';
        const phone = accountPhoneInput?.value.trim() || '';
        const { messageEl } = getFieldElements(field);
        if (messageEl) messageEl.textContent = '';

        if (!nickname) {
            if (messageEl) messageEl.textContent = '닉네임을 입력해주세요.';
            return;
        }

        if (!email) {
            if (messageEl) messageEl.textContent = '이메일을 입력해주세요.';
            return;
        }

        if (!isValidEmail(email)) {
            if (messageEl) messageEl.textContent = '올바른 이메일 형식을 입력해주세요.';
            return;
        }

        if (field === 'nickname') {
            const checkData = await checkNicknameAvailable(nickname);
            const currentNickname = accountNickname?.textContent?.trim() || '';
            if (!checkData.success && nickname !== currentNickname) {
                if (messageEl) messageEl.textContent = checkData.message || '이미 사용 중인 닉네임입니다.';
                return;
            }
        }

        try {
            const response = await fetch('/my-profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ nickname, email, name, phone })
            });

            const data = await response.json();

            if (!data.success) {
                if (messageEl) messageEl.textContent = data.message || '회원 정보 변경에 실패했습니다.';
                return;
            }

            if (messageEl) messageEl.textContent = '저장되었습니다.';
            await loadMyInfo();
            exitEditMode(field);
        } catch (error) {
            console.error('회원 정보 변경 실패:', error);
            if (messageEl) messageEl.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    }

    bindPanelSwitcher(sidebarMenuItems);
    bindPanelSwitcher(managementTabs);

    profileImageInput?.addEventListener('change', () => {
        const file = profileImageInput.files?.[0];
        if (!profileImageMessage) return;

        profileImageMessage.textContent = '';

        if (profilePreviewUrl) {
            URL.revokeObjectURL(profilePreviewUrl);
            profilePreviewUrl = '';
        }

        if (!file) return;
        profilePreviewUrl = URL.createObjectURL(file);
        setProfileImages(profilePreviewUrl);
    });

    profileImageSaveBtn?.addEventListener('click', async () => {
        const file = profileImageInput?.files?.[0];
        if (!file) {
            if (profileImageMessage) profileImageMessage.textContent = '프로필 이미지를 선택해주세요.';
            return;
        }

        const formData = new FormData();
        formData.append('profileImage', file);

        try {
            const response = await fetch('/my-profile-image', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                if (profileImageMessage) profileImageMessage.textContent = data.message || '프로필 이미지 변경에 실패했습니다.';
                return;
            }

            if (profileImageMessage) profileImageMessage.textContent = data.message;

            if (profilePreviewUrl) {
                URL.revokeObjectURL(profilePreviewUrl);
                profilePreviewUrl = '';
            }

            setProfileImages(data.profileImage);
            if (profileImageInput) profileImageInput.value = '';
        } catch (error) {
            console.error('프로필 이미지 변경 실패:', error);
            if (profileImageMessage) profileImageMessage.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });

    sellerProductsSearchBtn?.addEventListener('click', async () => {
        await loadSellerProducts();
    });

    sellerProductsSearch?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await loadSellerProducts();
        }
    });

    sellerSalesSearchBtn?.addEventListener('click', async () => {
        await loadSellerSales();
    });

    sellerSalesSearch?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await loadSellerSales();
        }
    });

    sellerSettlementRequestBtn?.addEventListener('click', async () => {
        if (!window.confirm('정산 신청을 진행할까요?')) return;

        try {
            const response = await fetch('/api/seller/settlement-requests', {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();
            alert(data.message || (data.success ? '정산 신청이 완료되었습니다.' : '정산 신청에 실패했습니다.'));

            if (data.success) {
                await loadSellerSales();
            }
        } catch (error) {
            console.error('정산 신청 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    adminUsersSearchBtn?.addEventListener('click', async () => {
        await loadAdminUsers();
    });

    adminUsersSearch?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await loadAdminUsers();
        }
    });

    adminSettlementsSearchBtn?.addEventListener('click', async () => {
        await loadAdminSettlements();
    });

    adminSettlementsSearch?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await loadAdminSettlements();
        }
    });

    document.addEventListener('click', async (event) => {
        const toggleBtn = event.target.closest('.account-toggle-btn');
        if (toggleBtn) {
            const field = toggleBtn.dataset.field;
            const mode = toggleBtn.dataset.mode || 'edit';
            if (mode === 'edit') {
                enterEditMode(field);
                return;
            }
            if (mode === 'save') {
                await saveProfileField(field);
            }
            return;
        }

        const downloadBtn = event.target.closest('.purchase-download-btn');
        if (downloadBtn) {
            const product = purchasedProducts.get(String(downloadBtn.dataset.productId || ''));
            if (!product) {
                alert('다운로드할 상품 정보를 찾을 수 없습니다.');
                return;
            }

            const files = parseProductFiles(product);
            if (!files.length) {
                alert('다운로드할 파일이 없습니다.');
                return;
            }

            downloadModal.openModal(product);
            return;
        }

        const invoiceBtn = event.target.closest('.purchase-invoice-btn');
        if (invoiceBtn) {
            const product = purchasedProducts.get(String(invoiceBtn.dataset.productId || ''));
            if (!product) {
                alert('영수증 정보를 찾을 수 없습니다.');
                return;
            }

            invoiceModal.openModal(product);
            return;
        }

        const paginationBtn = event.target.closest('.mypage-pagination-btn');
        if (paginationBtn && purchasePagination?.contains(paginationBtn)) {
            const totalPages = Math.max(1, Math.ceil(purchaseItems.length / PURCHASES_PER_PAGE));
            const moveType = paginationBtn.dataset.pageMove;

            if (moveType === 'prev') {
                currentPurchasePage = Math.max(1, currentPurchasePage - 1);
                renderPurchasePage();
                return;
            }

            if (moveType === 'next') {
                currentPurchasePage = Math.min(totalPages, currentPurchasePage + 1);
                renderPurchasePage();
                return;
            }

            const nextPage = Number(paginationBtn.dataset.page || 1);
            if (!Number.isNaN(nextPage)) {
                currentPurchasePage = nextPage;
                renderPurchasePage();
            }
            return;
        }

        const roleBtn = event.target.closest('.inline-role-btn');
        if (roleBtn) {
            const userId = roleBtn.dataset.userId;
            const nextRole = roleBtn.dataset.nextRole;

            try {
                const response = await fetch(`/api/admin/users/${userId}/role`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ role: nextRole })
                });

                const data = await response.json();
                alert(data.message || (data.success ? '회원 권한이 변경되었습니다.' : '회원 권한 변경에 실패했습니다.'));
                if (data.success) {
                    await loadAdminUsers();
                }
            } catch (error) {
                console.error('회원 권한 변경 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }
            return;
        }

        const statusBtn = event.target.closest('.inline-status-btn');
        if (statusBtn) {
            const userId = statusBtn.dataset.userId;
            const nextStatus = Number(statusBtn.dataset.nextStatus || 0);

            try {
                const response = await fetch(`/api/admin/users/${userId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ isActive: nextStatus })
                });

                const data = await response.json();
                alert(data.message || (data.success ? '회원 상태가 변경되었습니다.' : '회원 상태 변경에 실패했습니다.'));
                if (data.success) {
                    await loadAdminUsers();
                }
            } catch (error) {
                console.error('회원 상태 변경 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }
            return;
        }

        const passwordBtn = event.target.closest('.inline-password-btn');
        if (passwordBtn) {
            const userId = passwordBtn.dataset.userId;
            try {
                const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
                    method: 'PATCH',
                    credentials: 'include'
                });

                const data = await response.json();
                if (!data.success) {
                    alert(data.message || '비밀번호 초기화에 실패했습니다.');
                    return;
                }

                alert(`임시 비밀번호: ${data.tempPassword}`);
                await loadAdminUsers();
            } catch (error) {
                console.error('비밀번호 초기화 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }
            return;
        }

        const exportBtn = event.target.closest('.inline-settlement-export-btn');
        if (exportBtn) {
            const requestId = Number(exportBtn.dataset.requestId || 0);
            const sellerName = exportBtn.dataset.sellerName || 'seller';

            if (!requestId) {
                alert('정산 요청 정보를 찾을 수 없습니다.');
                return;
            }

            await exportSettlementRequest(requestId, sellerName);
        }
    });

    logoutBtn?.addEventListener('click', async () => {
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                alert(data.message || '로그아웃에 실패했습니다.');
                return;
            }

            window.location.href = '/';
        } catch (error) {
            console.error('로그아웃 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    passwordSaveBtn?.addEventListener('click', async () => {
        const currentPassword = currentPasswordInput?.value.trim() || '';
        const newPassword = newPasswordInput?.value.trim() || '';
        const newPasswordConfirm = newPasswordConfirmInput?.value.trim() || '';

        setPasswordMessage('');

        if (!currentPassword || !newPassword || !newPasswordConfirm) {
            setPasswordMessage('모든 비밀번호 항목을 입력해주세요.', true);
            return;
        }

        if (newPassword !== newPasswordConfirm) {
            setPasswordMessage('새 비밀번호가 일치하지 않습니다.', true);
            return;
        }

        if (!isValidPassword(newPassword)) {
            setPasswordMessage('영문과 숫자를 포함한 8자 이상으로 입력해주세요.', true);
            return;
        }

        try {
            const response = await fetch('/my-password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (!data.success) {
                setPasswordMessage(data.message || '비밀번호 변경에 실패했습니다.', true);
                return;
            }

            setPasswordMessage(data.message || '비밀번호가 변경되었습니다.');

            if (currentPasswordInput) currentPasswordInput.value = '';
            if (newPasswordInput) newPasswordInput.value = '';
            if (newPasswordConfirmInput) newPasswordConfirmInput.value = '';
        } catch (error) {
            console.error('비밀번호 변경 실패:', error);
            setPasswordMessage('서버와 통신 중 오류가 발생했습니다.', true);
        }
    });

    const ok = await loadMyInfo();
    if (!ok) return;

    if (currentPasswordInput) currentPasswordInput.placeholder = '현재 비밀번호';
    if (newPasswordInput) newPasswordInput.placeholder = '영문+숫자 포함 8자 이상';
    if (newPasswordConfirmInput) newPasswordConfirmInput.placeholder = '새 비밀번호 확인';

    setPasswordMessage('');
    await loadMyProducts();
    setActivePanel('purchase-list');
});
