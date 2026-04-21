document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.write-form');
    const titleInput = document.getElementById('write-title');
    const writerInput = document.getElementById('write-name');
    const contentInput = document.getElementById('write-content');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = titleInput.value.trim();
        const writer = writerInput.value.trim();
        const content = contentInput.value.trim();

        if (!title || !writer || !content) {
            alert('제목, 작성자, 내용을 모두 입력해주세요.');
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
                    content
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