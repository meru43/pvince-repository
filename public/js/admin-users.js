document.addEventListener('DOMContentLoaded', async () => {
    const adminUsersList = document.getElementById('admin-users-list');
    const searchInput = document.getElementById('admin-user-search');
    const searchBtn = document.getElementById('admin-user-search-btn');

    const passwordModal = document.getElementById('admin-password-modal');
    const passwordModalBackdrop = document.getElementById('admin-password-modal-backdrop');
    const passwordModalCode = document.getElementById('admin-password-modal-code');
    const passwordModalMessage = document.getElementById('admin-password-modal-message');
    const passwordCopyBtn = document.getElementById('admin-password-copy-btn');
    const passwordCloseBtn = document.getElementById('admin-password-close-btn');

    const DEFAULT_PROFILE_IMAGE = '/images/normal user.jpg';
    const USERS_PER_PAGE = 20;

    let cachedUsers = [];
    let currentPage = 1;

    function getNextRole(role) {
        return role === 'seller' ? 'member' : 'seller';
    }

    function displayValue(value) {
        return value && String(value).trim() !== '' ? value : '-';
    }

    function getProfileImageSrc(user) {
        return user.profile_image && String(user.profile_image).trim() !== ''
            ? user.profile_image
            : DEFAULT_PROFILE_IMAGE;
    }

    function isGoogleUser(user) {
        return Boolean(
            (user.google_id && String(user.google_id).trim() !== '')
            || (user.google_email && String(user.google_email).trim() !== '')
        );
    }

    function getStatusText(user) {
        return Number(user.is_active) === 1 ? '활동중' : '활동중지';
    }

    function openPasswordModal(tempPassword) {
        if (!passwordModal || !passwordModalCode) return;

        passwordModalCode.textContent = tempPassword;
        if (passwordModalMessage) {
            passwordModalMessage.textContent = '';
        }

        passwordModal.hidden = false;
    }

    function closePasswordModal() {
        if (!passwordModal) return;
        passwordModal.hidden = true;
    }

    function getPaginationMarkup(totalPages) {
        const pageButtons = Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            const activeClass = page === currentPage ? ' active' : '';

            return `
                <button type="button" class="admin-pagination-btn page-number${activeClass}" data-page="${page}">
                    ${page}
                </button>
            `;
        }).join('');

        return `
            <div class="admin-pagination">
                <button
                    type="button"
                    class="admin-pagination-btn"
                    data-page="${currentPage - 1}"
                    ${currentPage === 1 ? 'disabled' : ''}
                >
                    이전
                </button>
                <div class="admin-pagination-numbers">
                    ${pageButtons}
                </div>
                <button
                    type="button"
                    class="admin-pagination-btn"
                    data-page="${currentPage + 1}"
                    ${currentPage === totalPages ? 'disabled' : ''}
                >
                    다음
                </button>
            </div>
        `;
    }

    function updateSwitchState(button, role) {
        const row = button.closest('.admin-user-row');
        const badge = row?.querySelector('.role-badge');

        button.classList.remove('seller', 'member');
        button.classList.add(role);
        button.dataset.currentRole = role;
        button.dataset.role = getNextRole(role);
        button.setAttribute('aria-pressed', String(role === 'seller'));

        if (badge) {
            badge.className = `role-badge ${role}`;
            badge.textContent = role;
        }
    }

    function renderUsers(users) {
        if (!users || users.length === 0) {
            adminUsersList.innerHTML = '<p class="empty-message">등록된 회원이 없습니다.</p>';
            return;
        }

        const totalPages = Math.max(Math.ceil(users.length / USERS_PER_PAGE), 1);
        currentPage = Math.min(currentPage, totalPages);

        const startIndex = (currentPage - 1) * USERS_PER_PAGE;
        const visibleUsers = users.slice(startIndex, startIndex + USERS_PER_PAGE);

        adminUsersList.innerHTML = `
            ${visibleUsers.map((user) => `
                <div class="admin-user-row">
                    <span class="col-profile">
                        <img
                            src="${getProfileImageSrc(user)}"
                            alt="${displayValue(user.username)} 프로필"
                            class="admin-user-avatar"
                        >
                    </span>

                    <span class="col-username">
                        <span class="admin-user-identity">
                            <span class="admin-user-username-text">${displayValue(user.username)}</span>
                            ${isGoogleUser(user) ? '<span class="auth-provider-tag google">Google</span>' : ''}
                        </span>
                    </span>
                    <span class="col-nickname">${displayValue(user.nickname)}</span>
                    <span class="col-email">${displayValue(user.email)}</span>
                    <span class="col-name">${displayValue(user.name)}</span>
                    <span class="col-phone">${displayValue(user.phone)}</span>

                    <span class="col-user-status">
                        <span class="user-status-badge ${Number(user.is_active) === 1 ? 'active' : 'inactive'}">
                            ${getStatusText(user)}
                        </span>
                    </span>

                    <span class="col-role">
                        <span class="role-badge ${user.role}">${user.role}</span>
                    </span>

                    <span class="col-action">
                        ${user.role === 'admin'
                            ? '<span>변경 불가</span>'
                            : `
                                <div class="admin-user-actions">
                                    <div class="admin-user-actions-top">
                                        <button
                                            type="button"
                                            class="role-switch ${user.role}"
                                            data-id="${user.id}"
                                            data-current-role="${user.role}"
                                            data-role="${getNextRole(user.role)}"
                                            aria-label="회원 권한 변경"
                                            aria-pressed="${user.role === 'seller'}"
                                        >
                                            <span class="role-switch-track">
                                                <span class="role-switch-option seller">셀러회원</span>
                                                <span class="role-switch-option member">일반회원</span>
                                            </span>
                                            <span class="role-switch-thumb" aria-hidden="true">
                                                <span class="role-switch-thumb-track">
                                                    <span class="role-switch-thumb-option">셀러회원</span>
                                                    <span class="role-switch-thumb-option">일반회원</span>
                                                </span>
                                            </span>
                                        </button>
                                    </div>

                                    <div class="admin-user-actions-bottom">
                                        <button
                                            type="button"
                                            class="btn user-status-btn ${Number(user.is_active) === 1 ? 'danger' : 'btn-outline'}"
                                            data-id="${user.id}"
                                            data-next-status="${Number(user.is_active) === 1 ? 0 : 1}"
                                        >
                                            ${Number(user.is_active) === 1 ? '활동중지' : '활동재개'}
                                        </button>

                                        <button
                                            type="button"
                                            class="btn btn-outline user-password-reset-btn"
                                            data-id="${user.id}"
                                            data-username="${displayValue(user.username)}"
                                        >
                                            비밀번호 초기화
                                        </button>
                                    </div>
                                </div>
                            `
                        }
                    </span>
                </div>
            `).join('')}
            ${getPaginationMarkup(totalPages)}
        `;

        const roleButtons = document.querySelectorAll('.role-switch');

        roleButtons.forEach((button) => {
            button.addEventListener('click', async () => {
                if (button.disabled) return;

                const userId = button.dataset.id;
                const previousRole = button.dataset.currentRole;
                const nextRole = button.dataset.role;

                button.disabled = true;
                updateSwitchState(button, nextRole);

                try {
                    const response = await fetch(`/api/admin/users/${userId}/role`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({ role: nextRole })
                    });

                    const data = await response.json();

                    if (!data.success) {
                        updateSwitchState(button, previousRole);
                        alert(data.message || '권한 변경에 실패했습니다.');
                    } else {
                        await loadUsers(false);
                    }
                } catch (error) {
                    updateSwitchState(button, previousRole);
                    console.error('권한 변경 실패:', error);
                    alert('서버와 통신 중 오류가 발생했습니다.');
                } finally {
                    button.disabled = false;
                }
            });
        });
    }

    async function loadUsers(resetPage = true) {
        try {
            const meResponse = await fetch('/me', {
                method: 'GET',
                credentials: 'include'
            });

            const meData = await meResponse.json();

            if (!meData.loggedIn || meData.role !== 'admin') {
                alert('관리자만 접근할 수 있습니다.');
                window.location.href = '/';
                return;
            }

            const params = new URLSearchParams({
                q: searchInput?.value?.trim() || ''
            });

            const response = await fetch(`/api/admin/users?${params.toString()}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                adminUsersList.innerHTML = `<p class="empty-message">${data.message || '회원 목록을 불러오지 못했습니다.'}</p>`;
                return;
            }

            cachedUsers = data.users || [];
            if (resetPage) {
                currentPage = 1;
            }

            renderUsers(cachedUsers);
        } catch (error) {
            console.error('회원 목록 불러오기 실패:', error);
            adminUsersList.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
        }
    }

    adminUsersList.addEventListener('click', async (e) => {
        const paginationBtn = e.target.closest('.admin-pagination-btn[data-page]');
        if (paginationBtn && !paginationBtn.disabled) {
            const nextPage = Number(paginationBtn.dataset.page);
            if (Number.isFinite(nextPage) && nextPage >= 1) {
                currentPage = nextPage;
                renderUsers(cachedUsers);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }

        const statusBtn = e.target.closest('.user-status-btn');
        if (statusBtn) {
            const userId = statusBtn.dataset.id;
            const nextStatus = Number(statusBtn.dataset.nextStatus);

            const firstMessage = nextStatus === 0
                ? '정말 이 회원을 활동 중지 처리하시겠습니까?'
                : '이 회원을 다시 활동 상태로 변경하시겠습니까?';

            if (!confirm(firstMessage)) {
                return;
            }

            if (nextStatus === 0) {
                const finalConfirm = confirm('최종 확인: 활동중지 처리하면 이 계정은 로그인할 수 없습니다. 계속하시겠습니까?');
                if (!finalConfirm) {
                    return;
                }
            }

            try {
                const response = await fetch(`/api/admin/users/${userId}/status`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        isActive: nextStatus
                    })
                });

                const data = await response.json();

                if (data.success) {
                    alert(data.message);
                    await loadUsers(false);
                } else {
                    alert(data.message || '회원 상태 변경에 실패했습니다.');
                }
            } catch (error) {
                console.error('회원 상태 변경 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }

            return;
        }

        const resetPasswordBtn = e.target.closest('.user-password-reset-btn');
        if (resetPasswordBtn) {
            const userId = resetPasswordBtn.dataset.id;
            const username = resetPasswordBtn.dataset.username || '해당 회원';

            const firstConfirm = confirm(`${username}의 비밀번호를 초기화하시겠습니까?`);
            if (!firstConfirm) {
                return;
            }

            const finalConfirm = confirm('최종 확인: 임시 비밀번호로 변경됩니다. 계속하시겠습니까?');
            if (!finalConfirm) {
                return;
            }

            try {
                const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });

                const data = await response.json();

                if (data.success) {
                    openPasswordModal(data.tempPassword);
                } else {
                    alert(data.message || '비밀번호 초기화에 실패했습니다.');
                }
            } catch (error) {
                console.error('비밀번호 초기화 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }
        }
    });

    passwordCopyBtn?.addEventListener('click', async () => {
        const tempPassword = passwordModalCode?.textContent?.trim() || '';
        if (!tempPassword) return;

        try {
            await navigator.clipboard.writeText(tempPassword);
            if (passwordModalMessage) {
                passwordModalMessage.textContent = '임시 비밀번호가 복사되었습니다.';
            }
        } catch (error) {
            console.error('클립보드 복사 실패:', error);
            if (passwordModalMessage) {
                passwordModalMessage.textContent = '자동 복사에 실패했습니다. 직접 복사해주세요.';
            }
        }
    });

    passwordCloseBtn?.addEventListener('click', closePasswordModal);
    passwordModalBackdrop?.addEventListener('click', closePasswordModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePasswordModal();
        }
    });

    searchBtn?.addEventListener('click', async () => {
        await loadUsers(true);
    });

    searchInput?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await loadUsers(true);
        }
    });

    loadUsers(true);
});
