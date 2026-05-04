document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('login-form');
    const usernameInput = document.getElementById('login-id');
    const passwordInput = document.getElementById('login-password');
    const rememberInput = document.getElementById('login-remember');
    const errorText = document.getElementById('login-error');

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

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const rememberLogin = Boolean(rememberInput.checked);

        errorText.textContent = '';

        if (!username || !password) {
            errorText.textContent = '아이디와 비밀번호를 입력해주세요.';
            return;
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    username,
                    password,
                    rememberLogin
                })
            });

            const data = await response.json();

            if (data.success) {
                window.location.href = '/mypage-page';
                return;
            }

            errorText.textContent = data.message || '로그인에 실패했습니다.';
        } catch (error) {
            console.error('로그인 요청 실패:', error);
            errorText.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });
});
