document.addEventListener('DOMContentLoaded', async () => {
    const adminUsersList = document.getElementById('admin-users-list');

    function renderUsers(users) {
        if (!users || users.length === 0) {
            adminUsersList.innerHTML = `<p class="empty-message">등록된 회원이 없습니다.</p>`;
            return;
        }

        adminUsersList.innerHTML = users.map(user => `
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
                                <div class="role-actions">
                                    <button type="button" class="btn btn-outline role-change-btn" data-id="${user.id}" data-role="member">일반회원</button>
                                    <button type="button" class="btn btn-primary role-change-btn" data-id="${user.id}" data-role="seller">셀러회원</button>
                                </div>
                            `
            }
                </span>
            </div>
        `).join('');

        const roleButtons = document.querySelectorAll('.role-change-btn');

        roleButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const userId = button.dataset.id;
                const role = button.dataset.role;

                try {
                    const response = await fetch(`/api/admin/users/${userId}/role`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        body: JSON.stringify({ role })
                    });

                    const data = await response.json();

                    if (data.success) {
                        alert(data.message);
                        loadUsers();
                    } else {
                        alert(data.message || '권한 변경에 실패했습니다.');
                    }
                } catch (error) {
                    console.error('권한 변경 실패:', error);
                    alert('서버와 통신 중 오류가 발생했습니다.');
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
            adminUsersList.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
        }
    }

    loadUsers();
});