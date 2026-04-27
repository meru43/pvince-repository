document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgot-password-form');
    const usernameInput = document.getElementById('forgot-username');
    const emailInput = document.getElementById('forgot-email');
    const messageText = document.getElementById('forgot-password-message');
    const submitBtn = form?.querySelector('.forgot-submit');
    const defaultButtonText = submitBtn?.textContent?.trim() || '임시 비밀번호 발송';

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function setMessage(message = '', isError = false) {
        if (!messageText) return;
        messageText.textContent = message;
        messageText.classList.toggle('is-error', isError);
        messageText.classList.toggle('is-success', Boolean(message) && !isError);
    }

    function setSubmitting(isSubmitting) {
        if (!submitBtn) return;

        submitBtn.disabled = isSubmitting;
        submitBtn.classList.toggle('is-loading', isSubmitting);
        submitBtn.textContent = isSubmitting ? '발송 중...' : defaultButtonText;
    }

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = usernameInput?.value.trim() || '';
        const email = emailInput?.value.trim() || '';

        setMessage('');

        if (!username || !email) {
            setMessage('아이디와 이메일을 모두 입력해 주세요.', true);
            return;
        }

        if (!isValidEmail(email)) {
            setMessage('올바른 이메일 형식을 입력해 주세요.', true);
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch('/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    username,
                    email
                })
            });

            const data = await response.json();

            if (!data.success) {
                setMessage(data.message || '비밀번호 찾기에 실패했습니다.', true);
                return;
            }

            setMessage(data.message || '임시 비밀번호를 이메일로 발송했습니다.');

            if (usernameInput) usernameInput.value = '';
            if (emailInput) emailInput.value = '';
        } catch (error) {
            console.error('비밀번호 찾기 요청 실패:', error);
            setMessage('서버와 통신 중 오류가 발생했습니다.', true);
        } finally {
            setSubmitting(false);
        }
    });
});
