document.addEventListener('DOMContentLoaded', async () => {
    const authLink = document.getElementById('auth-link');
    const cartLink = document.getElementById('cart-link');
    const orderCheckLink = document.getElementById('order-check-link');
    const adminLink = document.getElementById('admin-link');
    const sellerUploadLink = document.getElementById('seller-upload-link');

    const userMenu = document.getElementById('header-user-menu');
    const userTrigger = document.getElementById('header-user-trigger');
    const userPanel = document.getElementById('header-user-panel');
    const userAvatar = document.getElementById('header-user-avatar');
    const userAvatarLarge = document.getElementById('header-user-avatar-large');
    const userName = document.getElementById('header-user-name');
    const userRole = document.getElementById('header-user-role');
    const sellerMenuLink = document.getElementById('header-menu-seller');
    const adminMenuLink = document.getElementById('header-menu-admin');
    const logoutButton = document.getElementById('header-menu-logout');
    const userMenuLinks = document.querySelectorAll('.header-user-link[href]');

    function getDisplayName(data) {
        return (data.nickname || data.username || 'User').trim();
    }

    function getAvatarText(name) {
        return String(name || 'U').trim().charAt(0).toUpperCase() || 'U';
    }

    function getRoleLabel(role) {
        if (role === 'admin') return '슈퍼관리자';
        if (role === 'seller') return '셀러회원';
        return '일반회원';
    }

    function setMenuOpen(isOpen) {
        if (!userMenu || !userTrigger || !userPanel) return;

        userTrigger.setAttribute('aria-expanded', String(isOpen));
        userPanel.hidden = !isOpen;
    }

    async function handleLogout() {
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
    }

    try {
        const response = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.loggedIn) {
            if (authLink) {
                authLink.hidden = false;
                authLink.style.display = '';
                authLink.textContent = '로그인';
                authLink.href = '/login-page';
            }

            if (userMenu) {
                userMenu.hidden = true;
            }

            if (orderCheckLink) {
                orderCheckLink.href = '/order-check-page';
                orderCheckLink.style.display = 'none';
            }

            if (cartLink) {
                cartLink.style.display = 'none';
            }

            if (sellerUploadLink) sellerUploadLink.style.display = 'none';
            if (adminLink) adminLink.style.display = 'none';

            return;
        }

        const displayName = getDisplayName(data);
        const avatarText = getAvatarText(displayName);

        if (authLink) {
            authLink.hidden = true;
            authLink.style.display = 'none';
        }

        if (userMenu) {
            userMenu.hidden = false;
        }

        if (userAvatar) userAvatar.textContent = avatarText;
        if (userAvatarLarge) userAvatarLarge.textContent = avatarText;
        if (userName) userName.textContent = displayName;
        if (userRole) userRole.textContent = getRoleLabel(data.role);

        if (orderCheckLink) {
            orderCheckLink.href = '/mypage-page#purchase-list';
            orderCheckLink.style.display = 'none';
        }

        if (cartLink) {
            cartLink.style.display = 'none';
        }

        if (data.role === 'admin') {
            if (adminLink) adminLink.style.display = 'none';
            if (sellerUploadLink) sellerUploadLink.style.display = 'none';
            if (adminMenuLink) adminMenuLink.hidden = false;
            if (sellerMenuLink) sellerMenuLink.hidden = false;
        } else if (data.role === 'seller') {
            if (sellerUploadLink) sellerUploadLink.style.display = 'none';
            if (adminLink) adminLink.style.display = 'none';
            if (sellerMenuLink) sellerMenuLink.hidden = false;
            if (adminMenuLink) adminMenuLink.hidden = true;
        } else {
            if (sellerUploadLink) sellerUploadLink.style.display = 'none';
            if (adminLink) adminLink.style.display = 'none';
            if (sellerMenuLink) sellerMenuLink.hidden = true;
            if (adminMenuLink) adminMenuLink.hidden = true;
        }

        if (userTrigger && userPanel) {
            userTrigger.addEventListener('click', (event) => {
                event.stopPropagation();
                setMenuOpen(userPanel.hidden);
            });

            userMenuLinks.forEach((link) => {
                link.addEventListener('click', () => {
                    setMenuOpen(false);
                });
            });

            document.addEventListener('click', (event) => {
                if (!userMenu.contains(event.target)) {
                    setMenuOpen(false);
                }
            });

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    setMenuOpen(false);
                }
            });
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }
    } catch (error) {
        console.error('공통 상태 확인 실패:', error);
    }
});
