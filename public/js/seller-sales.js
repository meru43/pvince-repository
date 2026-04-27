document.addEventListener('DOMContentLoaded', async () => {
    const SALES_PER_PAGE = 30;
    const MIN_SETTLEMENT_AMOUNT = 25000;

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
                ? `정산금액이 ${MIN_SETTLEMENT_AMOUNT.toLocaleString()}원 이상일 때 신청할 수 있습니다.`
                : '';
        }
    }

    function renderEmpty(message) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-message table-empty">${message}</td>
            </tr>
        `;
    }

    function renderSalesRows(sales) {
        if (!sales || sales.length === 0) {
            renderEmpty('표시할 판매 내역이 없습니다.');
            return;
        }

        tableBody.innerHTML = sales.map((sale) => `
            <tr>
                <td>${formatDate(sale.created_at)}</td>
                <td>${sale.order_number || '-'}</td>
                <td>${sale.buyer_name || '-'}</td>
                <td>${sale.seller_name || '-'}</td>
                <td><a href="/products-page/${sale.product_id}" class="seller-sales-product-link">${sale.product_title}</a></td>
                <td>${sale.payment_method_label || '신용카드'}</td>
                <td>${formatPrice(sale.price)}</td>
                <td><span class="settlement-status ${sale.settlement_status === 'requested' ? 'is-requested' : 'is-pending'}">${sale.settlement_status_label || '정산신청 미완료'}</span></td>
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

    renderPagination();
    await loadMe();
    await loadSales();
});
