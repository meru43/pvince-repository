document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('register-form');
    const usernameInput = document.getElementById('register-id');
    const passwordInput = document.getElementById('register-password');
    const passwordConfirmInput = document.getElementById('register-password-confirm');
    const errorText = document.getElementById('register-error');

    // 이미 로그인 상태면 마이페이지로 이동
    try {
        const meResponse = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });

        const meData = await meResponse.json();

        if (meData.loggedIn) {
            window.location.href = '/mypage-page';
            return;
        }
    } catch (error) {
        console.error('로그인 상태 확인 실패:', error);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const passwordConfirm = passwordConfirmInput.value.trim();

        errorText.textContent = '';

        if (!username || !password || !passwordConfirm) {
            errorText.textContent = '모든 항목을 입력해주세요.';
            return;
        }

        if (password !== passwordConfirm) {
            errorText.textContent = '비밀번호가 일치하지 않습니다.';
            return;
        }

        if (password.length < 4) {
            errorText.textContent = '비밀번호는 최소 4자 이상 입력해주세요.';
            return;
        }

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    username,
                    password
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
                window.location.href = '/login-page';
            } else {
                errorText.textContent = data.message || '회원가입에 실패했습니다.';
            }
        } catch (error) {
            console.error('회원가입 요청 실패:', error);
            errorText.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });
});