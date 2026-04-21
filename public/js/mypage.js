document.addEventListener('DOMContentLoaded', async () => {
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const accountUsername = document.getElementById('account-username');
    const accountNickname = document.getElementById('account-nickname');
    const accountStatus = document.getElementById('account-status');

    const nicknameInput = document.getElementById('nickname-input');
    const nicknameCheckBtn = document.getElementById('nickname-check-btn');
    const nicknameSaveBtn = document.getElementById('nickname-save-btn');
    const nicknameMessage = document.getElementById('nickname-message');

    let nicknameChecked = false;
    let checkedNicknameValue = '';

    async function loadMyInfo() {
        const meResponse = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });

        const meData = await meResponse.json();

        if (!meData.loggedIn) {
            alert('로그인이 필요합니다.');
            window.location.href = '/login-page';
            return;
        }

        profileName.textContent = `${meData.nickname || meData.username} 님`;
        profileEmail.textContent = '로그인된 회원입니다.';
        accountUsername.textContent = meData.username;
        accountNickname.textContent = meData.nickname || '-';
        accountStatus.textContent = '로그인됨';

        nicknameInput.value = meData.nickname || '';
    }

    nicknameInput.addEventListener('input', () => {
        nicknameChecked = false;
        checkedNicknameValue = '';
        nicknameMessage.textContent = '';
    });

    nicknameCheckBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();

        nicknameMessage.textContent = '';

        if (!nickname) {
            nicknameMessage.textContent = '닉네임을 입력해주세요.';
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
                nicknameMessage.textContent = data.message;
            } else {
                nicknameChecked = false;
                checkedNicknameValue = '';
                nicknameMessage.textContent = data.message || '중복확인에 실패했습니다.';
            }
        } catch (error) {
            console.error('닉네임 중복확인 실패:', error);
            nicknameMessage.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });

    nicknameSaveBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();

        if (!nickname) {
            nicknameMessage.textContent = '닉네임을 입력해주세요.';
            return;
        }

        if (!nicknameChecked || checkedNicknameValue !== nickname) {
            nicknameMessage.textContent = '닉네임 중복확인을 완료해주세요.';
            return;
        }

        try {
            const response = await fetch('/my-nickname', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ nickname })
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                nicknameChecked = false;
                checkedNicknameValue = '';
                nicknameMessage.textContent = '';
                await loadMyInfo();
            } else {
                nicknameMessage.textContent = data.message || '닉네임 변경에 실패했습니다.';
            }
        } catch (error) {
            console.error('닉네임 변경 실패:', error);
            nicknameMessage.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });

    await loadMyInfo();
});