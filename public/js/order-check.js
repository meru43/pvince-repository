document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('order-check-form');
    const orderNumberInput = document.getElementById('order-number');
    const orderPasswordInput = document.getElementById('order-password');
    const errorText = document.getElementById('order-check-error');

    const resultBox = document.getElementById('order-result-box');
    const resultInfoBox = document.getElementById('result-info-box');
    const resultProductsBox = document.getElementById('result-products-box');

    let currentOrder = null;
    let currentItems = [];

    function formatDate(dateString) {
        if (!dateString) return '-';

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return dateString;

        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');

        return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
    }

    function formatPrice(value) {
        return `${Number(value || 0).toLocaleString()}원`;
    }

    function displayValue(value) {
        return value && String(value).trim() !== '' ? value : '-';
    }

    function escapeHtml(value) {
        return String(value ?? '-')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getThumbSrc(item) {
        if (item.thumbnail_path && String(item.thumbnail_path).trim() !== '') {
            return item.thumbnail_path;
        }

        return `https://via.placeholder.com/280x190?text=Product+${item.product_id}`;
    }

    function createInvoiceModal() {
        const modal = document.createElement('div');
        modal.className = 'download-modal invoice-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="download-modal-backdrop" data-invoice-modal-close></div>
            <div class="download-modal-dialog invoice-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
                <div class="download-modal-head">
                    <div>
                        <p class="download-modal-label">RECEIPT</p>
                        <h3 class="download-modal-title" id="invoice-modal-title">영수증</h3>
                    </div>
                    <div class="invoice-modal-actions">
                        <button type="button" class="btn btn-outline invoice-save-btn" id="invoice-save-btn">PDF 저장</button>
                        <button type="button" class="download-modal-close" data-invoice-modal-close aria-label="팝업 닫기">X</button>
                    </div>
                </div>
                <div class="invoice-sheet" id="invoice-sheet"></div>
            </div>
        `;

        document.body.appendChild(modal);

        const sheetEl = modal.querySelector('#invoice-sheet');
        const saveBtn = modal.querySelector('#invoice-save-btn');

        function buildInvoicePrintMarkup() {
            return `
                <!doctype html>
                <html lang="ko">
                <head>
                    <meta charset="utf-8">
                    <title>영수증</title>
                    <style>
                        * { box-sizing: border-box; }
                        body {
                            margin: 0;
                            padding: 32px 24px;
                            font-family: Arial, "Malgun Gothic", sans-serif;
                            color: #111827;
                            background: #ffffff;
                        }
                        .invoice-sheet {
                            width: 100%;
                            max-width: 720px;
                            margin: 0 auto;
                            border: 1px solid #e6ebf2;
                            border-radius: 24px;
                            padding: 24px 22px;
                            background: #fff;
                        }
                        .invoice-sheet-head {
                            display: flex;
                            align-items: flex-start;
                            justify-content: space-between;
                            gap: 16px;
                            padding-bottom: 18px;
                            border-bottom: 1px solid #e5e7eb;
                        }
                        .invoice-sheet-label {
                            margin: 0 0 8px;
                            font-size: 12px;
                            letter-spacing: 0.16em;
                            color: #94a3b8;
                        }
                        .invoice-store-name {
                            font-size: 26px;
                            font-weight: 800;
                            color: #111827;
                        }
                        .invoice-status {
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 34px;
                            padding: 0 14px;
                            border-radius: 999px;
                            background: #111827;
                            color: #fff;
                            font-size: 13px;
                            font-weight: 700;
                        }
                        .invoice-section {
                            display: grid;
                            gap: 0;
                            margin-top: 18px;
                            padding-top: 18px;
                            border-top: 1px solid #e5e7eb;
                        }
                        .invoice-section:first-of-type {
                            margin-top: 0;
                            padding-top: 18px;
                            border-top: 0;
                        }
                        .invoice-row {
                            display: flex;
                            justify-content: space-between;
                            gap: 20px;
                            align-items: flex-start;
                            padding: 8px 0;
                        }
                        .invoice-label {
                            color: #475569;
                            font-size: 14px;
                            flex-shrink: 0;
                        }
                        .invoice-value {
                            color: #334155;
                            font-size: 15px;
                            font-weight: 700;
                            text-align: right;
                            word-break: break-word;
                        }
                        .invoice-section:first-of-type .invoice-value {
                            max-width: 68%;
                        }
                        .invoice-row.total {
                            margin-top: 4px;
                            padding-top: 12px;
                        }
                        .invoice-row.total .invoice-label,
                        .invoice-row.total .invoice-value {
                            color: #2563eb;
                            font-weight: 800;
                        }
                        .invoice-row.total .invoice-value {
                            font-size: 20px;
                        }
                        .invoice-section.merchant {
                            gap: 18px;
                        }
                        .invoice-merchant-block {
                            display: grid;
                            gap: 8px;
                        }
                        .invoice-merchant-title {
                            font-size: 15px;
                            font-weight: 800;
                            color: #334155;
                        }
                        .invoice-merchant-text {
                            margin: 0;
                            color: #64748b;
                            font-size: 14px;
                            line-height: 1.7;
                        }
                    </style>
                </head>
                <body>
                    ${sheetEl.outerHTML}
                </body>
                </html>
            `;
        }

        function closeModal() {
            modal.hidden = true;
            document.body.classList.remove('modal-open');
            sheetEl.innerHTML = '';
        }

        function saveAsPdf() {
            if (!sheetEl.innerHTML.trim()) {
                return;
            }

            const printWindow = window.open('', '_blank', 'width=560,height=720');

            if (!printWindow) {
                alert('팝업이 차단되어 PDF 저장 창을 열 수 없습니다.');
                return;
            }

            printWindow.document.open();
            printWindow.document.write(buildInvoicePrintMarkup());
            printWindow.document.close();
            printWindow.focus();
            printWindow.addEventListener('load', () => {
                printWindow.print();
            }, { once: true });
        }

        function openModal(order, item) {
            const receiptPrice = Number(item.price || 0);
            const supplyPrice = Math.round(receiptPrice / 1.1);
            const vatPrice = Math.max(receiptPrice - supplyPrice, 0);
            const paymentMethod = order.paymentMethodLabel || order.paymentMethod || '신용카드';

            sheetEl.innerHTML = `
                <div class="invoice-sheet-head">
                    <div>
                        <p class="invoice-sheet-label">INVOICE</p>
                        <strong class="invoice-store-name">SJ SHOP</strong>
                    </div>
                    <span class="invoice-status">결제 완료</span>
                </div>

                <div class="invoice-section">
                    <div class="invoice-row">
                        <span class="invoice-label">주문번호</span>
                        <strong class="invoice-value">${escapeHtml(displayValue(order.orderNumber))}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">구매자</span>
                        <strong class="invoice-value">${escapeHtml(displayValue(order.guestName))}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">구매상품</span>
                        <strong class="invoice-value">${escapeHtml(displayValue(item.title))}</strong>
                    </div>
                </div>

                <div class="invoice-section">
                    <div class="invoice-row">
                        <span class="invoice-label">카드종류</span>
                        <strong class="invoice-value">-</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">카드번호</span>
                        <strong class="invoice-value">-</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">할부</span>
                        <strong class="invoice-value">-</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">결제상태</span>
                        <strong class="invoice-value">완료</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">승인번호</span>
                        <strong class="invoice-value">-</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">결제수단</span>
                        <strong class="invoice-value">${escapeHtml(displayValue(paymentMethod))}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">결제일시</span>
                        <strong class="invoice-value">${escapeHtml(formatDate(order.createdAt))}</strong>
                    </div>
                </div>

                <div class="invoice-section">
                    <div class="invoice-row">
                        <span class="invoice-label">공급가액</span>
                        <strong class="invoice-value">${formatPrice(supplyPrice)}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">면세가액</span>
                        <strong class="invoice-value">0원</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">부가세</span>
                        <strong class="invoice-value">${formatPrice(vatPrice)}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">과세제외액</span>
                        <strong class="invoice-value">0원</strong>
                    </div>
                    <div class="invoice-row total">
                        <span class="invoice-label">합계</span>
                        <strong class="invoice-value">${formatPrice(receiptPrice)}</strong>
                    </div>
                </div>

                <div class="invoice-section merchant">
                    <div class="invoice-merchant-block">
                        <span class="invoice-merchant-title">이용상점</span>
                        <p class="invoice-merchant-text">
                            SJ SHOP | 대표자명: - | 사업자등록번호: -<br>
                            전화: - | 주소: -
                        </p>
                    </div>
                    <div class="invoice-merchant-block">
                        <span class="invoice-merchant-title">결제서비스업체</span>
                        <p class="invoice-merchant-text">-</p>
                    </div>
                </div>
            `;

            modal.hidden = false;
            document.body.classList.add('modal-open');
        }

        modal.addEventListener('click', (event) => {
            if (event.target.closest('[data-invoice-modal-close]')) {
                closeModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.hidden) {
                closeModal();
            }
        });

        saveBtn?.addEventListener('click', saveAsPdf);

        return { openModal };
    }

    const invoiceModal = createInvoiceModal();

    function renderResult(order, items) {
        currentOrder = order;
        currentItems = Array.isArray(items) ? items : [];

        resultInfoBox.innerHTML = `
            <div class="result-info-row">
                <span>주문번호</span>
                <strong>${order.orderNumber}</strong>
            </div>
            <div class="result-info-row">
                <span>주문자</span>
                <strong>${order.guestName || '-'}</strong>
            </div>
            <div class="result-info-row">
                <span>결제금액</span>
                <strong>${formatPrice(order.totalPrice)}</strong>
            </div>
            <div class="result-info-row">
                <span>주문일시</span>
                <strong>${formatDate(order.createdAt)}</strong>
            </div>
        `;

        resultProductsBox.innerHTML = currentItems.map((item, index) => `
            <div class="result-product-wrap">
                <a
                    href="/products-page/${item.product_id}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="result-product"
                >
                    <div class="result-product-thumb">
                        <img src="${getThumbSrc(item)}" alt="${item.title}" />
                    </div>

                    <div class="result-product-info">
                        <p class="result-product-category">상품</p>
                        <h4 class="result-product-title">${item.title}</h4>
                        <p class="result-product-desc">${item.description || '상품 설명이 없습니다.'}</p>
                    </div>

                    <div class="result-product-side">${formatPrice(item.price)}</div>
                </a>

                <div class="result-product-download">
                    <button
                        type="button"
                        class="btn btn-primary guest-download-btn"
                        data-product-id="${item.product_id}"
                    >
                        다운로드
                    </button>
                    <button
                        type="button"
                        class="btn btn-outline guest-invoice-btn"
                        data-item-index="${index}"
                    >
                        영수증
                    </button>
                </div>
            </div>
        `).join('');

        resultBox.style.display = 'block';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const orderNumber = orderNumberInput.value.trim();
        const guestOrderPassword = orderPasswordInput.value.trim();

        errorText.textContent = '';
        resultBox.style.display = 'none';

        if (!orderNumber || !guestOrderPassword) {
            errorText.textContent = '주문번호와 비밀번호를 모두 입력해 주세요.';
            return;
        }

        try {
            const response = await fetch('/api/guest-orders/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    orderNumber,
                    guestOrderPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                renderResult(data.order, data.items);
            } else {
                errorText.textContent = data.message || '주문 정보를 조회하지 못했습니다.';
            }
        } catch (error) {
            console.error('비회원 주문조회 실패:', error);
            errorText.textContent = '서버와 통신 중 오류가 발생했습니다.';
        }
    });

    document.addEventListener('click', async (e) => {
        const invoiceBtn = e.target.closest('.guest-invoice-btn');

        if (invoiceBtn) {
            const itemIndex = Number(invoiceBtn.dataset.itemIndex);

            if (!currentOrder || Number.isNaN(itemIndex) || !currentItems[itemIndex]) {
                alert('영수증 정보를 찾을 수 없습니다.');
                return;
            }

            invoiceModal.openModal(currentOrder, currentItems[itemIndex]);
            return;
        }

        const btn = e.target.closest('.guest-download-btn');
        if (!btn) return;

        const productId = btn.dataset.productId;
        const orderNumber = orderNumberInput.value.trim();
        const guestOrderPassword = orderPasswordInput.value.trim();

        if (!orderNumber || !guestOrderPassword || !productId) {
            alert('주문번호와 비밀번호를 다시 확인해 주세요.');
            return;
        }

        try {
            const response = await fetch('/api/guest-orders/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    orderNumber,
                    guestOrderPassword,
                    productId
                })
            });

            const contentType = response.headers.get('Content-Type') || '';

            if (contentType.includes('application/json')) {
                const errorData = await response.json();
                alert(errorData.message || '파일 다운로드에 실패했습니다.');
                return;
            }

            if (!response.ok) {
                alert('파일 다운로드에 실패했습니다.');
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const disposition = response.headers.get('Content-Disposition') || '';
            let fileName = 'downloaded-file';

            const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
            const normalMatch = disposition.match(/filename="?([^"]+)"?/i);

            if (utf8Match && utf8Match[1]) {
                fileName = decodeURIComponent(utf8Match[1]);
            } else if (normalMatch && normalMatch[1]) {
                fileName = normalMatch[1];
            }

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('비회원 다운로드 요청 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    });
});
