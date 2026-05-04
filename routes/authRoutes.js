const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const nodemailer = require('nodemailer');
const path = require('path');
const multer = require('multer');

module.exports = (db, bcrypt) => {
    const router = express.Router();
    const DEFAULT_PROFILE_IMAGE = '/images/normal user.jpg';
    const profileUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles');
    const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
    const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

    fs.mkdirSync(profileUploadDir, { recursive: true });

    function getProfileImagePath(user) {
        if (user?.profile_image && String(user.profile_image).trim() !== '') {
            return user.profile_image;
        }

        return DEFAULT_PROFILE_IMAGE;
    }

    function isValidAccountPassword(password) {
        return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(String(password || ''));
    }

    function isValidUsername(username) {
        return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/.test(String(username || '').trim());
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
    }

    function generateTemporaryPassword() {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        let randomPart = '';

        for (let index = 0; index < 8; index += 1) {
            randomPart += alphabet[Math.floor(Math.random() * alphabet.length)];
        }

        return `Sj${randomPart}9`;
    }

    function getMailerConfig() {
        const host = process.env.SMTP_HOST || '';
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER || '';
        const pass = process.env.SMTP_PASS || '';
        const from = process.env.SMTP_FROM || user;
        const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

        return {
            host,
            port,
            user,
            pass,
            from,
            secure,
            configured: Boolean(host && port && user && pass && from)
        };
    }

    async function sendTemporaryPasswordEmail({ to, username, tempPassword }) {
        const mailerConfig = getMailerConfig();

        if (!mailerConfig.configured) {
            throw new Error('SMTP is not configured.');
        }

        const transporter = nodemailer.createTransport({
            host: mailerConfig.host,
            port: mailerConfig.port,
            secure: mailerConfig.secure,
            auth: {
                user: mailerConfig.user,
                pass: mailerConfig.pass
            }
        });

        await transporter.sendMail({
            from: mailerConfig.from,
            to,
            subject: '[SJ SHOP] 임시 비밀번호 안내',
            text: [
                `${username}님, 안녕하세요.`,
                '',
                '비밀번호 찾기 요청으로 임시 비밀번호를 발급해 드립니다.',
                `임시 비밀번호: ${tempPassword}`,
                '',
                '로그인 후 마이페이지에서 비밀번호를 변경해 주세요.'
            ].join('\n'),
            html: `
                <div style="font-family: Arial, 'Malgun Gothic', sans-serif; line-height: 1.7; color: #222;">
                    <p>${username}님, 안녕하세요.</p>
                    <p>비밀번호 찾기 요청으로 임시 비밀번호를 발급해 드립니다.</p>
                    <p style="margin: 20px 0; font-size: 18px; font-weight: 700;">임시 비밀번호: ${tempPassword}</p>
                    <p>로그인 후 마이페이지에서 비밀번호를 변경해 주세요.</p>
                </div>
            `
        });
    }

    function getGoogleConfig(req) {
        const clientId = process.env.GOOGLE_CLIENT_ID || '';
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
        const callbackUrl = process.env.GOOGLE_CALLBACK_URL
            || `${req.protocol}://${req.get('host')}/auth/google/callback`;

        return {
            clientId,
            clientSecret,
            callbackUrl,
            configured: Boolean(clientId && clientSecret)
        };
    }

    function ensureGoogleColumns() {
        const columns = [
            { name: 'google_id', sql: `ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL AFTER profile_image` },
            { name: 'google_email', sql: `ALTER TABLE users ADD COLUMN google_email VARCHAR(255) NULL AFTER google_id` }
        ];

        columns.forEach((column) => {
            const checkSql = `
                SELECT COUNT(*) AS count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = ?
            `;

            db.query(checkSql, [column.name], (checkErr, results) => {
                if (checkErr) {
                    console.error(`${column.name} column check error:`, checkErr);
                    return;
                }

                if (results?.[0]?.count > 0) {
                    return;
                }

                db.query(column.sql, (alterErr) => {
                    if (alterErr) {
                        console.error(`${column.name} column add error:`, alterErr);
                    }
                });
            });
        });
    }

    function setSessionUser(req, user) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.nickname = user.nickname;
        req.session.role = user.role;
        req.session.profileImage = getProfileImagePath(user);
        req.session.email = user.email || '';
        req.session.name = user.name || '';
        req.session.phone = user.phone || '';
        req.session.isGoogleUser = Boolean(
            (user.google_id && String(user.google_id).trim() !== '')
            || (user.google_email && String(user.google_email).trim() !== '')
        );
    }

    function buildUniqueValue(baseValue, existsSql, fallbackPrefix) {
        return new Promise((resolve, reject) => {
            const normalizedBase = String(baseValue || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_+|_+$/g, '')
                || `${fallbackPrefix}_${Date.now()}`;

            const tryCandidate = (index) => {
                const candidate = index === 0 ? normalizedBase : `${normalizedBase}_${index}`;

                db.query(existsSql, [candidate], (err, results) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!results.length) {
                        resolve(candidate);
                        return;
                    }

                    tryCandidate(index + 1);
                });
            };

            tryCandidate(0);
        });
    }

    async function createOrLinkGoogleUser(profile) {
        const googleId = String(profile.sub || '').trim();
        const googleEmail = String(profile.email || '').trim().toLowerCase();
        const displayName = String(profile.name || '').trim();
        const profileImage = String(profile.picture || '').trim() || DEFAULT_PROFILE_IMAGE;

        if (!googleId || !googleEmail) {
            throw new Error('Google profile is missing required fields.');
        }

        const findSql = `
            SELECT *
            FROM users
            WHERE google_id = ? OR email = ?
            ORDER BY CASE WHEN google_id = ? THEN 0 ELSE 1 END
            LIMIT 1
        `;

        const existingUser = await new Promise((resolve, reject) => {
            db.query(findSql, [googleId, googleEmail, googleId], (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(results[0] || null);
            });
        });

        if (existingUser) {
            if (Number(existingUser.is_active) === 0) {
                throw new Error('This account is inactive.');
            }

            const updateSql = `
                UPDATE users
                SET
                    google_id = ?,
                    google_email = ?,
                    profile_image = COALESCE(NULLIF(profile_image, ''), ?)
                WHERE id = ?
            `;

            await new Promise((resolve, reject) => {
                db.query(updateSql, [googleId, googleEmail, profileImage, existingUser.id], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve();
                });
            });

            return {
                ...existingUser,
                google_id: googleId,
                google_email: googleEmail,
                profile_image: existingUser.profile_image || profileImage
            };
        }

        const emailPrefix = googleEmail.split('@')[0] || 'google_user';
        const nicknameBase = displayName || emailPrefix;
        const username = await buildUniqueValue(emailPrefix, 'SELECT id FROM users WHERE username = ? LIMIT 1', 'google_user');
        const nickname = await buildUniqueValue(nicknameBase, 'SELECT id FROM users WHERE nickname = ? LIMIT 1', 'google_user');
        const randomPassword = crypto.randomBytes(24).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const insertSql = `
            INSERT INTO users (
                username,
                password,
                nickname,
                email,
                name,
                phone,
                role,
                profile_image,
                google_id,
                google_email
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertResult = await new Promise((resolve, reject) => {
            db.query(
                insertSql,
                [
                    username,
                    hashedPassword,
                    nickname,
                    googleEmail,
                    displayName || null,
                    null,
                    'member',
                    profileImage,
                    googleId,
                    googleEmail
                ],
                (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve(result);
                }
            );
        });

        return {
            id: insertResult.insertId,
            username,
            nickname,
            email: googleEmail,
            name: displayName || '',
            phone: '',
            role: 'member',
            profile_image: profileImage,
            google_id: googleId,
            google_email: googleEmail
        };
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
                console.error('profile_image 而щ읆 ?뺤씤 ?ㅻ쪟:', checkErr);
                return;
            }

            if (results?.[0]?.count > 0) {
                return;
            }

            db.query('ALTER TABLE users ADD COLUMN profile_image VARCHAR(255) NULL', (alterErr) => {
                if (alterErr) {
                    console.error('profile_image 而щ읆 異붽? ?ㅻ쪟:', alterErr);
                }
            });
        });
    }

    ensureProfileImageColumn();
    ensureGoogleColumns();

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

            cb(new Error('?대?吏 ?뚯씪留??낅줈?쒗븷 ???덉뒿?덈떎.'));
        }
    });

    router.post('/register', (req, res) => {
        const username = req.body.username?.trim();
        const password = req.body.password?.trim();
        const nickname = req.body.nickname?.trim();
        const email = req.body.email?.trim();
        const name = req.body.name?.trim() || null;
        const phone = req.body.phone?.trim() || null;

        console.log('?뚯썝媛???붿껌媛?', { username, nickname, email, name, phone });

        if (!username || !password || !nickname || !email) {
            return res.json({
                success: false,
                message: '?꾩씠?? 鍮꾨?踰덊샇, ?됰꽕?? ?대찓?쇱쓣 ?낅젰?댁＜?몄슂.'
            });
        }

        if (!isValidUsername(username)) {
            return res.json({
                success: false,
                message: '아이디는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.'
            });
        }

        if (!isValidAccountPassword(password)) {
            return res.json({
                success: false,
                message: '鍮꾨?踰덊샇???곷Ц怨??レ옄瑜??ы븿??8???댁긽 ?낅젰?댁＜?몄슂.'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({
                success: false,
                message: '?щ컮瑜??대찓???뺤떇???낅젰?댁＜?몄슂.'
            });
        }

        const checkUsernameSql = 'SELECT id FROM users WHERE username = ? LIMIT 1';
        const checkNicknameSql = 'SELECT id FROM users WHERE nickname = ? LIMIT 1';
        const checkEmailSql = 'SELECT id FROM users WHERE email = ? LIMIT 1';

        db.query(checkUsernameSql, [username], (usernameErr, usernameResults) => {
            if (usernameErr) {
                console.error('?꾩씠??以묐났 ?뺤씤 ?ㅻ쪟:', usernameErr);
                return res.json({
                    success: false,
                    message: '?쒕쾭 ?ㅻ쪟'
                });
            }

            if (usernameResults.length > 0) {
                return res.json({
                    success: false,
                    message: '?대? 議댁옱?섎뒗 ?꾩씠?붿엯?덈떎.'
                });
            }

            db.query(checkNicknameSql, [nickname], (nicknameErr, nicknameResults) => {
                if (nicknameErr) {
                    console.error('?됰꽕??以묐났 ?뺤씤 ?ㅻ쪟:', nicknameErr);
                    return res.json({
                        success: false,
                        message: '?쒕쾭 ?ㅻ쪟'
                    });
                }

                if (nicknameResults.length > 0) {
                    return res.json({
                        success: false,
                        message: '?대? ?ъ슜 以묒씤 ?됰꽕?꾩엯?덈떎.'
                    });
                }

                db.query(checkEmailSql, [email], async (emailErr, emailResults) => {
                    if (emailErr) {
                        console.error('?대찓??以묐났 ?뺤씤 ?ㅻ쪟:', emailErr);
                        return res.json({
                            success: false,
                            message: '?쒕쾭 ?ㅻ쪟'
                        });
                    }

                    if (emailResults.length > 0) {
                        return res.json({
                            success: false,
                            message: '?대? ?ъ슜 以묒씤 ?대찓?쇱엯?덈떎.'
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
                                    console.error('?뚯썝媛???ㅻ쪟:', insertErr);
                                    return res.json({
                                        success: false,
                                        message: '?뚯썝媛?낆뿉 ?ㅽ뙣?덉뒿?덈떎.'
                                    });
                                }

                                return res.json({
                                    success: true,
                                    message: '?뚯썝媛?낆씠 ?꾨즺?섏뿀?듬땲??'
                                });
                            }
                        );
                    } catch (error) {
                        console.error('鍮꾨?踰덊샇 ?댁떆 ?ㅻ쪟:', error);
                        return res.json({
                            success: false,
                            message: '?댁떆 泥섎━???ㅽ뙣?덉뒿?덈떎.'
                        });
                    }
                });
            });
        });
    });

    router.post('/check-username', (req, res) => {
        const username = req.body.username?.trim();

        if (!username) {
            return res.json({
                success: false,
                message: '아이디를 입력해주세요.'
            });
        }

        if (!isValidUsername(username)) {
            return res.json({
                success: false,
                message: '아이디는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.'
            });
        }

        const sql = 'SELECT id FROM users WHERE username = ? LIMIT 1';

        db.query(sql, [username], (err, results) => {
            if (err) {
                console.error('아이디 중복 확인 오류:', err);
                return res.json({
                    success: false,
                    message: '아이디 확인에 실패했습니다.'
                });
            }

            if (results.length > 0) {
                return res.json({
                    success: false,
                    message: '이미 사용 중인 아이디입니다.'
                });
            }

            return res.json({
                success: true,
                message: '사용 가능한 아이디입니다.'
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

    router.post('/check-email', (req, res) => {
        const email = req.body.email?.trim();

        if (!email) {
            return res.json({
                success: false,
                message: '이메일을 입력해주세요.'
            });
        }

        if (!isValidEmail(email)) {
            return res.json({
                success: false,
                message: '올바른 이메일 형식으로 입력해주세요.'
            });
        }

        const sql = 'SELECT id FROM users WHERE email = ? LIMIT 1';

        db.query(sql, [email], (err, results) => {
            if (err) {
                console.error('이메일 중복 확인 오류:', err);
                return res.json({
                    success: false,
                    message: '이메일 확인에 실패했습니다.'
                });
            }

            if (results.length > 0) {
                return res.json({
                    success: false,
                    message: '이미 사용 중인 이메일입니다.'
                });
            }

            return res.json({
                success: true,
                message: '사용 가능한 이메일입니다.'
            });
        });
    });

    router.patch('/my-nickname', (req, res) => {
        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '濡쒓렇?몄씠 ?꾩슂?⑸땲??'
            });
        }

        const nickname = req.body.nickname?.trim();

        if (!nickname) {
            return res.json({
                success: false,
                message: '?됰꽕?꾩쓣 ?낅젰?댁＜?몄슂.'
            });
        }

        const checkSql = 'SELECT id FROM users WHERE nickname = ? AND id != ? LIMIT 1';

        db.query(checkSql, [nickname, req.session.userId], (checkErr, checkResults) => {
            if (checkErr) {
                console.error('?됰꽕??以묐났 ?뺤씤 ?ㅻ쪟:', checkErr);
                return res.json({
                    success: false,
                    message: '?됰꽕???뺤씤???ㅽ뙣?덉뒿?덈떎.'
                });
            }

            if (checkResults.length > 0) {
                return res.json({
                    success: false,
                    message: '?대? ?ъ슜 以묒씤 ?됰꽕?꾩엯?덈떎.'
                });
            }

            const updateSql = 'UPDATE users SET nickname = ? WHERE id = ?';

            db.query(updateSql, [nickname, req.session.userId], (updateErr) => {
                if (updateErr) {
                    console.error('?됰꽕??蹂寃??ㅻ쪟:', updateErr);
                    return res.json({
                        success: false,
                        message: '?됰꽕??蹂寃쎌뿉 ?ㅽ뙣?덉뒿?덈떎.'
                    });
                }

                req.session.nickname = nickname;

                return res.json({
                    success: true,
                    message: '?됰꽕?꾩씠 蹂寃쎈릺?덉뒿?덈떎.',
                    nickname
                });
            });
        });
    });

    router.patch('/my-profile', (req, res) => {
        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '濡쒓렇?몄씠 ?꾩슂?⑸땲??'
            });
        }

        const nickname = req.body.nickname?.trim();
        const email = req.body.email?.trim();
        const name = req.body.name?.trim() || null;
        const phone = req.body.phone?.trim() || null;

        if (!nickname || !email) {
            return res.json({
                success: false,
                message: '?됰꽕?꾧낵 ?대찓?쇱? ?꾩닔?낅땲??'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({
                success: false,
                message: '?щ컮瑜??대찓???뺤떇???낅젰?댁＜?몄슂.'
            });
        }

        const checkNicknameSql = 'SELECT id FROM users WHERE nickname = ? AND id != ? LIMIT 1';
        const checkEmailSql = 'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1';

        db.query(checkNicknameSql, [nickname, req.session.userId], (nicknameErr, nicknameResults) => {
            if (nicknameErr) {
                console.error('?됰꽕??以묐났 ?뺤씤 ?ㅻ쪟:', nicknameErr);
                return res.json({
                    success: false,
                    message: '?됰꽕???뺤씤???ㅽ뙣?덉뒿?덈떎.'
                });
            }

            if (nicknameResults.length > 0) {
                return res.json({
                    success: false,
                    message: '?대? ?ъ슜 以묒씤 ?됰꽕?꾩엯?덈떎.'
                });
            }

            db.query(checkEmailSql, [email, req.session.userId], (emailErr, emailResults) => {
                if (emailErr) {
                    console.error('?대찓??以묐났 ?뺤씤 ?ㅻ쪟:', emailErr);
                    return res.json({
                        success: false,
                        message: '?대찓???뺤씤???ㅽ뙣?덉뒿?덈떎.'
                    });
                }

                if (emailResults.length > 0) {
                    return res.json({
                        success: false,
                        message: '?대? ?ъ슜 以묒씤 ?대찓?쇱엯?덈떎.'
                    });
                }

                const updateSql = `
                UPDATE users
                SET nickname = ?, email = ?, name = ?, phone = ?
                WHERE id = ?
            `;

                db.query(updateSql, [nickname, email, name, phone, req.session.userId], (updateErr) => {
                    if (updateErr) {
                        console.error('?뚯썝 ?뺣낫 蹂寃??ㅻ쪟:', updateErr);
                        return res.json({
                            success: false,
                            message: '?뚯썝 ?뺣낫 蹂寃쎌뿉 ?ㅽ뙣?덉뒿?덈떎.'
                        });
                    }

                    req.session.nickname = nickname;
                    req.session.email = email;
                    req.session.name = name || '';
                    req.session.phone = phone || '';

                    return res.json({
                        success: true,
                        message: '?뚯썝 ?뺣낫媛 蹂寃쎈릺?덉뒿?덈떎.',
                        nickname,
                        email,
                        name,
                        phone
                    });
                });
            });
        });
    });
    router.patch('/my-password', async (req, res) => {
        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        const currentPassword = req.body.currentPassword?.trim();
        const newPassword = req.body.newPassword?.trim();

        if (!currentPassword || !newPassword) {
            return res.json({
                success: false,
                message: '현재 비밀번호와 새 비밀번호를 입력해주세요.'
            });
        }

        if (!isValidAccountPassword(newPassword)) {
            return res.json({
                success: false,
                message: '새 비밀번호는 영문과 숫자를 포함해 8자 이상 입력해주세요.'
            });
        }

        const sql = 'SELECT id, password, google_id, google_email FROM users WHERE id = ? LIMIT 1';

        db.query(sql, [req.session.userId], async (err, results) => {
            if (err) {
                console.error('회원 비밀번호 조회 오류:', err);
                return res.json({
                    success: false,
                    message: '회원 정보를 확인하지 못했습니다.'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '회원을 찾을 수 없습니다.'
                });
            }

            const user = results[0];

            const isGoogleUser = Boolean(
                (user.google_id && String(user.google_id).trim() !== '')
                || (user.google_email && String(user.google_email).trim() !== '')
            );

            if (isGoogleUser) {
                return res.json({
                    success: false,
                    message: '구글 가입 회원은 이곳에서 비밀번호를 변경할 수 없습니다.'
                });
            }

            try {
                const isMatch = await bcrypt.compare(currentPassword, user.password);

                if (!isMatch) {
                    return res.json({
                        success: false,
                        message: '현재 비밀번호가 올바르지 않습니다.'
                    });
                }

                const hashedPassword = await bcrypt.hash(newPassword, 10);

                const updateSql = 'UPDATE users SET password = ? WHERE id = ?';

                db.query(updateSql, [hashedPassword, req.session.userId], (updateErr) => {
                    if (updateErr) {
                        console.error('비밀번호 변경 오류:', updateErr);
                        return res.json({
                            success: false,
                            message: '비밀번호 변경에 실패했습니다.'
                        });
                    }

                    return res.json({
                        success: true,
                        message: '비밀번호가 변경되었습니다.'
                    });
                });
            } catch (error) {
                console.error('비밀번호 처리 오류:', error);
                return res.json({
                    success: false,
                    message: '비밀번호 처리 중 오류가 발생했습니다.'
                });
            }
        });
    });

    router.post('/my-profile-image', (req, res) => {
        if (!req.session.userId) {
            return res.json({
                success: false,
                message: '濡쒓렇?몄씠 ?꾩슂?⑸땲??'
            });
        }

        uploadProfile.single('profileImage')(req, res, (uploadErr) => {
            if (uploadErr) {
                return res.json({
                    success: false,
                    message: uploadErr.message || '?꾨줈???대?吏 ?낅줈?쒖뿉 ?ㅽ뙣?덉뒿?덈떎.'
                });
            }

            if (!req.file) {
                return res.json({
                    success: false,
                    message: '?낅줈?쒗븷 ?대?吏瑜??좏깮?댁＜?몄슂.'
                });
            }

            const profileImagePath = `/uploads/profiles/${req.file.filename}`;
            const updateSql = 'UPDATE users SET profile_image = ? WHERE id = ?';

            db.query(updateSql, [profileImagePath, req.session.userId], (updateErr) => {
                if (updateErr) {
                    console.error('?꾨줈???대?吏 蹂寃??ㅻ쪟:', updateErr);
                    return res.json({
                        success: false,
                        message: '?꾨줈???대?吏 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎.'
                    });
                }

                req.session.profileImage = profileImagePath;

                return res.json({
                    success: true,
                    message: '?꾨줈???대?吏媛 蹂寃쎈릺?덉뒿?덈떎.',
                    profileImage: profileImagePath
                });
            });
        });
    });

    router.post('/forgot-password', async (req, res) => {
        const username = req.body.username?.trim();
        const email = req.body.email?.trim().toLowerCase();

        if (!username || !email) {
            return res.json({
                success: false,
                message: '아이디와 이메일을 모두 입력해 주세요.'
            });
        }

        if (!isValidEmail(email)) {
            return res.json({
                success: false,
                message: '올바른 이메일 형식을 입력해 주세요.'
            });
        }

        const findUserSql = `
            SELECT id, username, email, password, is_active
            FROM users
            WHERE username = ? AND email = ?
            LIMIT 1
        `;

        db.query(findUserSql, [username, email], async (findErr, results) => {
            if (findErr) {
                console.error('비밀번호 찾기 회원 조회 오류:', findErr);
                return res.json({
                    success: false,
                    message: '서버 오류가 발생했습니다.'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '가입정보가 없습니다.'
                });
            }

            const user = results[0];

            if (Number(user.is_active) === 0) {
                return res.json({
                    success: false,
                    message: '가입정보가 없습니다.'
                });
            }

            try {
                const tempPassword = generateTemporaryPassword();
                const hashedPassword = await bcrypt.hash(tempPassword, 10);
                const updateSql = 'UPDATE users SET password = ? WHERE id = ?';

                db.query(updateSql, [hashedPassword, user.id], async (updateErr) => {
                    if (updateErr) {
                        console.error('임시 비밀번호 저장 오류:', updateErr);
                        return res.json({
                            success: false,
                            message: '서버 오류가 발생했습니다.'
                        });
                    }

                    try {
                        await sendTemporaryPasswordEmail({
                            to: user.email,
                            username: user.username,
                            tempPassword
                        });

                        return res.json({
                            success: true,
                            message: '임시 비밀번호를 이메일로 발송했습니다.'
                        });
                    } catch (mailErr) {
                        console.error('임시 비밀번호 메일 발송 오류:', mailErr);

                        db.query('UPDATE users SET password = ? WHERE id = ?', [user.password, user.id], (rollbackErr) => {
                            if (rollbackErr) {
                                console.error('임시 비밀번호 롤백 오류:', rollbackErr);
                            }

                            return res.json({
                                success: false,
                                message: '임시 비밀번호 메일 발송에 실패했습니다.'
                            });
                        });
                    }
                });
            } catch (error) {
                console.error('비밀번호 찾기 처리 오류:', error);
                return res.json({
                    success: false,
                    message: '서버 오류가 발생했습니다.'
                });
            }
        });
    });

    router.get('/auth/google', (req, res) => {
        const googleConfig = getGoogleConfig(req);

        if (!googleConfig.configured) {
            return res.status(500).send('Google login is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.');
        }

        const state = crypto.randomBytes(24).toString('hex');
        req.session.googleOAuthState = state;

        const params = new URLSearchParams({
            client_id: googleConfig.clientId,
            redirect_uri: googleConfig.callbackUrl,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            prompt: 'select_account'
        });

        return res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
    });

    router.get('/auth/google/callback', async (req, res) => {
        const { code, state } = req.query;
        const savedState = req.session.googleOAuthState;
        delete req.session.googleOAuthState;

        if (!code || !state || state !== savedState) {
            return res.redirect('/login-page');
        }

        const googleConfig = getGoogleConfig(req);

        if (!googleConfig.configured) {
            return res.redirect('/login-page');
        }

        try {
            const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    code: String(code),
                    client_id: googleConfig.clientId,
                    client_secret: googleConfig.clientSecret,
                    redirect_uri: googleConfig.callbackUrl,
                    grant_type: 'authorization_code'
                })
            });

            if (!tokenResponse.ok) {
                throw new Error(`Google token exchange failed with ${tokenResponse.status}`);
            }

            const tokenData = await tokenResponse.json();
            const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`
                }
            });

            if (!userInfoResponse.ok) {
                throw new Error(`Google user info request failed with ${userInfoResponse.status}`);
            }

            const profile = await userInfoResponse.json();
            const user = await createOrLinkGoogleUser(profile);
            setSessionUser(req, user);

            return res.redirect('/mypage-page');
        } catch (error) {
            console.error('Google OAuth callback error:', error);
            return res.redirect('/login-page');
        }
    });

    router.post('/login', (req, res) => {
        const username = req.body.username?.trim();
        const password = req.body.password?.trim();
        const rememberLogin = Boolean(req.body.rememberLogin);

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
                    message: '서버 오류가 발생했습니다.'
                });
            }

            if (results.length === 0) {
                return res.json({
                    success: false,
                    message: '아이디 또는 비밀번호가 올바르지 않습니다.'
                });
            }

            const user = results[0];

            if (Number(user.is_active) === 0) {
                return res.json({
                    success: false,
                    message: '해당 아이디는 사용이 중지된 계정입니다.'
                });
            }

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
                req.session.isGoogleUser = Boolean(
                    (user.google_id && String(user.google_id).trim() !== '')
                    || (user.google_email && String(user.google_email).trim() !== '')
                );

                if (rememberLogin) {
                    req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;
                } else {
                    req.session.cookie.expires = false;
                    req.session.cookie.maxAge = null;
                }

                return res.json({
                    success: true,
                    message: '로그인 성공',
                    username: user.username,
                    nickname: user.nickname,
                    role: user.role,
                    profileImage: getProfileImagePath(user),
                    email: user.email || '',
                    name: user.name || '',
                    phone: user.phone || '',
                    isGoogleUser: Boolean(
                        (user.google_id && String(user.google_id).trim() !== '')
                        || (user.google_email && String(user.google_email).trim() !== '')
                    )
                });
            } catch (error) {
                console.error('비밀번호 비교 오류:', error);
                return res.json({
                    success: false,
                    message: '로그인 처리에 실패했습니다.'
                });
            }
        });
    });

    router.get('/me', (req, res) => {
        if (req.session.userId) {
            const sql = `
                SELECT google_id, google_email
                FROM users
                WHERE id = ?
                LIMIT 1
            `;

            db.query(sql, [req.session.userId], (err, results) => {
                const dbIsGoogleUser = !err && results.length > 0
                    ? Boolean(
                        (results[0].google_id && String(results[0].google_id).trim() !== '')
                        || (results[0].google_email && String(results[0].google_email).trim() !== '')
                    )
                    : Boolean(req.session.isGoogleUser);

                req.session.isGoogleUser = dbIsGoogleUser;

                return res.json({
                    loggedIn: true,
                    userId: req.session.userId,
                    username: req.session.username,
                    nickname: req.session.nickname,
                    role: req.session.role,
                    profileImage: req.session.profileImage || DEFAULT_PROFILE_IMAGE,
                    email: req.session.email || '',
                    name: req.session.name || '',
                    phone: req.session.phone || '',
                    isGoogleUser: dbIsGoogleUser
                });
            });

            return;
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
                    message: '濡쒓렇?꾩썐 ?ㅽ뙣'
                });
            }

            res.clearCookie('connect.sid');

            return res.json({
                success: true,
                message: '濡쒓렇?꾩썐 ?꾨즺'
            });
        });
    });

    return router;
};
