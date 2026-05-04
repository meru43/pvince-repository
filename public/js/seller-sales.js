document.addEventListener('DOMContentLoaded', async () => {
    const SALES_PER_PAGE = 30;
    const MIN_SETTLEMENT_AMOUNT = 25000;
    const closeButtonSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="icon icon-tabler icons-tabler-filled icon-tabler-x" aria-hidden="true" focusable="false">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M6.707 5.293l5.293 5.292l5.293 -5.292a1 1 0 0 1 1.414 1.414l-5.292 5.293l5.292 5.293a1 1 0 0 1 -1.414 1.414l-5.293 -5.292l-5.293 5.292a1 1 0 1 1 -1.414 -1.414l5.292 -5.293l-5.292 -5.293a1 1 0 0 1 1.414 -1.414" />
        </svg>
    `.trim();

    const searchInput = document.getElementById('seller-sales-search');
    const searchBtn = document.getElementById('seller-sales-search-btn');
    const exportBtn = document.getElementById('seller-sales-export-btn');
    const requestBtn = document.getElementById('settlement-request-btn');
    const totalSalesEl = document.getElementById('settlement-total-sales');
    const feeEl = document.getElementById('settlement-fee');
    const amountEl = document.getElementById('settlement-amount');
    const summarySection = document.getElementById('settlement-summary');
    const tableBody = document.getElementById('seller-sales-body');
    const pagination = document.getElementById('seller-sales-pagination');

    let allSales = [];
    let currentPage = 1;
    let currentRole = '';
    let settlementSummary = {
        totalSalesAmount: 0,
        feeAmount: 0,
        settlementAmount: 0,
        pendingCount: 0
    };

    function formatDate(value) {
        if (!value) return '-';

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
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

    function escapeCsvValue(value) {
        const text = String(value ?? '');
        return `"${text.replace(/"/g, '""')}"`;
    }

    function getTotalPages() {
        return Math.max(1, Math.ceil(allSales.length / SALES_PER_PAGE));
    }

    function getPagedSales() {
        const startIndex = (currentPage - 1) * SALES_PER_PAGE;
        return allSales.slice(startIndex, startIndex + SALES_PER_PAGE);
    }

    function renderSummary() {
        if (!summarySection) return;

        const isSeller = currentRole === 'seller';
        summarySection.hidden = !isSeller;

        if (!isSeller) {
            return;
        }

        totalSalesEl.textContent = formatPrice(settlementSummary.totalSalesAmount);
        feeEl.textContent = formatPrice(settlementSummary.feeAmount);
        amountEl.textContent = formatPrice(settlementSummary.settlementAmount);

        if (requestBtn) {
            requestBtn.disabled = settlementSummary.pendingCount === 0 || settlementSummary.settlementAmount < MIN_SETTLEMENT_AMOUNT;
            requestBtn.title = settlementSummary.settlementAmount < MIN_SETTLEMENT_AMOUNT
                ? `정산금액이 ${MIN_SETTLEMENT_AMOUNT.toLocaleString()}원 이상일 때만 신청할 수 있습니다.`
                : '';
        }
    }

    function renderEmpty(message) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-message table-empty">${message}</td>
            </tr>
        `;
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
                        <button type="button" class="download-modal-close" data-invoice-modal-close aria-label="팝업 닫기">${closeButtonSvg}</button>
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

        function openModal(sale) {
            const receiptPrice = Number(sale.price || 0);
            const supplyPrice = Math.round(receiptPrice / 1.1);
            const vatPrice = Math.max(receiptPrice - supplyPrice, 0);

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
                        <strong class="invoice-value">${escapeHtml(displayValue(sale.order_number))}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">구매자</span>
                        <strong class="invoice-value">${escapeHtml(displayValue(sale.buyer_name))}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">구매상품</span>
                        <strong class="invoice-value">${escapeHtml(displayValue(sale.product_title))}</strong>
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
                        <strong class="invoice-value">${escapeHtml(displayValue(sale.payment_method_label || '신용카드'))}</strong>
                    </div>
                    <div class="invoice-row">
                        <span class="invoice-label">결제일시</span>
                        <strong class="invoice-value">${escapeHtml(formatDate(sale.created_at))}</strong>
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

    function renderSalesRows(sales) {
        if (!sales || sales.length === 0) {
            renderEmpty('표시할 판매 내역이 없습니다.');
            return;
        }

        const startIndex = (currentPage - 1) * SALES_PER_PAGE;

        tableBody.innerHTML = sales.map((sale, index) => `
            <tr>
                <td>${formatDate(sale.created_at)}</td>
                <td>${sale.order_number || '-'}</td>
                <td>${sale.buyer_name || '-'}</td>
                <td>${sale.seller_name || '-'}</td>
                <td><a href="/products-page/${sale.product_id}" class="seller-sales-product-link">${sale.product_title}</a></td>
                <td>${sale.payment_method_label || '신용카드'}</td>
                <td>${formatPrice(sale.price)}</td>
                <td><span class="settlement-status ${sale.settlement_status === 'requested' ? 'is-requested' : 'is-pending'}">${sale.settlement_status_label || '정산신청 미완료'}</span></td>
                <td><button type="button" class="btn btn-outline seller-sales-invoice-btn" data-sale-index="${startIndex + index}">영수증</button></td>
            </tr>
        `).join('');
    }

    function renderPagination() {
        const totalPages = getTotalPages();

        pagination.innerHTML = `
            <button type="button" class="sales-page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>이전</button>
            <span class="sales-page-number active">${currentPage}</span>
            <button type="button" class="sales-page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>다음</button>
        `;
    }

    function renderPage() {
        renderSalesRows(getPagedSales());
        renderPagination();
        renderSummary();
    }

    function downloadSalesCsv() {
        const rows = [
            ['구매일시', '주문번호', '구매자', '판매자', '상품명', '결제수단', '결제금액', '정산상태'],
            ...allSales.map((sale) => [
                formatDate(sale.created_at),
                sale.order_number || '-',
                sale.buyer_name || '-',
                sale.seller_name || '-',
                sale.product_title || '-',
                sale.payment_method_label || '신용카드',
                formatPrice(sale.price),
                sale.settlement_status_label || '정산신청 미완료'
            ])
        ];

        const csvContent = `\uFEFF${rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n')}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);

        link.href = url;
        link.download = `seller-sales-${date}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    async function loadMe() {
        try {
            const response = await fetch('/me', {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();
            currentRole = data.role || '';
        } catch (error) {
            console.error('사용자 정보 조회 실패:', error);
        }
    }

    async function loadSales() {
        try {
            const params = new URLSearchParams({
                q: searchInput?.value?.trim() || ''
            });

            const response = await fetch(`/api/seller/sales-dashboard?${params.toString()}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                allSales = [];
                currentPage = 1;
                settlementSummary = {
                    totalSalesAmount: 0,
                    feeAmount: 0,
                    settlementAmount: 0,
                    pendingCount: 0
                };
                renderEmpty(data.message || '판매 내역을 불러오지 못했습니다.');
                renderPagination();
                renderSummary();
                return;
            }

            allSales = Array.isArray(data.sales) ? data.sales : [];
            settlementSummary = data.summary || settlementSummary;
            currentPage = 1;
            renderPage();
        } catch (error) {
            console.error('판매 내역 조회 실패:', error);
            allSales = [];
            currentPage = 1;
            settlementSummary = {
                totalSalesAmount: 0,
                feeAmount: 0,
                settlementAmount: 0,
                pendingCount: 0
            };
            renderEmpty('서버와 통신 중 오류가 발생했습니다.');
            renderPagination();
            renderSummary();
        }
    }

    async function requestSettlement() {
        try {
            const response = await fetch('/api/seller/settlement-requests', {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                alert(data.message || '정산신청에 실패했습니다.');
                return;
            }

            alert(data.message || '정산신청이 완료되었습니다.');
            await loadSales();
        } catch (error) {
            console.error('정산신청 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    }

    searchBtn?.addEventListener('click', async () => {
        await loadSales();
    });

    searchInput?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await loadSales();
        }
    });

    exportBtn?.addEventListener('click', () => {
        downloadSalesCsv();
    });

    requestBtn?.addEventListener('click', async () => {
        await requestSettlement();
    });

    pagination?.addEventListener('click', (event) => {
        const pageButton = event.target.closest('[data-page]');

        if (!pageButton || pageButton.disabled) {
            return;
        }

        const nextPage = Number(pageButton.dataset.page);
        const totalPages = getTotalPages();

        if (nextPage < 1 || nextPage > totalPages) {
            return;
        }

        currentPage = nextPage;
        renderPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    tableBody?.addEventListener('click', (event) => {
        const invoiceBtn = event.target.closest('.seller-sales-invoice-btn');

        if (!invoiceBtn) {
            return;
        }

        const saleIndex = Number(invoiceBtn.dataset.saleIndex);

        if (Number.isNaN(saleIndex) || !allSales[saleIndex]) {
            alert('영수증 정보를 찾을 수 없습니다.');
            return;
        }

        invoiceModal.openModal(allSales[saleIndex]);
    });

    renderPagination();
    await loadMe();
    await loadSales();
});
