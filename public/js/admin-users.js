document.addEventListener('DOMContentLoaded', async () => {
    const adminUsersList = document.getElementById('admin-users-list');

    function getNextRole(role) {
        return role === 'seller' ? 'member' : 'seller';
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

        adminUsersList.innerHTML = users.map((user) => `
            <div class="admin-user-row">
                <span class="col-id">${user.id}</span>
                <span class="col-username">${user.username}</span>
                <span class="col-role">
                    <span class="role-badge ${user.role}">${user.role}</span>
                </span>
                <span class="col-action">
                    ${user.role === 'admin'
                        ? '<span>변경 불가</span>'
                        : `
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
                        `
                    }
                </span>
            </div>
        `).join('');

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

    async function loadUsers() {
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

            const response = await fetch('/api/admin/users', {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                renderUsers(data.users);
            } else {
                adminUsersList.innerHTML = `<p class="empty-message">${data.message || '회원 목록을 불러오지 못했습니다.'}</p>`;
            }
        } catch (error) {
            console.error('회원 목록 불러오기 실패:', error);
            adminUsersList.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
        }
    }

    loadUsers();
});
