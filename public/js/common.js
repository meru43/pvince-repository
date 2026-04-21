document.addEventListener('DOMContentLoaded', async () => {
    const authLink = document.getElementById('auth-link');
    const orderCheckLink = document.getElementById('order-check-link');
    const adminLink = document.getElementById('admin-link');
    const sellerUploadLink = document.getElementById('seller-upload-link');

    try {
        const response = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.loggedIn) {
            if (authLink) {
                authLink.textContent = '로그아웃';
                authLink.href = '#';

                authLink.addEventListener('click', async (e) => {
                    e.preventDefault();

                    try {
                        const logoutResponse = await fetch('/logout', {
                            method: 'POST',
                            credentials: 'include'
                        });

                        const logoutData = await logoutResponse.json();

                        if (logoutData.success) {
                            alert('로그아웃되었습니다.');
                            window.location.href = '/';
                        } else {
                            alert(logoutData.message || '로그아웃에 실패했습니다.');
                        }
                    } catch (error) {
                        console.error('로그아웃 실패:', error);
                        alert('서버와 통신 중 오류가 발생했습니다.');
                    }
                });
            }

            if (orderCheckLink) {
                orderCheckLink.href = '/mypage-page#purchase-list';
            }

            if (data.role === 'admin') {
                if (adminLink) adminLink.style.display = 'inline-flex';
                if (sellerUploadLink) sellerUploadLink.style.display = 'inline-flex';
            }

            if (data.role === 'seller') {
                if (sellerUploadLink) sellerUploadLink.style.display = 'inline-flex';
            }
        } else {
            if (authLink) {
                authLink.textContent = '로그인';
                authLink.href = '/login-page';
            }

            if (orderCheckLink) {
                orderCheckLink.href = '/order-check-page';
            }
        }
    } catch (error) {
        console.error('공통 상태 확인 실패:', error);
    }
});