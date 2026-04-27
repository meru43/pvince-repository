document.addEventListener('DOMContentLoaded', async () => {
    const PURCHASES_PER_PAGE = 6;

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

    const purchasedProducts = new Map();
    let profilePreviewUrl = '';
    let purchaseItems = [];
    let currentPurchasePage = 1;

    function formatPrice(value) {
        return `${Number(value || 0).toLocaleString()}원`;
    }

    function displayValue(value) {
        return value && String(value).trim() !== '' ? value : '-';
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isValidPassword(password) {
        return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password);
    }

    function setPasswordMessage(message = '', isError = false) {
        if (!passwordMessage) {
            return;
        }

        passwordMessage.textContent = message;
        passwordMessage.classList.toggle('is-error', isError);
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

    function setProfileImages(src) {
        const profileSrc = src || '/images/normal user.jpg';

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
            return [{
                name: product.file_name,
                path: product.file_path
            }];
        }

        return [];
    }

    function enterEditMode(field) {
        const { valueEl, inputEl, toggleBtn, messageEl } = getFieldElements(field);

        if (!valueEl || !inputEl || !toggleBtn) {
            return;
        }

        if (messageEl) {
            messageEl.textContent = '';
        }

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

        if (!valueEl || !inputEl || !toggleBtn) {
            return;
        }

        valueEl.hidden = false;
        inputEl.hidden = true;
        toggleBtn.textContent = '수정';
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-outline');
        toggleBtn.dataset.mode = 'edit';
    }

    async function checkNicknameAvailable(nickname) {
        const response = await fetch('/check-nickname', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ nickname })
        });

        return response.json();
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
                    <button type="button" class="download-modal-close" data-download-modal-close aria-label="팝업 닫기">X</button>
                </div>
                <p class="download-modal-desc" id="download-modal-desc">다운로드할 파일을 선택해 주세요.</p>
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
                ? '구매한 파일 중 하나를 선택해서 다운로드할 수 있습니다.'
                : '다운로드할 파일을 선택해 주세요.';

            listEl.innerHTML = files.map((file, index) => `
                <button type="button" class="download-file-item" data-download-file-index="${index}">
                    <strong>${file.name}</strong>
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

    const downloadModal = createDownloadModal();

    function renderPurchasePagination(totalPages) {
        if (!purchasePagination) {
            return;
        }

        purchasePagination.innerHTML = `
            <button type="button" class="mypage-pagination-btn" data-page-move="prev" ${currentPurchasePage === 1 ? 'disabled' : ''}>이전</button>
            ${Array.from({ length: totalPages }, (_, index) => {
                const page = index + 1;
                return `
                    <button type="button" class="mypage-pagination-btn ${page === currentPurchasePage ? 'is-active' : ''}" data-page="${page}">
                        ${page}
                    </button>
                `;
            }).join('')}
            <button type="button" class="mypage-pagination-btn" data-page-move="next" ${currentPurchasePage === totalPages ? 'disabled' : ''}>다음</button>
        `;
    }

    function renderPurchasePage() {
        if (!purchaseListBox || !purchaseCount) {
            return;
        }

        purchaseCount.textContent = `총 ${purchaseItems.length}건`;

        if (!purchaseItems.length) {
            purchaseListBox.innerHTML = '<p class="empty-message">구매한 상품이 없습니다.</p>';

            if (purchasePagination) {
                purchasePagination.innerHTML = `
                    <button type="button" class="mypage-pagination-btn" disabled>이전</button>
                    <button type="button" class="mypage-pagination-btn is-active">1</button>
                    <button type="button" class="mypage-pagination-btn" disabled>다음</button>
                `;
            }

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
                            <img src="${getThumbSrc(product)}" alt="${product.title}">
                        </div>

                        <div class="product-info">
                            <p class="product-category">구매 완료</p>
                            <h3 class="product-name">${product.title}</h3>
                            <p class="product-price">${formatPrice(product.sale_price || product.price)}</p>
                            <p class="purchase-file-count">${fileCountText}</p>
                        </div>
                    </a>

                    <div class="product-download-area">
                        <button type="button" class="btn btn-outline purchase-download-btn" data-product-id="${product.product_id}">
                            다운로드
                        </button>
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
            seller: '셀러회원입니다.',
            admin: '관리자회원입니다.'
        };

        setProfileImages(meData.profileImage);

        if (profileName) profileName.textContent = meData.nickname || meData.username || '회원';
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

        return true;
    }

    async function loadMyProducts() {
        if (!purchaseListBox || !purchaseCount) {
            return;
        }

        try {
            const response = await fetch('/my-products', {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                purchaseItems = [];
                purchaseListBox.innerHTML = `<p class="empty-message">${data.message || '구매한 상품을 불러오지 못했습니다.'}</p>`;
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

    async function saveProfileField(field) {
        const nickname = accountNicknameInput?.value.trim() || '';
        const email = accountEmailInput?.value.trim() || '';
        const name = accountNameInput?.value.trim() || '';
        const phone = accountPhoneInput?.value.trim() || '';

        const { messageEl } = getFieldElements(field);
        if (messageEl) messageEl.textContent = '';

        if (!nickname) {
            if (messageEl) messageEl.textContent = '닉네임을 입력해 주세요.';
            return;
        }

        if (!email) {
            if (messageEl) messageEl.textContent = '이메일을 입력해 주세요.';
            return;
        }

        if (!isValidEmail(email)) {
            if (messageEl) messageEl.textContent = '올바른 이메일 형식을 입력해 주세요.';
            return;
        }

        if (field === 'nickname') {
            const checkData = await checkNicknameAvailable(nickname);
            const currentNickname = accountNickname?.textContent?.trim() || '';

            if (!checkData.success && nickname !== currentNickname) {
                if (messageEl) {
                    messageEl.textContent = checkData.message || '이미 사용 중인 닉네임입니다.';
                }
                return;
            }
        }

        try {
            const response = await fetch('/my-profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    nickname,
                    email,
                    name,
                    phone
                })
            });

            const data = await response.json();

            if (!data.success) {
                if (messageEl) {
                    messageEl.textContent = data.message || '회원 정보 변경에 실패했습니다.';
                }
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

    profileImageInput?.addEventListener('change', () => {
        const file = profileImageInput.files?.[0];

        if (!profileImageMessage) {
            return;
        }

        profileImageMessage.textContent = '';

        if (profilePreviewUrl) {
            URL.revokeObjectURL(profilePreviewUrl);
            profilePreviewUrl = '';
        }

        if (!file) {
            return;
        }

        profilePreviewUrl = URL.createObjectURL(file);
        setProfileImages(profilePreviewUrl);
    });

    profileImageSaveBtn?.addEventListener('click', async () => {
        const file = profileImageInput?.files?.[0];

        if (!file) {
            if (profileImageMessage) {
                profileImageMessage.textContent = '프로필 이미지를 선택해 주세요.';
            }
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
                if (profileImageMessage) {
                    profileImageMessage.textContent = data.message || '프로필 이미지 변경에 실패했습니다.';
                }
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
            const productId = String(downloadBtn.dataset.productId || '');
            const product = purchasedProducts.get(productId);

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

        const paginationBtn = event.target.closest('.mypage-pagination-btn');

        if (paginationBtn && purchasePagination?.contains(paginationBtn)) {
            const moveType = paginationBtn.dataset.pageMove;
            const totalPages = Math.max(1, Math.ceil(purchaseItems.length / PURCHASES_PER_PAGE));

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
            setPasswordMessage('모든 비밀번호 항목을 입력해 주세요.', true);
            return;
        }

        if (newPassword !== newPasswordConfirm) {
            setPasswordMessage('새 비밀번호가 일치하지 않습니다.', true);
            return;
        }

        if (!isValidPassword(newPassword)) {
            setPasswordMessage('영문과 숫자를 포함해 8자 이상 입력해주세요.', true);
            return;
        }

        try {
            const response = await fetch('/my-password', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
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

    if (!ok) {
        return;
    }

    if (currentPasswordInput) {
        currentPasswordInput.placeholder = '현재 비밀번호';
    }

    if (newPasswordInput) {
        newPasswordInput.placeholder = '영문+숫자 포함 8자 이상';
    }

    if (newPasswordConfirmInput) {
        newPasswordConfirmInput.placeholder = '새 비밀번호 확인';
    }

    setPasswordMessage('');

    await loadMyProducts();
});
