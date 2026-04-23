const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

module.exports = (db, bcrypt) => {
    const router = express.Router();
    const DEFAULT_PROFILE_IMAGE = '/images/normal user.jpg';
    const profileUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles');

    fs.mkdirSync(profileUploadDir, { recursive: true });

    function getProfileImagePath(user) {
        if (user?.profile_image && String(user.profile_image).trim() !== '') {
            return user.profile_image;
        }

        return DEFAULT_PROFILE_IMAGE;
    }

    function ensureProfileImageColumn() {
        const checkSql = `
            SELECT COUNT(*) AS count
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND COLUMN_NAME = 'profile_image'
        `;

        db.query(checkSql, (checkErr, results) => {
            if (checkErr) {
                console.error('profile_image 컬럼 확인 오류:', checkErr);
                return;
            }

            if (results?.[0]?.count > 0) {
                return;
            }

            db.query('ALTER TABLE users ADD COLUMN profile_image VARCHAR(255) NULL', (alterErr) => {
                if (alterErr) {
                    console.error('profile_image 컬럼 추가 오류:', alterErr);
                }
            });
        });
    }

    ensureProfileImageColumn();

    const profileStorage = multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, profileUploadDir),
        filename: (_req, file, cb) => {
            const safeName = file.originalname.replace(/\s+/g, '_');
            cb(null, `${Date.now()}_${safeName}`);
        }
    });

    const uploadProfile = multer({
        storage: profileStorage,
        fileFilter: (_req, file, cb) => {
            if (file.mimetype && file.mimetype.startsWith('image/')) {
                cb(null, true);
                return;
            }

            cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
        }
    });

    router.post('/register', (req, res) => {
        const username = req.body.username?.trim();
        const password = req.body.password?.trim();
        const nickname = req.body.nickname?.trim();
        const email = req.body.email?.trim();
        const name = req.body.name?.trim() || null;
        const phone = req.body.phone?.trim() || null;

        console.log('회원가입 요청값:', { username, nickname, email, name, phone });

        if (!username || !password || !nickname || !email) {
            return res.json({
                success: false,
                message: '아이디, 비밀번호, 닉네임, 이메일을 입력해주세요.'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({
                success: false,
                message: '올바른 이메일 형식을 입력해주세요.'
            });
        }

        const checkUsernameSql = 'SELECT id FROM users WHERE username = ? LIMIT 1';
        const checkNicknameSql = 'SELECT id FROM users WHERE nickname = ? LIMIT 1';
        const checkEmailSql = 'SELECT id FROM users WHERE email = ? LIMIT 1';

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

            db.query(checkNicknameSql, [nickname], (nicknameErr, nicknameResults) => {
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

                db.query(checkEmailSql, [email], async (emailErr, emailResults) => {
                    if (emailErr) {
                        console.error('이메일 중복 확인 오류:', emailErr);
                        return res.json({
                            success: false,
                            message: '서버 오류'
                        });
                    }

                    if (emailResults.length > 0) {
                        return res.json({
                            success: false,
                            message: '이미 사용 중인 이메일입니다.'
                        });
                    }

                    try {
                        const hashedPassword = await bcrypt.hash(password, 10);

                        const insertSql = `
                        INSERT INTO users (
                            username,
                            password,
                            nickname,
                            email,
                            name,
                            phone,
                            role,
                            profile_image
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                        db.query(
                            insertSql,
                            [
                                username,
                                hashedPassword,
                                nickname,
                                email,
                                name,
                                phone,
                                'member',
                                DEFAULT_PROFILE_IMAGE
                            ],
                            (insertErr) => {
                                if (insertErr) {
                                    console.error('회원가입 오류:', insertErr);
                                    return res.json({
                                        success: false,
                                        message: '회원가입에 실패했습니다.'
                                    });
                                }

                                return res.json({
                                    success: true,
                                    message: '회원가입이 완료되었습니다.'
                                });
                            }
                        );
                    } catch (error) {
                        console.error('비밀번호 해시 오류:', error);
                        return res.json({
                            success: false,
                            message: '해시 처리에 실패했습니다.'
                        });
                    }
                });
            });
        });
    });

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

    router.patch('/my-profile', (req, res) => {
        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        const nickname = req.body.nickname?.trim();
        const email = req.body.email?.trim();
        const name = req.body.name?.trim() || null;
        const phone = req.body.phone?.trim() || null;

        if (!nickname || !email) {
            return res.json({
                success: false,
                message: '닉네임과 이메일은 필수입니다.'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({
                success: false,
                message: '올바른 이메일 형식을 입력해주세요.'
            });
        }

        const checkNicknameSql = 'SELECT id FROM users WHERE nickname = ? AND id != ? LIMIT 1';
        const checkEmailSql = 'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1';

        db.query(checkNicknameSql, [nickname, req.session.userId], (nicknameErr, nicknameResults) => {
            if (nicknameErr) {
                console.error('닉네임 중복 확인 오류:', nicknameErr);
                return res.json({
                    success: false,
                    message: '닉네임 확인에 실패했습니다.'
                });
            }

            if (nicknameResults.length > 0) {
                return res.json({
                    success: false,
                    message: '이미 사용 중인 닉네임입니다.'
                });
            }

            db.query(checkEmailSql, [email, req.session.userId], (emailErr, emailResults) => {
                if (emailErr) {
                    console.error('이메일 중복 확인 오류:', emailErr);
                    return res.json({
                        success: false,
                        message: '이메일 확인에 실패했습니다.'
                    });
                }

                if (emailResults.length > 0) {
                    return res.json({
                        success: false,
                        message: '이미 사용 중인 이메일입니다.'
                    });
                }

                const updateSql = `
                UPDATE users
                SET nickname = ?, email = ?, name = ?, phone = ?
                WHERE id = ?
            `;

                db.query(updateSql, [nickname, email, name, phone, req.session.userId], (updateErr) => {
                    if (updateErr) {
                        console.error('회원 정보 변경 오류:', updateErr);
                        return res.json({
                            success: false,
                            message: '회원 정보 변경에 실패했습니다.'
                        });
                    }

                    req.session.nickname = nickname;
                    req.session.email = email;
                    req.session.name = name || '';
                    req.session.phone = phone || '';

                    return res.json({
                        success: true,
                        message: '회원 정보가 변경되었습니다.',
                        nickname,
                        email,
                        name,
                        phone
                    });
                });
            });
        });
    });

    router.post('/my-profile-image', (req, res) => {
        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        uploadProfile.single('profileImage')(req, res, (uploadErr) => {
            if (uploadErr) {
                return res.json({
                    success: false,
                    message: uploadErr.message || '프로필 이미지 업로드에 실패했습니다.'
                });
            }

            if (!req.file) {
                return res.json({
                    success: false,
                    message: '업로드할 이미지를 선택해주세요.'
                });
            }

            const profileImagePath = `/uploads/profiles/${req.file.filename}`;
            const updateSql = 'UPDATE users SET profile_image = ? WHERE id = ?';

            db.query(updateSql, [profileImagePath, req.session.userId], (updateErr) => {
                if (updateErr) {
                    console.error('프로필 이미지 변경 오류:', updateErr);
                    return res.json({
                        success: false,
                        message: '프로필 이미지 저장에 실패했습니다.'
                    });
                }

                req.session.profileImage = profileImagePath;

                return res.json({
                    success: true,
                    message: '프로필 이미지가 변경되었습니다.',
                    profileImage: profileImagePath
                });
            });
        });
    });

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
                    message: '아이디 또는 비밀번호가 올바르지 않습니다.'
                });
            }

            const user = results[0];

            try {
                const isMatch = await bcrypt.compare(password, user.password);

                if (!isMatch) {
                    return res.json({
                        success: false,
                        message: '아이디 또는 비밀번호가 올바르지 않습니다.'
                    });
                }

                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.nickname = user.nickname;
                req.session.role = user.role;
                req.session.profileImage = getProfileImagePath(user);
                req.session.email = user.email || '';
                req.session.name = user.name || '';
                req.session.phone = user.phone || '';

                return res.json({
                    success: true,
                    message: '로그인 성공',
                    username: user.username,
                    nickname: user.nickname,
                    role: user.role,
                    profileImage: getProfileImagePath(user),
                    email: user.email || '',
                    name: user.name || '',
                    phone: user.phone || ''
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

    router.get('/me', (req, res) => {
        if (req.session.userId) {
            return res.json({
                loggedIn: true,
                userId: req.session.userId,
                username: req.session.username,
                nickname: req.session.nickname,
                role: req.session.role,
                profileImage: req.session.profileImage || DEFAULT_PROFILE_IMAGE,
                email: req.session.email || '',
                name: req.session.name || '',
                phone: req.session.phone || ''
            });
        }

        return res.json({
            loggedIn: false
        });
    });

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
