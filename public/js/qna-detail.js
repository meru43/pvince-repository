document.addEventListener('DOMContentLoaded', () => {
    const boardDetail = document.getElementById('qna-board-detail');
    const detailHead = document.getElementById('qna-detail-head');
    const detailContent = document.getElementById('qna-detail-content');
    const answerBoxWrap = document.getElementById('qna-answer-box-wrap');
    const detailNav = document.getElementById('qna-detail-nav');
    const prevLink = document.getElementById('qna-prev-link');
    const prevTitle = document.getElementById('qna-prev-title');
    const prevDate = document.getElementById('qna-prev-date');
    const nextLink = document.getElementById('qna-next-link');
    const nextTitle = document.getElementById('qna-next-title');
    const nextDate = document.getElementById('qna-next-date');

    const adminAnswerFormBox = document.getElementById('admin-answer-form-box');
    const adminAnswerForm = document.getElementById('admin-answer-form');
    const adminAnswerContent = document.getElementById('admin-answer-content');
    const adminAnswerOpenBtn = document.getElementById('admin-answer-open-btn');
    const adminAnswerCancelBtn = document.getElementById('admin-answer-cancel-btn');
    const adminAnswerEditBtn = document.getElementById('admin-answer-edit-btn');
    const adminAnswerDeleteBtn = document.getElementById('admin-answer-delete-btn');
    const adminAnswerEditor = document.getElementById('admin-answer-editor');
    const adminAnswerManage = document.getElementById('admin-answer-manage');

    const adminEditBtn = document.getElementById('admin-edit-btn');
    const adminDeleteBtn = document.getElementById('admin-delete-btn');
    const adminNoticeBtn = document.getElementById('admin-notice-btn');
    const adminEditBox = document.getElementById('admin-edit-box');
    const adminEditTitleInput = document.getElementById('admin-edit-title-input');
    const adminEditContentInput = document.getElementById('admin-edit-content-input');
    const adminEditSaveBtn = document.getElementById('admin-edit-save-btn');
    const adminEditCancelBtn = document.getElementById('admin-edit-cancel-btn');

    const guestActionBox = document.getElementById('guest-action-box');
    const guestPasswordInput = document.getElementById('guest-action-password');
    const guestEditBtn = document.getElementById('guest-edit-btn');
    const guestDeleteBtn = document.getElementById('guest-delete-btn');

    const pathParts = window.location.pathname.split('/');
    const postId = pathParts[pathParts.length - 1];

    let currentUser = null;
    let currentPost = null;
    let editGuestPassword = '';
    let adminEditContentEditor = null;
    let editorAssetsPromise = null;

    function setBoardLoading(isLoading) {
        if (!boardDetail) return;
        boardDetail.classList.toggle('is-loading', isLoading);
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[data-dynamic-src="${src}"]`);
            if (existingScript) {
                if (existingScript.dataset.loaded === 'true') {
                    resolve();
                    return;
                }

                existingScript.addEventListener('load', () => resolve(), { once: true });
                existingScript.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.dynamicSrc = src;
            script.addEventListener('load', () => {
                script.dataset.loaded = 'true';
                resolve();
            }, { once: true });
            script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
            document.body.appendChild(script);
        });
    }

    function ensureStylesheet(href) {
        if (document.querySelector(`link[data-dynamic-href="${href}"]`)) {
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.dynamicHref = href;
        document.head.appendChild(link);
    }

    function ensureEditorAssets() {
        if (window.createProductJoditEditor && window.Jodit) {
            return Promise.resolve();
        }

        if (editorAssetsPromise) {
            return editorAssetsPromise;
        }

        ensureStylesheet('https://cdn.jsdelivr.net/npm/jodit@4.2.47/es2021/jodit.min.css');
        editorAssetsPromise = loadScript('https://cdn.jsdelivr.net/npm/jodit@4.2.47/es2021/jodit.min.js')
            .then(() => loadScript('/js/jodit-product-editor.js'))
            .catch((error) => {
                editorAssetsPromise = null;
                throw error;
            });

        return editorAssetsPromise;
    }

    function getAdminEditContentEditor() {
        if (adminEditContentEditor || !window.createProductJoditEditor) {
            return adminEditContentEditor;
        }

        adminEditContentEditor = window.createProductJoditEditor(adminEditContentInput);
        return adminEditContentEditor;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return dateString || '';

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd}`;
    }

    function isAdminUser() {
        return !!(currentUser && currentUser.role === 'admin');
    }

    function isLoggedInOwner(post) {
        return !!(
            currentUser &&
            post &&
            post.user_id &&
            Number(currentUser.userId) === Number(post.user_id)
        );
    }

    function isGuestPost(post) {
        return !!(post && !post.user_id);
    }

    function renderAdjacentLink(link, titleElement, dateElement, emptyLabel, post) {
        if (!link || !titleElement || !dateElement) return;

        if (!post) {
            link.href = '#';
            link.classList.add('is-disabled');
            titleElement.textContent = `${emptyLabel}이 없습니다.`;
            dateElement.textContent = '';
            return;
        }

        link.href = `/qna-detail-page/${post.id}`;
        link.classList.remove('is-disabled');
        titleElement.textContent = post.title;
        dateElement.textContent = formatDate(post.created_at);
    }

    function renderAnswer(post) {
        if (post.answer_content) {
            answerBoxWrap.innerHTML = `
                <section class="answer-box">
                    <div class="answer-head">
                        <h3 class="answer-title">답변</h3>
                        <span class="answer-status done">답변 완료</span>
                    </div>
                    <div class="answer-content">
                        <div>${post.answer_content}</div>
                        <span class="answer-date">답변일 ${formatDate(post.answer_created_at)}</span>
                    </div>
                </section>
            `;
            return;
        }

        answerBoxWrap.innerHTML = `
            <section class="answer-box">
                <div class="answer-head">
                    <h3 class="answer-title">답변</h3>
                    <span class="answer-status waiting">답변 대기</span>
                </div>
                <div class="answer-content">
                    <p>아직 등록된 답변이 없습니다.</p>
                </div>
            </section>
        `;
    }

    function updateAnswerAdminUI(post) {
        const hasAnswer = !!(post.answer_content && post.answer_content.trim() !== '');

        if (!isAdminUser()) {
            if (adminAnswerFormBox) adminAnswerFormBox.style.display = 'none';
            return;
        }

        if (adminAnswerFormBox) adminAnswerFormBox.style.display = 'block';

        if (hasAnswer) {
            if (adminAnswerOpenBtn) adminAnswerOpenBtn.style.display = 'none';
            if (adminAnswerManage) adminAnswerManage.style.display = 'flex';
            if (adminAnswerEditor) adminAnswerEditor.style.display = 'none';
            if (adminAnswerContent) adminAnswerContent.value = '';
            return;
        }

        if (adminAnswerOpenBtn) adminAnswerOpenBtn.style.display = 'inline-flex';
        if (adminAnswerManage) adminAnswerManage.style.display = 'none';
        if (adminAnswerEditor) adminAnswerEditor.style.display = 'none';
        if (adminAnswerContent) adminAnswerContent.value = '';
    }

    function updateActionUI(post) {
        if (!post) return;

        const adminMode = isAdminUser();
        const ownerMode = isLoggedInOwner(post);
        const guestMode = !currentUser && isGuestPost(post);

        if (adminMode) {
            if (adminEditBtn) adminEditBtn.style.display = 'inline-flex';
            if (adminDeleteBtn) adminDeleteBtn.style.display = 'inline-flex';
            if (adminNoticeBtn) {
                adminNoticeBtn.style.display = 'inline-flex';
                adminNoticeBtn.textContent = post.is_notice ? '공지 해제' : '공지 설정';
            }
        } else {
            if (adminEditBtn) adminEditBtn.style.display = 'none';
            if (adminDeleteBtn) adminDeleteBtn.style.display = 'none';
            if (adminNoticeBtn) adminNoticeBtn.style.display = 'none';
        }

        if (guestActionBox) {
            guestActionBox.style.display = (ownerMode || guestMode) ? 'flex' : 'none';
        }

        if (guestPasswordInput) {
            guestPasswordInput.style.display = guestMode ? 'block' : 'none';
            if (!guestMode) guestPasswordInput.value = '';
        }

        if (guestEditBtn) guestEditBtn.style.display = (ownerMode || guestMode) ? 'inline-flex' : 'none';
        if (guestDeleteBtn) guestDeleteBtn.style.display = (ownerMode || guestMode) ? 'inline-flex' : 'none';

        updateAnswerAdminUI(post);
    }

    function openAnswerEditor(withValue = '') {
        if (adminAnswerEditor) adminAnswerEditor.style.display = 'block';
        if (adminAnswerContent) adminAnswerContent.value = withValue;
        if (adminAnswerManage) adminAnswerManage.style.display = 'none';
        if (adminAnswerOpenBtn) adminAnswerOpenBtn.style.display = 'none';
        adminAnswerContent?.focus();
    }

    function closeAnswerEditor() {
        if (adminAnswerEditor) adminAnswerEditor.style.display = 'none';
        if (adminAnswerContent) adminAnswerContent.value = '';
    }

    async function verifyGuestPassword(password) {
        const response = await fetch(`/api/qna/${postId}/verify-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ guestPassword: password })
        });

        return response.json();
    }

    async function openEditBox(post, guestPassword = '') {
        if (!adminEditBox || !adminEditTitleInput || !adminEditContentInput) return;

        editGuestPassword = guestPassword;
        adminEditTitleInput.value = post.title || '';

        try {
            await ensureEditorAssets();
        } catch (error) {
            console.error('Q&A editor assets load failed:', error);
            alert('에디터를 불러오는 중 오류가 발생했습니다.');
            return;
        }

        const editor = getAdminEditContentEditor();

        if (editor) {
            editor.value = post.content || '';
        } else {
            adminEditContentInput.value = post.content || '';
        }

        adminEditBox.style.display = 'block';
        adminEditTitleInput.focus();
    }

    function closeEditBox() {
        if (adminEditBox) adminEditBox.style.display = 'none';
        editGuestPassword = '';
    }

    async function updatePost({ title, content, guestPassword = '' }) {
        const response = await fetch(`/api/qna/${postId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title, content, guestPassword })
        });

        return response.json();
    }

    async function deletePost({ guestPassword = '' } = {}) {
        const response = await fetch(`/api/qna/${postId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ guestPassword })
        });

        return response.json();
    }

    async function loadPost() {
        try {
            const response = await fetch(`/api/qna/${postId}`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();

            if (!data.success) {
                detailHead.innerHTML = `<p class="empty-message">${data.message || '게시글을 불러오지 못했습니다.'}</p>`;
                detailContent.innerHTML = '';
                answerBoxWrap.innerHTML = '';
                if (detailNav) detailNav.hidden = true;
                setBoardLoading(false);
                return;
            }

            currentPost = data.post;

            detailHead.innerHTML = `
                <div class="detail-head-top">
                    <p class="detail-category">Q&amp;A BOARD</p>
                    <h2 class="detail-title">${data.post.title}</h2>
                </div>
                <div class="detail-meta">
                    <div class="detail-meta-group">
                        <span><strong>작성자</strong> ${data.post.writer}</span>
                    </div>
                    <div class="detail-meta-group">
                        <span><strong>작성일</strong> ${formatDate(data.post.created_at)}</span>
                        <span><strong>조회수</strong> ${data.post.views}</span>
                        <span><strong>구분</strong> ${data.post.is_notice ? '공지글' : '일반글'}</span>
                    </div>
                </div>
            `;

            detailContent.classList.remove('board-detail-content-skeleton');
            detailContent.innerHTML = `<div>${data.post.content || ''}</div>`;
            renderAnswer(data.post);
            updateActionUI(data.post);

            if (detailNav) detailNav.hidden = false;
            renderAdjacentLink(prevLink, prevTitle, prevDate, '이전글', data.previousPost);
            renderAdjacentLink(nextLink, nextTitle, nextDate, '다음글', data.nextPost);
            setBoardLoading(false);
        } catch (error) {
            console.error('Q&A 상세 불러오기 실패:', error);
            detailHead.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
            detailContent.innerHTML = '';
            answerBoxWrap.innerHTML = '';
            if (detailNav) detailNav.hidden = true;
            setBoardLoading(false);
        }
    }

    fetch('/me', {
        method: 'GET',
        credentials: 'include'
    })
        .then((response) => response.json())
        .then((meData) => {
            if (!meData.loggedIn) return;

            currentUser = meData;
            updateActionUI(currentPost);
        })
        .catch((error) => {
            console.error('로그인 상태 확인 실패:', error);
        });

    adminAnswerOpenBtn?.addEventListener('click', () => {
        openAnswerEditor('');
    });

    adminAnswerEditBtn?.addEventListener('click', () => {
        openAnswerEditor(currentPost?.answer_content || '');
    });

    adminAnswerCancelBtn?.addEventListener('click', () => {
        if (currentPost?.answer_content) {
            updateAnswerAdminUI(currentPost);
            return;
        }

        closeAnswerEditor();
        if (adminAnswerOpenBtn) adminAnswerOpenBtn.style.display = 'inline-flex';
    });

    adminAnswerForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const answerContent = adminAnswerContent.value.trim();
        if (!answerContent) {
            alert('답변 내용을 입력해주세요.');
            return;
        }

        try {
            const response = await fetch(`/api/qna/${postId}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ answerContent })
            });
            const data = await response.json();

            if (!data.success) {
                alert(data.message || '답변 등록에 실패했습니다.');
                return;
            }

            alert('답변이 등록되었습니다.');
            await loadPost();
        } catch (error) {
            console.error('답변 등록 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    adminAnswerDeleteBtn?.addEventListener('click', async () => {
        if (!confirm('등록된 답변을 삭제하시겠습니까?')) return;

        try {
            const response = await fetch(`/api/qna/${postId}/answer`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await response.json();

            if (!data.success) {
                alert(data.message || '답변 삭제에 실패했습니다.');
                return;
            }

            alert(data.message);
            await loadPost();
        } catch (error) {
            console.error('답변 삭제 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    adminEditBtn?.addEventListener('click', async () => {
        if (currentPost) await openEditBox(currentPost);
    });

    adminEditSaveBtn?.addEventListener('click', async () => {
        const newTitle = adminEditTitleInput.value.trim();
        const editor = getAdminEditContentEditor();
        const rawContent = editor ? editor.value : adminEditContentInput.value;
        const newContent = window.normalizeProductEditorHtml
            ? window.normalizeProductEditorHtml(rawContent).trim()
            : rawContent.trim();

        if (!newTitle || !newContent) {
            alert('제목과 내용을 입력해주세요.');
            return;
        }

        try {
            const data = await updatePost({
                title: newTitle,
                content: newContent,
                guestPassword: editGuestPassword
            });

            if (!data.success) {
                alert(data.message || '게시글 수정에 실패했습니다.');
                return;
            }

            alert(data.message);
            closeEditBox();
            await loadPost();
        } catch (error) {
            console.error('게시글 수정 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    adminEditCancelBtn?.addEventListener('click', () => {
        closeEditBox();
    });

    adminDeleteBtn?.addEventListener('click', async () => {
        if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;

        try {
            const data = await deletePost();
            if (!data.success) {
                alert(data.message || '게시글 삭제에 실패했습니다.');
                return;
            }

            alert(data.message);
            window.location.href = '/qna-page';
        } catch (error) {
            console.error('게시글 삭제 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    adminNoticeBtn?.addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/qna/${postId}/notice`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ isNotice: !currentPost.is_notice })
            });
            const data = await response.json();

            if (!data.success) {
                alert(data.message || '공지 설정에 실패했습니다.');
                return;
            }

            alert(data.message);
            await loadPost();
        } catch (error) {
            console.error('공지 설정 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    guestEditBtn?.addEventListener('click', async () => {
        if (!currentPost) return;

        if (isLoggedInOwner(currentPost)) {
            await openEditBox(currentPost);
            return;
        }

        const guestPassword = guestPasswordInput?.value.trim() || '';
        if (!guestPassword) {
            alert('비밀번호를 입력해주세요.');
            return;
        }

        const verifyData = await verifyGuestPassword(guestPassword);
        if (!verifyData.success) {
            alert(verifyData.message || '비밀번호가 올바르지 않습니다.');
            return;
        }

        await openEditBox(currentPost, guestPassword);
    });

    guestDeleteBtn?.addEventListener('click', async () => {
        if (!currentPost) return;
        if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;

        if (isLoggedInOwner(currentPost)) {
            try {
                const data = await deletePost();
                if (!data.success) {
                    alert(data.message || '게시글 삭제에 실패했습니다.');
                    return;
                }

                alert(data.message);
                window.location.href = '/qna-page';
            } catch (error) {
                console.error('회원 게시글 삭제 실패:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            }
            return;
        }

        const guestPassword = guestPasswordInput?.value.trim() || '';
        if (!guestPassword) {
            alert('비밀번호를 입력해주세요.');
            return;
        }

        const verifyData = await verifyGuestPassword(guestPassword);
        if (!verifyData.success) {
            alert(verifyData.message || '비밀번호가 올바르지 않습니다.');
            return;
        }

        try {
            const data = await deletePost({ guestPassword });
            if (!data.success) {
                alert(data.message || '게시글 삭제에 실패했습니다.');
                return;
            }

            alert(data.message);
            window.location.href = '/qna-page';
        } catch (error) {
            console.error('비회원 게시글 삭제 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });

    loadPost();
});
