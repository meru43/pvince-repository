const express = require('express');

module.exports = (db, bcrypt) => {
    const router = express.Router();

    // 회원가입
    router.post('/register', (req, res) => {
        const username = req.body.username?.trim();
        const password = req.body.password?.trim();
        const nickname = req.body.nickname?.trim();

        console.log('회원가입 요청값:', { username, nickname });

        if (!username || !password || !nickname) {
            return res.json({
                success: false,
                message: '아이디, 비밀번호, 닉네임을 입력해주세요.'
            });
        }

        const checkUsernameSql = 'SELECT id FROM users WHERE username = ? LIMIT 1';
        const checkNicknameSql = 'SELECT id FROM users WHERE nickname = ? LIMIT 1';

        db.query(checkUsernameSql, [username], (usernameErr, usernameResults) => {
            if (usernameErr) {
                console.error('아이디 중복 확인 오류:', usernameErr);
                return res.json({
                    success: false,
                    message: '서버 오류'
                });
            }

            if (usernameResults.length > 0) {
                return res.json({
                    success: false,
                    message: '이미 존재하는 아이디입니다.'
                });
            }

            db.query(checkNicknameSql, [nickname], async (nicknameErr, nicknameResults) => {
                if (nicknameErr) {
                    console.error('닉네임 중복 확인 오류:', nicknameErr);
                    return res.json({
                        success: false,
                        message: '서버 오류'
                    });
                }

                if (nicknameResults.length > 0) {
                    return res.json({
                        success: false,
                        message: '이미 사용 중인 닉네임입니다.'
                    });
                }

                try {
                    const hashedPassword = await bcrypt.hash(password, 10);

                    const insertSql = `
                        INSERT INTO users (username, password, nickname, role)
                        VALUES (?, ?, ?, ?)
                    `;

                    db.query(insertSql, [username, hashedPassword, nickname, 'member'], (insertErr) => {
                        if (insertErr) {
                            console.error('회원가입 오류:', insertErr);
                            return res.json({
                                success: false,
                                message: '회원가입 실패'
                            });
                        }

                        return res.json({
                            success: true,
                            message: '회원가입 완료'
                        });
                    });
                } catch (error) {
                    console.error('비밀번호 암호화 오류:', error);
                    return res.json({
                        success: false,
                        message: '암호화 처리 실패'
                    });
                }
            });
        });
    });

    // 닉네임 중복 확인
    router.post('/check-nickname', (req, res) => {
        const nickname = req.body.nickname?.trim();

        if (!nickname) {
            return res.json({
                success: false,
                message: '닉네임을 입력해주세요.'
            });
        }

        const sql = 'SELECT id FROM users WHERE nickname = ? LIMIT 1';

        db.query(sql, [nickname], (err, results) => {
            if (err) {
                console.error('닉네임 중복 확인 오류:', err);
                return res.json({
                    success: false,
                    message: '닉네임 확인에 실패했습니다.'
                });
            }

            if (results.length > 0) {
                return res.json({
                    success: false,
                    message: '이미 사용 중인 닉네임입니다.'
                });
            }

            return res.json({
                success: true,
                message: '사용 가능한 닉네임입니다.'
            });
        });
    });

    // 닉네임 변경
    router.patch('/my-nickname', (req, res) => {
        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        const nickname = req.body.nickname?.trim();

        if (!nickname) {
            return res.json({
                success: false,
                message: '닉네임을 입력해주세요.'
            });
        }

        const checkSql = 'SELECT id FROM users WHERE nickname = ? AND id != ? LIMIT 1';

        db.query(checkSql, [nickname, req.session.userId], (checkErr, checkResults) => {
            if (checkErr) {
                console.error('닉네임 중복 확인 오류:', checkErr);
                return res.json({
                    success: false,
                    message: '닉네임 확인에 실패했습니다.'
                });
            }

            if (checkResults.length > 0) {
                return res.json({
                    success: false,
                    message: '이미 사용 중인 닉네임입니다.'
                });
            }

            const updateSql = 'UPDATE users SET nickname = ? WHERE id = ?';

            db.query(updateSql, [nickname, req.session.userId], (updateErr) => {
                if (updateErr) {
                    console.error('닉네임 변경 오류:', updateErr);
                    return res.json({
                        success: false,
                        message: '닉네임 변경에 실패했습니다.'
                    });
                }

                req.session.nickname = nickname;

                return res.json({
                    success: true,
                    message: '닉네임이 변경되었습니다.',
                    nickname
                });
            });
        });
    });

    // 로그인
    router.post('/login', (req, res) => {
        const username = req.body.username?.trim();
        const password = req.body.password?.trim();

        console.log('로그인 요청값:', { username });

        if (!username || !password) {
            return res.json({
                success: false,
                message: '아이디와 비밀번호를 입력해주세요.'
            });
        }

        const loginSql = 'SELECT * FROM users WHERE username = ?';

        db.query(loginSql, [username], async (err, results) => {
            if (err) {
                console.error('로그인 오류:', err);
                return res.json({
                    success: false,
                    message: '서버 오류'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '아이디 또는 비밀번호가 틀렸습니다.'
                });
            }

            const user = results[0];

            try {
                const isMatch = await bcrypt.compare(password, user.password);

                if (!isMatch) {
                    return res.json({
                        success: false,
                        message: '아이디 또는 비밀번호가 틀렸습니다.'
                    });
                }

                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.nickname = user.nickname;
                req.session.role = user.role;

                return res.json({
                    success: true,
                    message: '로그인 성공',
                    username: user.username,
                    nickname: user.nickname,
                    role: user.role
                });
            } catch (error) {
                console.error('비밀번호 비교 오류:', error);
                return res.json({
                    success: false,
                    message: '로그인 처리 실패'
                });
            }
        });
    });

    // 로그인 상태 확인
    router.get('/me', (req, res) => {
        if (req.session.userId) {
            return res.json({
                loggedIn: true,
                userId: req.session.userId,
                username: req.session.username,
                nickname: req.session.nickname,
                role: req.session.role
            });
        } else {
            return res.json({
                loggedIn: false
            });
        }
    });

    // 로그아웃
    router.post('/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                return res.json({
                    success: false,
                    message: '로그아웃 실패'
                });
            }

            res.clearCookie('connect.sid');

            return res.json({
                success: true,
                message: '로그아웃 완료'
            });
        });
    });

    return router;
};