document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('admin-settlement-search');
    const searchBtn = document.getElementById('admin-settlement-search-btn');
    const tableBody = document.getElementById('admin-settlements-body');

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

    function renderEmpty(message) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-message table-empty">${message}</td>
            </tr>
        `;
    }

    function renderRows(items) {
        if (!items || items.length === 0) {
            renderEmpty('표시할 정산신청 내역이 없습니다.');
            return;
        }

        tableBody.innerHTML = items.map((item) => `
            <tr>
                <td>${formatDate(item.requested_at)}</td>
                <td>${item.seller_name || '-'}</td>
                <td>${Number(item.sales_count || 0)}건</td>
                <td>${formatPrice(item.total_sales_amount)}</td>
                <td>${formatPrice(item.fee_amount)}</td>
                <td>${formatPrice(item.settlement_amount)}</td>
                <td><span class="admin-settlement-status">${item.status_label || '정산신청완료'}</span></td>
                <td>
                    <button
                        type="button"
                        class="btn btn-outline admin-settlement-export-row-btn"
                        data-request-id="${item.id}"
                        data-seller-name="${item.seller_name || 'seller'}"
                    >
                        정산내역 출력
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function downloadCsv(csvRows, fileName) {
        const csvContent = `\uFEFF${csvRows
            .map((row) => row.map(escapeCsvValue).join(','))
            .join('\n')}`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    async function exportSettlementRequest(requestId, sellerName) {
        try {
            const response = await fetch(`/api/admin/settlement-requests/${requestId}/items`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                alert(data.message || '정산내역을 불러오지 못했습니다.');
                return;
            }

            const csvRows = [
                ['정산신청번호', '신청일시', '판매자', '주문번호', '구매일시', '구매자', '상품명', '결제수단', '판매금액'],
                ...(data.items || []).map((item) => [
                    item.request_id || requestId,
                    formatDate(item.requested_at),
                    item.seller_name || sellerName || '-',
                    item.order_number || '-',
                    formatDate(item.created_at),
                    item.buyer_name || '-',
                    item.product_title || '-',
                    item.payment_method_label || '신용카드',
                    formatPrice(item.price)
                ])
            ];

            const safeSellerName = String(sellerName || 'seller').replace(/[\\/:*?"<>|]/g, '_');
            downloadCsv(csvRows, `settlement-${requestId}-${safeSellerName}.csv`);
        } catch (error) {
            console.error('정산내역 출력 실패:', error);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    }

    async function loadRequests() {
        try {
            const params = new URLSearchParams({
                q: searchInput?.value?.trim() || ''
            });

            const response = await fetch(`/api/admin/settlement-requests?${params.toString()}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                renderEmpty(data.message || '정산신청 내역을 불러오지 못했습니다.');
                return;
            }

            renderRows(Array.isArray(data.requests) ? data.requests : []);
        } catch (error) {
            console.error('정산신청 내역 조회 실패:', error);
            renderEmpty('서버와 통신 중 오류가 발생했습니다.');
        }
    }

    searchBtn?.addEventListener('click', async () => {
        await loadRequests();
    });

    searchInput?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await loadRequests();
        }
    });

    tableBody?.addEventListener('click', async (event) => {
        const exportButton = event.target.closest('.admin-settlement-export-row-btn');

        if (!exportButton) {
            return;
        }

        const requestId = Number(exportButton.dataset.requestId || 0);
        const sellerName = exportButton.dataset.sellerName || 'seller';

        if (!requestId) {
            alert('정산신청 정보를 찾을 수 없습니다.');
            return;
        }

        await exportSettlementRequest(requestId, sellerName);
    });

    await loadRequests();
});
