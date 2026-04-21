document.addEventListener('DOMContentLoaded', async () => {
    const qnaListBox = document.getElementById('qna-list-box');

    function formatDate(dateString) {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return dateString;

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd}`;
    }

    function getStatusBadge(post) {
        if (post.answer_content && post.answer_content.trim() !== '') {
            return `<span class="status-badge done">답변완료</span>`;
        }
        return `<span class="status-badge waiting">답변대기</span>`;
    }

    function renderPosts(posts) {
        if (!posts || posts.length === 0) {
            qnaListBox.innerHTML = `<p class="empty-message">등록된 게시글이 없습니다.</p>`;
            return;
        }

        qnaListBox.innerHTML = posts.map(post => `
            <a href="/qna-detail-page/${post.id}" class="board-row ${post.is_notice ? 'notice-row' : ''}">
                <span class="col-number">
                    ${post.is_notice ? '<em class="notice-badge">공지</em>' : post.id}
                </span>
                <span class="col-title">
                    ${post.is_notice ? '<strong>[공지]</strong> ' : ''}${post.title}
                </span>
                <span class="col-writer">${post.writer}</span>
                <span class="col-status">${getStatusBadge(post)}</span>
                <span class="col-date">${formatDate(post.created_at)}</span>
                <span class="col-view">${post.views}</span>
            </a>
        `).join('');
    }

    try {
        const response = await fetch('/api/qna', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();
        console.log('Q&A 목록 응답:', data);

        if (data.success) {
            renderPosts(data.posts);
        } else {
            qnaListBox.innerHTML = `<p class="empty-message">${data.message || '게시글을 불러오지 못했습니다.'}</p>`;
        }
    } catch (error) {
        console.error('Q&A 목록 불러오기 실패:', error);
        qnaListBox.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
    }
});