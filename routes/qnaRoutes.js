const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = (db) => {
    const router = express.Router();

    function requireAdmin(req, res, next) {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        if (req.session.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '관리자만 접근할 수 있습니다.'
            });
        }

        next();
    }

    // 글 저장
    router.post('/api/qna', async (req, res) => {
        const title = req.body.title?.trim();
        const content = req.body.content?.trim();

        const loggedIn = !!req.session.userId;
        const writer = loggedIn
            ? (req.session.nickname || req.session.username)
            : req.body.writer?.trim();

        const userId = loggedIn ? req.session.userId : null;
        const guestPassword = loggedIn ? null : req.body.guestPassword?.trim();

        if (!title || !content || !writer) {
            return res.json({
                success: false,
                message: '제목, 작성자, 내용을 모두 입력해주세요.'
            });
        }

        if (!loggedIn && !guestPassword) {
            return res.json({
                success: false,
                message: '비회원은 비밀번호를 입력해야 합니다.'
            });
        }

        try {
            const hashedGuestPassword = (!loggedIn && guestPassword)
                ? await bcrypt.hash(guestPassword, 10)
                : null;

            const sql = `
                INSERT INTO qna_posts (title, writer, content, user_id, guest_password)
                VALUES (?, ?, ?, ?, ?)
            `;

            db.query(sql, [title, writer, content, userId, hashedGuestPassword], (err, result) => {
                if (err) {
                    console.error('Q&A 글 저장 오류:', err);
                    return res.json({
                        success: false,
                        message: '글 저장에 실패했습니다.'
                    });
                }

                return res.json({
                    success: true,
                    message: '글이 등록되었습니다.',
                    postId: result.insertId
                });
            });
        } catch (error) {
            console.error('Q&A 비밀번호 처리 오류:', error);
            return res.json({
                success: false,
                message: '비밀번호 처리에 실패했습니다.'
            });
        }
    });

    // 목록조회
    router.get('/api/qna', (req, res) => {
        const sql = `
            SELECT
                id,
                title,
                writer,
                user_id,
                is_notice,
                views,
                created_at,
                updated_at,
                answer_content
            FROM qna_posts
            ORDER BY is_notice DESC, id DESC
        `;

        db.query(sql, (err, results) => {
            if (err) {
                console.error('Q&A 목록 조회 오류:', err);
                return res.json({
                    success: false,
                    message: '목록을 불러오지 못했습니다.'
                });
            }

            return res.json({
                success: true,
                posts: results
            });
        });
    });

    // 상세조회 + 조회수 증가
    router.get('/api/qna/:id', (req, res) => {
        const postId = req.params.id;

        const updateSql = 'UPDATE qna_posts SET views = views + 1 WHERE id = ?';

        db.query(updateSql, [postId], (updateErr) => {
            if (updateErr) {
                console.error('조회수 증가 오류:', updateErr);
            }

            const selectSql = `
                SELECT
                    id,
                    title,
                    writer,
                    user_id,
                    content,
                    is_notice,
                    views,
                    created_at,
                    updated_at,
                    answer_content,
                    answer_created_at
                FROM qna_posts
                WHERE id = ?
            `;

            db.query(selectSql, [postId], (err, results) => {
                if (err) {
                    console.error('Q&A 상세 조회 오류:', err);
                    return res.json({
                        success: false,
                        message: '상세 내용을 불러오지 못했습니다.'
                    });
                }

                if (results.length === 0) {
                    return res.json({
                        success: false,
                        message: '게시글을 찾을 수 없습니다.'
                    });
                }

                return res.json({
                    success: true,
                    post: results[0]
                });
            });
        });
    });

    // 비회원 비밀번호 확인
    router.post('/api/qna/:id/verify-password', async (req, res) => {
        const postId = req.params.id;
        const guestPassword = req.body.guestPassword?.trim();

        if (!guestPassword) {
            return res.json({
                success: false,
                message: '비밀번호를 입력해주세요.'
            });
        }

        const sql = `
            SELECT id, guest_password, user_id
            FROM qna_posts
            WHERE id = ?
            LIMIT 1
        `;

        db.query(sql, [postId], async (err, results) => {
            if (err) {
                console.error('Q&A 비밀번호 확인 오류:', err);
                return res.json({
                    success: false,
                    message: '비밀번호 확인에 실패했습니다.'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '게시글을 찾을 수 없습니다.'
                });
            }

            const post = results[0];

            if (post.user_id) {
                return res.json({
                    success: false,
                    message: '회원이 작성한 글입니다.'
                });
            }

            try {
                const isMatch = await bcrypt.compare(guestPassword, post.guest_password || '');

                if (!isMatch) {
                    return res.json({
                        success: false,
                        message: '비밀번호가 올바르지 않습니다.'
                    });
                }

                return res.json({
                    success: true,
                    message: '비밀번호가 확인되었습니다.'
                });
            } catch (error) {
                console.error('Q&A 비밀번호 비교 오류:', error);
                return res.json({
                    success: false,
                    message: '비밀번호 비교에 실패했습니다.'
                });
            }
        });
    });

    // 게시글 수정 (관리자 또는 본인/비회원 비밀번호 확인)
    router.patch('/api/qna/:id', async (req, res) => {
        const postId = req.params.id;
        const title = req.body.title?.trim();
        const content = req.body.content?.trim();
        const guestPassword = req.body.guestPassword?.trim();

        if (!title || !content) {
            return res.json({
                success: false,
                message: '제목과 내용을 입력해주세요.'
            });
        }

        const checkSql = `
            SELECT id, user_id, guest_password
            FROM qna_posts
            WHERE id = ?
            LIMIT 1
        `;

        db.query(checkSql, [postId], async (checkErr, results) => {
            if (checkErr) {
                console.error('Q&A 수정 권한 확인 오류:', checkErr);
                return res.json({
                    success: false,
                    message: '게시글 정보를 확인하지 못했습니다.'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '게시글을 찾을 수 없습니다.'
                });
            }

            const post = results[0];
            const isAdmin = req.session.role === 'admin';
            const isOwner = req.session.userId && Number(req.session.userId) === Number(post.user_id);

            if (!isAdmin && !isOwner) {
                if (!guestPassword) {
                    return res.json({
                        success: false,
                        message: '비밀번호를 입력해주세요.'
                    });
                }

                const isMatch = await bcrypt.compare(guestPassword, post.guest_password || '');
                if (!isMatch) {
                    return res.json({
                        success: false,
                        message: '비밀번호가 올바르지 않습니다.'
                    });
                }
            }

            const sql = `
                UPDATE qna_posts
                SET title = ?, content = ?, updated_at = NOW()
                WHERE id = ?
            `;

            db.query(sql, [title, content, postId], (err) => {
                if (err) {
                    console.error('Q&A 게시글 수정 오류:', err);
                    return res.json({
                        success: false,
                        message: '게시글 수정에 실패했습니다.'
                    });
                }

                return res.json({
                    success: true,
                    message: '게시글이 수정되었습니다.'
                });
            });
        });
    });

    // 게시글 삭제 (관리자 또는 본인/비회원 비밀번호 확인)
    router.delete('/api/qna/:id', async (req, res) => {
        const postId = req.params.id;
        const guestPassword = req.body?.guestPassword?.trim();

        const checkSql = `
            SELECT id, user_id, guest_password
            FROM qna_posts
            WHERE id = ?
            LIMIT 1
        `;

        db.query(checkSql, [postId], async (checkErr, results) => {
            if (checkErr) {
                console.error('Q&A 삭제 권한 확인 오류:', checkErr);
                return res.json({
                    success: false,
                    message: '게시글 정보를 확인하지 못했습니다.'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '게시글을 찾을 수 없습니다.'
                });
            }

            const post = results[0];
            const isAdmin = req.session.role === 'admin';
            const isOwner = req.session.userId && Number(req.session.userId) === Number(post.user_id);

            if (!isAdmin && !isOwner) {
                if (!guestPassword) {
                    return res.json({
                        success: false,
                        message: '비밀번호를 입력해주세요.'
                    });
                }

                const isMatch = await bcrypt.compare(guestPassword, post.guest_password || '');
                if (!isMatch) {
                    return res.json({
                        success: false,
                        message: '비밀번호가 올바르지 않습니다.'
                    });
                }
            }

            const sql = `DELETE FROM qna_posts WHERE id = ?`;

            db.query(sql, [postId], (err) => {
                if (err) {
                    console.error('Q&A 게시글 삭제 오류:', err);
                    return res.json({
                        success: false,
                        message: '게시글 삭제에 실패했습니다.'
                    });
                }

                return res.json({
                    success: true,
                    message: '게시글이 삭제되었습니다.'
                });
            });
        });
    });

    // 관리자 답변
    router.post('/api/qna/:id/answer', requireAdmin, (req, res) => {
        const postId = req.params.id;
        const answerContent = req.body.answerContent?.trim();

        if (!answerContent) {
            return res.json({
                success: false,
                message: '답변 내용을 입력해주세요.'
            });
        }

        const sql = `
            UPDATE qna_posts
            SET answer_content = ?, answer_created_at = NOW()
            WHERE id = ?
        `;

        db.query(sql, [answerContent, postId], (err) => {
            if (err) {
                console.error('Q&A 답변 저장 오류:', err);
                return res.json({
                    success: false,
                    message: '답변 저장에 실패했습니다.'
                });
            }

            return res.json({
                success: true,
                message: '답변이 등록되었습니다.'
            });
        });
    });

    router.delete('/api/qna/:id/answer', requireAdmin, (req, res) => {
        const postId = req.params.id;

        const sql = `
            UPDATE qna_posts
            SET answer_content = NULL, answer_created_at = NULL
            WHERE id = ?
        `;

        db.query(sql, [postId], (err) => {
            if (err) {
                console.error('Q&A 답변 삭제 오류:', err);
                return res.json({
                    success: false,
                    message: '답변 삭제에 실패했습니다.'
                });
            }

            return res.json({
                success: true,
                message: '답변이 삭제되었습니다.'
            });
        });
    });

    // 관리자 공지 설정/해제
    router.patch('/api/qna/:id/notice', requireAdmin, (req, res) => {
        const postId = req.params.id;
        const { isNotice } = req.body;

        const sql = `
            UPDATE qna_posts
            SET is_notice = ?
            WHERE id = ?
        `;

        db.query(sql, [isNotice ? 1 : 0, postId], (err) => {
            if (err) {
                console.error('Q&A 공지 설정 오류:', err);
                return res.json({
                    success: false,
                    message: '공지 설정에 실패했습니다.'
                });
            }

            return res.json({
                success: true,
                message: isNotice ? '공지글로 설정되었습니다.' : '공지글이 해제되었습니다.'
            });
        });
    });

    return router;
};