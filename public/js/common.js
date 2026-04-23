document.addEventListener('DOMContentLoaded', async () => {
    const authLink = document.getElementById('auth-link');
    const cartLink = document.getElementById('cart-link');
    const orderCheckLink = document.getElementById('order-check-link');
    const adminLink = document.getElementById('admin-link');
    const sellerUploadLink = document.getElementById('seller-upload-link');

    const userMenu = document.getElementById('header-user-menu');
    const userTrigger = document.getElementById('header-user-trigger');
    const userPanel = document.getElementById('header-user-panel');
    const userAvatarImage = document.getElementById('header-user-avatar-image');
    const userAvatarLargeImage = document.getElementById('header-user-avatar-large-image');
    const userName = document.getElementById('header-user-name');
    const userRole = document.getElementById('header-user-role');

    const sellerMenuLink = document.getElementById('header-menu-seller');
    const adminMenuLink = document.getElementById('header-menu-admin');
    const logoutButton = document.getElementById('header-menu-logout');
    const userMenuLinks = document.querySelectorAll('.header-user-link[href]');

    function getDisplayName(data) {
        return (data.nickname || data.username || 'User').trim();
    }

    function getRoleLabel(role) {
        if (role === 'admin') return '슈퍼관리자';
        if (role === 'seller') return '셀러회원';
        return '일반회원';
    }

    function getProfileSrc(data) {
        return data.profileImage || '/images/normal user.jpg';
    }

    function setProfileImages(src) {
        if (userAvatarImage) userAvatarImage.src = src;
        if (userAvatarLargeImage) userAvatarLargeImage.src = src;
    }

    function show(el, display = '') {
        if (!el) return;
        el.hidden = false;
        el.style.display = display;
    }

    function hide(el) {
        if (!el) return;
        el.hidden = true;
        el.style.display = 'none';
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

    function bindUserMenuEvents() {
        if (!userTrigger || !userPanel || !userMenu) return;

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

        logoutButton?.addEventListener('click', handleLogout);
    }

    try {
        const response = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        // 기본 상태
        show(authLink);
        show(orderCheckLink);
        hide(cartLink);
        hide(sellerUploadLink);
        hide(adminLink);
        hide(userMenu);
        hide(sellerMenuLink);
        hide(adminMenuLink);

        if (!data.loggedIn) {
            if (authLink) {
                authLink.textContent = '로그인';
                authLink.href = '/login-page';
            }

            if (orderCheckLink) {
                orderCheckLink.href = '/order-check-page';
            }

            return;
        }

        // 로그인 상태
        const displayName = getDisplayName(data);
        const profileSrc = getProfileSrc(data);

        hide(authLink);
        hide(orderCheckLink);
        hide(cartLink);
        show(userMenu);

        setProfileImages(profileSrc);

        if (userName) userName.textContent = displayName;
        if (userRole) userRole.textContent = getRoleLabel(data.role);

        if (data.role === 'seller' || data.role === 'admin') {
            show(sellerUploadLink);
            show(sellerMenuLink);
        }

        if (data.role === 'admin') {
            show(adminLink);
            show(adminMenuLink);
        }

        bindUserMenuEvents();
    } catch (error) {
        console.error('공통 상태 확인 실패:', error);
    }
});