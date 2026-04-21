document.addEventListener('DOMContentLoaded', async () => {
    const detailHead = document.getElementById('qna-detail-head');
    const detailContent = document.getElementById('qna-detail-content');
    const answerBoxWrap = document.getElementById('qna-answer-box-wrap');
    const adminAnswerFormBox = document.getElementById('admin-answer-form-box');
    const adminAnswerForm = document.getElementById('admin-answer-form');
    const adminAnswerContent = document.getElementById('admin-answer-content');

    const pathParts = window.location.pathname.split('/');
    const postId = pathParts[pathParts.length - 1];

    let currentUser = null;

    function formatDate(dateString) {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return dateString;

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd}`;
    }

    function renderAnswer(post) {
        if (post.answer_content) {
            answerBoxWrap.innerHTML = `
                <section class="answer-box">
                    <div class="answer-head">
                        <h3 class="answer-title">답변</h3>
                        <span class="answer-status done">답변완료</span>
                    </div>

                    <div class="answer-content">
                        <p>${post.answer_content.replace(/\n/g, '<br>')}</p>
                        <p>답변일: ${formatDate(post.answer_created_at)}</p>
                    </div>
                </section>
            `;
        } else {
            answerBoxWrap.innerHTML = `
                <section class="answer-box">
                    <div class="answer-head">
                        <h3 class="answer-title">답변</h3>
                        <span class="answer-status waiting">답변대기</span>
                    </div>

                    <div class="answer-content">
                        <p>아직 등록된 답변이 없습니다.</p>
                    </div>
                </section>
            `;
        }
    }

    async function loadPost() {
        try {
            const response = await fetch(`/api/qna/${postId}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();
            console.log('Q&A 상세 응답:', data);

            if (!data.success) {
                detailHead.innerHTML = `<p class="empty-message">${data.message || '게시글을 불러오지 못했습니다.'}</p>`;
                detailContent.innerHTML = '';
                answerBoxWrap.innerHTML = '';
                return;
            }

            const post = data.post;

            detailHead.innerHTML = `
                <div class="detail-head-top">
                    <p class="detail-category">Q&A 게시판</p>
                    <h2 class="detail-title">${post.title}</h2>
                </div>

                <div class="detail-meta">
                    <span>작성자: ${post.writer}</span>
                    <span>등록일: ${formatDate(post.created_at)}</span>
                    <span>조회: ${post.views}</span>
                </div>
            `;

            detailContent.innerHTML = `
                <p>${post.content.replace(/\n/g, '<br>')}</p>
            `;

            renderAnswer(post);

            if (currentUser && currentUser.username === 'admin') {
                adminAnswerFormBox.style.display = 'block';
                adminAnswerContent.value = post.answer_content || '';
            } else {
                adminAnswerFormBox.style.display = 'none';
            }

        } catch (error) {
            console.error('Q&A 상세 불러오기 실패:', error);
            detailHead.innerHTML = `<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>`;
            detailContent.innerHTML = '';
            answerBoxWrap.innerHTML = '';
        }
    }

    try {
        const meResponse = await fetch('/me', {
            method: 'GET',
            credentials: 'include'
        });

        const meData = await meResponse.json();

        if (meData.loggedIn) {
            currentUser = meData;
        }
    } catch (error) {
        console.error('로그인 상태 확인 실패:', error);
    }

    if (adminAnswerForm) {
        adminAnswerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const answerContent = adminAnswerContent.value.trim();

            if (!answerContent) {
                alert('답변 내용을 입력해주세요.');
                return;
            }

            try {
                const response = await fetch(`/api/qna/${postId}/answer`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        answerContent
                    })
                });

                const data = await response.json();

                if (data.success) {
                    alert('답변이 등록되었습니다.');
                    await loadPost();
                } else {
                    alert(data.message || '답변 등록에 실패했습니다.');
                }
            } catch (error) {
                console.error('답변 등록 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }
        });
    }

    await loadPost();
});