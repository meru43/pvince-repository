const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // 글저장
    router.post('/api/qna', (req, res) => {
        const title = req.body.title?.trim();
        const writer = req.body.writer?.trim();
        const content = req.body.content?.trim();

        console.log('Q&A 저장 요청값:', { title, writer, content });

        if (!title || !writer || !content) {
            return res.json({
                success: false,
                message: '제목, 작성자, 내용을 모두 입력해주세요.'
            });
        }

        const sql = `
      INSERT INTO qna_posts (title, writer, content)
      VALUES (?, ?, ?)
    `;

        db.query(sql, [title, writer, content], (err, result) => {
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
    });

    // 목록조회
    router.get('/api/qna', (req, res) => {
        const sql = `
      SELECT
        id,
        title,
        writer,
        is_notice,
        views,
        created_at,
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
          content,
          is_notice,
          views,
          created_at,
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

    // 관리자 답변
    router.post('/api/qna/:id/answer', (req, res) => {
        const postId = req.params.id;
        const answerContent = req.body.answerContent?.trim();

        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

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

    return router;
};