document.addEventListener('DOMContentLoaded', async () => {
    const form = document.querySelector('.write-form');
    const titleInput = document.getElementById('write-title');
    const writerInput = document.getElementById('write-name');
    const contentInput = document.getElementById('write-content');
    const writerGroup = document.getElementById('writer-group');
    const guestPasswordInput = document.getElementById('guest-password');
    const guestPasswordGroup = document.getElementById('guest-password-group');

    let currentUser = null;

    try {
        const meResponse = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });

        const meData = await meResponse.json();

        if (meData.loggedIn) {
            currentUser = meData;
            if (writerGroup) writerGroup.style.display = 'none';
            if (guestPasswordGroup) guestPasswordGroup.style.display = 'none';
        }
    } catch (error) {
        console.error('로그인 상태 확인 실패:', error);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        const writer = currentUser
            ? (currentUser.nickname || currentUser.username)
            : writerInput.value.trim();

        const guestPassword = currentUser ? '' : (guestPasswordInput?.value.trim() || '');

        if (!title || !content || !writer) {
            alert('제목, 작성자, 내용을 모두 입력해주세요.');
            return;
        }

        if (!currentUser && !guestPassword) {
            alert('비밀번호를 입력해주세요.');
            return;
        }

        try {
            const response = await fetch('/api/qna', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    title,
                    writer,
                    content,
                    guestPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('글이 등록되었습니다.');
                window.location.href = '/qna-page';
            } else {
                alert(data.message || '글 등록에 실패했습니다.');
            }
        } catch (error) {
            console.error('Q&A 글 등록 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });
});