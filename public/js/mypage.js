document.addEventListener('DOMContentLoaded', async () => {
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
    const downloadCount = document.getElementById('download-count');
    const downloadHistoryBox = document.getElementById('download-history-box');
    const logoutBtn = document.getElementById('logout-btn');

    const currentPasswordInput = document.getElementById('current-password-input');
    const newPasswordInput = document.getElementById('new-password-input');
    const newPasswordConfirmInput = document.getElementById('new-password-confirm-input');
    const passwordSaveBtn = document.getElementById('password-save-btn');
    const passwordMessage = document.getElementById('password-message');

    function formatPrice(value) {
        return `${Number(value || 0).toLocaleString()}원`;
    }

    function displayValue(value) {
        return value && String(value).trim() !== '' ? value : '-';
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

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
        if (profileName) profileName.textContent = `${meData.nickname || meData.username} 님`;
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
                purchaseListBox.innerHTML = '<p class="empty-message">구매한 상품이 없습니다.</p>';
                return;
            }

            purchaseListBox.innerHTML = products.map((product) => `
                <article class="product-card-wrap">
                    <a href="/products-page/${product.product_id}" target="_blank" rel="noopener noreferrer" class="product-card">
                        <div class="product-thumb">
                            <img src="${getThumbSrc(product)}" alt="${product.title}">
                        </div>

                        <div class="product-info">
                            <p class="product-category">구매 완료</p>
                            <h3 class="product-name">${product.title}</h3>
                            <p class="product-price">${formatPrice(product.sale_price || product.price)}</p>
                        </div>
                    </a>

                    <div class="product-download-area">
                        <a href="/download/${product.product_id}" class="btn btn-outline">다운로드</a>
                    </div>
                </article>
            `).join('');
        } catch (error) {
            console.error('구매한 상품 조회 실패:', error);
            purchaseListBox.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
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
                downloadHistoryBox.innerHTML = '<p class="empty-message">다운로드 내역이 없습니다.</p>';
                return;
            }

            downloadHistoryBox.innerHTML = logs.map((log) => `
                <div class="history-row">
                    <p><strong>상품명</strong> ${log.title}</p>
                    <p><strong>가격</strong> ${formatPrice(log.sale_price || log.price)}</p>
                    <p><strong>파일명</strong> ${displayValue(log.file_name)}</p>
                    <p><strong>다운로드 일시</strong> ${new Date(log.downloaded_at).toLocaleString()}</p>
                </div>
            `).join('');
        } catch (error) {
            console.error('다운로드 내역 조회 실패:', error);
            downloadHistoryBox.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
            downloadCount.textContent = '총 0건';
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

            if (data.success) {
                if (messageEl) messageEl.textContent = '저장되었습니다.';
                await loadMyInfo();
                exitEditMode(field);
            } else {
                if (messageEl) messageEl.textContent = data.message || '회원 정보 변경에 실패했습니다.';
            }
        } catch (error) {
            console.error('회원 정보 변경 실패:', error);
            if (messageEl) messageEl.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    }

    profileImageInput?.addEventListener('change', () => {
        const file = profileImageInput.files?.[0];
        if (!profileImageMessage) return;

        profileImageMessage.textContent = '';

        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        setProfileImages(previewUrl);
    });

    profileImageSaveBtn?.addEventListener('click', async () => {
        const file = profileImageInput?.files?.[0];

        if (!file) {
            if (profileImageMessage) {
                profileImageMessage.textContent = '프로필 이미지를 선택해주세요.';
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

            if (profileImageMessage) {
                profileImageMessage.textContent = data.message;
            }

            setProfileImages(data.profileImage);
            if (profileImageInput) profileImageInput.value = '';
        } catch (error) {
            console.error('프로필 이미지 변경 실패:', error);
            if (profileImageMessage) {
                profileImageMessage.textContent = '서버와 통신 중 오류가 발생했습니다.';
            }
        }
    });

    document.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('.account-toggle-btn');
        if (!toggleBtn) return;

        const field = toggleBtn.dataset.field;
        const mode = toggleBtn.dataset.mode || 'edit';

        if (mode === 'edit') {
            enterEditMode(field);
            return;
        }

        if (mode === 'save') {
            await saveProfileField(field);
        }
    });

    logoutBtn?.addEventListener('click', async () => {
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                window.location.href = '/';
            } else {
                alert(data.message || '로그아웃에 실패했습니다.');
            }
        } catch (error) {
            console.error('로그아웃 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    passwordSaveBtn?.addEventListener('click', async () => {
        const currentPassword = currentPasswordInput?.value.trim() || '';
        const newPassword = newPasswordInput?.value.trim() || '';
        const newPasswordConfirm = newPasswordConfirmInput?.value.trim() || '';

        if (passwordMessage) passwordMessage.textContent = '';

        if (!currentPassword || !newPassword || !newPasswordConfirm) {
            if (passwordMessage) passwordMessage.textContent = '모든 비밀번호 항목을 입력해주세요.';
            return;
        }

        if (newPassword !== newPasswordConfirm) {
            if (passwordMessage) passwordMessage.textContent = '새 비밀번호가 일치하지 않습니다.';
            return;
        }

        if (newPassword.length < 4) {
            if (passwordMessage) passwordMessage.textContent = '새 비밀번호는 4자 이상 입력해주세요.';
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

            if (data.success) {
                if (passwordMessage) passwordMessage.textContent = data.message;
                if (currentPasswordInput) currentPasswordInput.value = '';
                if (newPasswordInput) newPasswordInput.value = '';
                if (newPasswordConfirmInput) newPasswordConfirmInput.value = '';
            } else {
                if (passwordMessage) passwordMessage.textContent = data.message || '비밀번호 변경에 실패했습니다.';
            }
        } catch (error) {
            console.error('비밀번호 변경 실패:', error);
            if (passwordMessage) passwordMessage.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });

    const ok = await loadMyInfo();
    if (!ok) return;

    await loadMyProducts();
    await loadMyDownloadLogs();
});