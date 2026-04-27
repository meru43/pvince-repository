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

    // 관리자 회원 목록 페이지
    router.get('/admin-users-page', (req, res) => {
        if (!req.session.userId) {
            return res.redirect('/login-page');
        }

        if (req.session.role !== 'admin') {
            return res.redirect('/');
        }

        res.render('admin-users');
    });

    // 회원 목록 조회 API
    router.get('/api/admin/users', requireAdmin, (req, res) => {
        const q = (req.query.q || '').trim();

        let sql = `
            SELECT
                id,
                username,
                nickname,
                email,
                name,
                phone,
                role,
                profile_image,
                is_active,
                google_id,
                google_email
            FROM users
            WHERE 1 = 1
        `;

        const params = [];

        if (q) {
            sql += `
                AND (
                    username LIKE ?
                    OR nickname LIKE ?
                    OR email LIKE ?
                    OR name LIKE ?
                    OR phone LIKE ?
                )
            `;
            const likeValue = `%${q}%`;
            params.push(likeValue, likeValue, likeValue, likeValue, likeValue);
        }

        sql += ` ORDER BY id DESC`;

        db.query(sql, params, (err, results) => {
            if (err) {
                console.error('회원 목록 조회 오류:', err);
                return res.json({
                    success: false,
                    message: '회원 목록을 불러오지 못했습니다.'
                });
            }

            return res.json({
                success: true,
                users: results
            });
        });
    });

    // 회원 role 변경 API
    router.patch('/api/admin/users/:id/role', requireAdmin, (req, res) => {
        const userId = req.params.id;
        const { role } = req.body;

        const allowedRoles = ['member', 'seller'];

        if (!allowedRoles.includes(role)) {
            return res.json({
                success: false,
                message: '변경 가능한 권한은 member 또는 seller만 가능합니다.'
            });
        }

        const checkSql = `
            SELECT id, username, role
            FROM users
            WHERE id = ?
            LIMIT 1
        `;

        db.query(checkSql, [userId], (checkErr, results) => {
            if (checkErr) {
                console.error('회원 확인 오류:', checkErr);
                return res.json({
                    success: false,
                    message: '회원 정보를 확인하지 못했습니다.'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '대상 회원을 찾을 수 없습니다.'
                });
            }

            const targetUser = results[0];

            if (targetUser.role === 'admin') {
                return res.json({
                    success: false,
                    message: 'admin 계정의 권한은 여기서 변경할 수 없습니다.'
                });
            }

            const updateSql = `
                UPDATE users
                SET role = ?
                WHERE id = ?
            `;

            db.query(updateSql, [role, userId], (updateErr) => {
                if (updateErr) {
                    console.error('회원 권한 변경 오류:', updateErr);
                    return res.json({
                        success: false,
                        message: '회원 권한 변경에 실패했습니다.'
                    });
                }

                return res.json({
                    success: true,
                    message: '회원 권한이 변경되었습니다.'
                });
            });
        });
    });

    // 활동중지 / 활동재개 API
    router.patch('/api/admin/users/:id/status', requireAdmin, (req, res) => {
        const userId = req.params.id;
        const { isActive } = req.body;

        if (isActive !== 0 && isActive !== 1 && isActive !== '0' && isActive !== '1') {
            return res.json({
                success: false,
                message: '올바른 회원 상태 값이 아닙니다.'
            });
        }

        const nextValue = Number(isActive);

        const checkSql = `
            SELECT id, username, role, is_active
            FROM users
            WHERE id = ?
            LIMIT 1
        `;

        db.query(checkSql, [userId], (checkErr, results) => {
            if (checkErr) {
                console.error('회원 상태 확인 오류:', checkErr);
                return res.json({
                    success: false,
                    message: '회원 정보를 확인하지 못했습니다.'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '대상 회원을 찾을 수 없습니다.'
                });
            }

            const targetUser = results[0];

            if (targetUser.role === 'admin') {
                return res.json({
                    success: false,
                    message: 'admin 계정은 활동중지할 수 없습니다.'
                });
            }

            const updateSql = `
                UPDATE users
                SET is_active = ?
                WHERE id = ?
            `;

            db.query(updateSql, [nextValue, userId], (updateErr) => {
                if (updateErr) {
                    console.error('회원 상태 변경 오류:', updateErr);
                    return res.json({
                        success: false,
                        message: '회원 상태 변경에 실패했습니다.'
                    });
                }

                return res.json({
                    success: true,
                    message: nextValue === 1
                        ? '회원 활동이 다시 활성화되었습니다.'
                        : '회원 활동이 중지되었습니다.'
                });
            });
        });
    });

    // 회원 비밀번호 초기화 API
    router.patch('/api/admin/users/:id/reset-password', requireAdmin, async (req, res) => {
        const userId = req.params.id;

        const checkSql = `
            SELECT id, username, role
            FROM users
            WHERE id = ?
            LIMIT 1
        `;

        db.query(checkSql, [userId], async (checkErr, results) => {
            if (checkErr) {
                console.error('비밀번호 초기화 대상 확인 오류:', checkErr);
                return res.json({
                    success: false,
                    message: '회원 정보를 확인하지 못했습니다.'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '대상 회원을 찾을 수 없습니다.'
                });
            }

            const targetUser = results[0];

            if (targetUser.role === 'admin') {
                return res.json({
                    success: false,
                    message: 'admin 계정의 비밀번호는 여기서 초기화할 수 없습니다.'
                });
            }

            try {
                const tempPassword = `SJ${Math.floor(100000 + Math.random() * 900000)}`;
                const hashedPassword = await bcrypt.hash(tempPassword, 10);

                const updateSql = `
                    UPDATE users
                    SET password = ?
                    WHERE id = ?
                `;

                db.query(updateSql, [hashedPassword, userId], (updateErr) => {
                    if (updateErr) {
                        console.error('비밀번호 초기화 오류:', updateErr);
                        return res.json({
                            success: false,
                            message: '비밀번호 초기화에 실패했습니다.'
                        });
                    }

                    return res.json({
                        success: true,
                        message: '비밀번호가 초기화되었습니다.',
                        tempPassword
                    });
                });
            } catch (error) {
                console.error('임시 비밀번호 처리 오류:', error);
                return res.json({
                    success: false,
                    message: '임시 비밀번호 처리에 실패했습니다.'
                });
            }
        });
    });

    return router;
};
