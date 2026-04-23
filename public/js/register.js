document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('register-form');
    const usernameInput = document.getElementById('register-id');
    const passwordInput = document.getElementById('register-password');
    const passwordConfirmInput = document.getElementById('register-password-confirm');
    const nicknameInput = document.getElementById('register-nickname');
    const emailInput = document.getElementById('register-email');
    const nameInput = document.getElementById('register-name');
    const phoneInput = document.getElementById('register-phone');

    const checkNicknameBtn = document.getElementById('check-nickname-btn');
    const errorText = document.getElementById('register-error');
    const checkMessage = document.getElementById('register-check-message');

    let nicknameChecked = false;
    let checkedNicknameValue = '';

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    nicknameInput.addEventListener('input', () => {
        nicknameChecked = false;
        checkedNicknameValue = '';
        checkMessage.textContent = '';
    });

    checkNicknameBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();

        checkMessage.textContent = '';

        if (!nickname) {
            checkMessage.textContent = '닉네임을 입력해주세요.';
            return;
        }

        try {
            const response = await fetch('/check-nickname', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ nickname })
            });

            const data = await response.json();

            if (data.success) {
                nicknameChecked = true;
                checkedNicknameValue = nickname;
                checkMessage.textContent = data.message;
            } else {
                nicknameChecked = false;
                checkedNicknameValue = '';
                checkMessage.textContent = data.message || '중복확인에 실패했습니다.';
            }
        } catch (error) {
            console.error('닉네임 중복확인 실패:', error);
            checkMessage.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const passwordConfirm = passwordConfirmInput.value.trim();
        const nickname = nicknameInput.value.trim();
        const email = emailInput.value.trim();
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();

        errorText.textContent = '';

        if (!username || !password || !passwordConfirm || !nickname || !email) {
            errorText.textContent = '아이디, 비밀번호, 비밀번호 확인, 닉네임, 이메일을 입력해주세요.';
            return;
        }

        if (!isValidEmail(email)) {
            errorText.textContent = '올바른 이메일 형식을 입력해주세요.';
            return;
        }

        if (password !== passwordConfirm) {
            errorText.textContent = '비밀번호가 일치하지 않습니다.';
            return;
        }

        if (!nicknameChecked || checkedNicknameValue !== nickname) {
            errorText.textContent = '닉네임 중복확인을 완료해주세요.';
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
                    password,
                    nickname,
                    email,
                    name,
                    phone
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