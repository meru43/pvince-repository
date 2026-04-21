const express = require('express');
const router = express.Router();

// 메인 페이지
router.get('/', (req, res) => {
    res.render('main');
});

// 상품 리스트 페이지
router.get('/products-page', (req, res) => {
    res.render('product-list');
});

// 상품 상세 페이지
router.get('/products-page/:id', (req, res) => {
    res.render('product-detail');
});

// 로그인 페이지
router.get('/login-page', (req, res) => {
    res.render('login');
});

// 장바구니 페이지
router.get('/cart-page', (req, res) => {
    res.render('cart');
});

// 주문 페이지
router.get('/order-page', (req, res) => {
    res.render('order');
});

router.get('/order-page/:id', (req, res) => {
    res.render('order');
});

// 주문 완료 페이지
router.get('/order-complete-page', (req, res) => {
    res.render('order-complete');
});

// 주문 조회 페이지
router.get('/order-check-page', (req, res) => {
    res.render('order-check');
});

// 마이페이지
router.get('/mypage-page', (req, res) => {
    res.render('mypage');
});

// Q&A 페이지
router.get('/qna-page', (req, res) => {
    res.render('qna');
});

router.get('/qna-detail-page/:id', (req, res) => {
    res.render('qna-detail');
});

router.get('/qna-write-page', (req, res) => {
    res.render('qna-write');
});

// 회원가입 페이지
router.get('/register-page', (req, res) => {
    res.render('register');
});

module.exports = router;