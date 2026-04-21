const express = require('express');

module.exports = (db, bcrypt) => {
    const router = express.Router();

    // 회원가입
    router.post('/register', (req, res) => {
        const username = req.body.username?.trim();
        const password = req.body.password?.trim();

        console.log('회원가입 요청값:', { username, password });

        if (!username || !password) {
            return res.json({
                success: false,
                message: '아이디와 비밀번호를 입력해주세요.'
            });
        }

        const checkSql = 'SELECT * FROM users WHERE username = ?';

        db.query(checkSql, [username], async (err, results) => {
            if (err) {
                console.error('중복 확인 오류:', err);
                return res.json({
                    success: false,
                    message: '서버 오류'
                });
            }

            if (results.length > 0) {
                return res.json({
                    success: false,
                    message: '이미 존재하는 아이디입니다.'
                });
            }

            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                const insertSql = 'INSERT INTO users (username, password) VALUES (?, ?)';

                db.query(insertSql, [username, hashedPassword], (err) => {
                    if (err) {
                        console.error('회원가입 오류:', err);
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

    // 로그인
    router.post('/login', (req, res) => {
        const username = req.body.username?.trim();
        const password = req.body.password?.trim();

        console.log('로그인 요청값:', { username, password });

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

                if (isMatch) {
                    req.session.userId = user.id;
                    req.session.username = user.username;

                    return res.json({
                        success: true,
                        message: '로그인 성공',
                        username: user.username
                    });
                } else {
                    return res.json({
                        success: false,
                        message: '아이디 또는 비밀번호가 틀렸습니다.'
                    });
                }
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
                username: req.session.username
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