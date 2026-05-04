document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('register-form');
    const usernameInput = document.getElementById('register-id');
    const passwordInput = document.getElementById('register-password');
    const passwordConfirmInput = document.getElementById('register-password-confirm');
    const nicknameInput = document.getElementById('register-nickname');
    const emailInput = document.getElementById('register-email');
    const nameInput = document.getElementById('register-name');
    const phoneInput = document.getElementById('register-phone');

    const checkUsernameBtn = document.getElementById('check-username-btn');
    const checkNicknameBtn = document.getElementById('check-nickname-btn');
    const checkEmailBtn = document.getElementById('check-email-btn');

    const usernameMessage = document.getElementById('register-username-message');
    const passwordConfirmMessage = document.getElementById('register-password-confirm-message');
    const nicknameMessage = document.getElementById('register-nickname-message');
    const emailMessage = document.getElementById('register-email-message');
    const errorText = document.getElementById('register-error');

    let usernameChecked = false;
    let checkedUsernameValue = '';
    let nicknameChecked = false;
    let checkedNicknameValue = '';
    let emailChecked = false;
    let checkedEmailValue = '';

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isValidUsername(username) {
        return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/.test(username);
    }

    function isValidPassword(password) {
        return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password);
    }

    function clearMessageState(element) {
        element.textContent = '';
        element.classList.remove('is-error', 'is-success');
    }

    function setMessageState(element, type, message) {
        element.textContent = message;
        element.classList.remove('is-error', 'is-success');

        if (type === 'error') {
            element.classList.add('is-error');
        }

        if (type === 'success') {
            element.classList.add('is-success');
        }
    }

    function resetCheckState(type) {
        if (type === 'username') {
            usernameChecked = false;
            checkedUsernameValue = '';
            clearMessageState(usernameMessage);
        }

        if (type === 'nickname') {
            nicknameChecked = false;
            checkedNicknameValue = '';
            clearMessageState(nicknameMessage);
        }

        if (type === 'email') {
            emailChecked = false;
            checkedEmailValue = '';
            clearMessageState(emailMessage);
        }
    }

    function updatePasswordConfirmMessage() {
        const password = passwordInput.value.trim();
        const passwordConfirm = passwordConfirmInput.value.trim();

        clearMessageState(passwordConfirmMessage);

        if (!passwordConfirm) {
            return;
        }

        if (password !== passwordConfirm) {
            setMessageState(passwordConfirmMessage, 'error', '비밀번호가 일치하지 않습니다.');
            return;
        }

        setMessageState(passwordConfirmMessage, 'success', '비밀번호가 일치합니다.');
    }

    async function runDuplicateCheck({ value, url, fieldName, messageElement, onSuccess }) {
        clearMessageState(messageElement);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ [fieldName]: value })
            });

            const data = await response.json();

            if (!data.success) {
                setMessageState(messageElement, 'error', data.message || '중복 확인에 실패했습니다.');
                return false;
            }

            setMessageState(messageElement, 'success', data.message || '사용 가능한 값입니다.');
            onSuccess(value);
            return true;
        } catch (error) {
            console.error(`${fieldName} duplicate check failed:`, error);
            setMessageState(messageElement, 'error', '서버와 통신 중 오류가 발생했습니다.');
            return false;
        }
    }

    usernameInput.addEventListener('input', () => resetCheckState('username'));
    passwordInput.addEventListener('input', updatePasswordConfirmMessage);
    passwordConfirmInput.addEventListener('input', updatePasswordConfirmMessage);
    nicknameInput.addEventListener('input', () => resetCheckState('nickname'));
    emailInput.addEventListener('input', () => resetCheckState('email'));

    checkUsernameBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();

        if (!username) {
            setMessageState(usernameMessage, 'error', '아이디를 입력해주세요.');
            return;
        }

        if (!isValidUsername(username)) {
            setMessageState(usernameMessage, 'error', '아이디는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.');
            return;
        }

        await runDuplicateCheck({
            value: username,
            url: '/check-username',
            fieldName: 'username',
            messageElement: usernameMessage,
            onSuccess: (currentValue) => {
                usernameChecked = true;
                checkedUsernameValue = currentValue;
            }
        });
    });

    checkNicknameBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();

        if (!nickname) {
            setMessageState(nicknameMessage, 'error', '닉네임을 입력해주세요.');
            return;
        }

        await runDuplicateCheck({
            value: nickname,
            url: '/check-nickname',
            fieldName: 'nickname',
            messageElement: nicknameMessage,
            onSuccess: (currentValue) => {
                nicknameChecked = true;
                checkedNicknameValue = currentValue;
            }
        });
    });

    checkEmailBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();

        if (!email) {
            setMessageState(emailMessage, 'error', '이메일을 입력해주세요.');
            return;
        }

        if (!isValidEmail(email)) {
            setMessageState(emailMessage, 'error', '올바른 이메일 형식으로 입력해주세요.');
            return;
        }

        await runDuplicateCheck({
            value: email,
            url: '/check-email',
            fieldName: 'email',
            messageElement: emailMessage,
            onSuccess: (currentValue) => {
                emailChecked = true;
                checkedEmailValue = currentValue;
            }
        });
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

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

        if (!isValidUsername(username)) {
            errorText.textContent = '아이디는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.';
            return;
        }

        if (!isValidEmail(email)) {
            errorText.textContent = '올바른 이메일 형식으로 입력해주세요.';
            return;
        }

        if (!isValidPassword(password)) {
            errorText.textContent = '비밀번호는 영문과 숫자를 포함해 8자 이상 입력해주세요.';
            return;
        }

        if (password !== passwordConfirm) {
            errorText.textContent = '비밀번호가 일치하지 않습니다.';
            return;
        }

        if (!usernameChecked || checkedUsernameValue !== username) {
            errorText.textContent = '아이디 중복확인을 완료해주세요.';
            return;
        }

        if (!nicknameChecked || checkedNicknameValue !== nickname) {
            errorText.textContent = '닉네임 중복확인을 완료해주세요.';
            return;
        }

        if (!emailChecked || checkedEmailValue !== email) {
            errorText.textContent = '이메일 중복확인을 완료해주세요.';
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

            if (!data.success) {
                errorText.textContent = data.message || '회원가입에 실패했습니다.';
                return;
            }

            alert('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
            window.location.href = '/login-page';
        } catch (error) {
            console.error('register request failed:', error);
            errorText.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });
});
