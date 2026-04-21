document.addEventListener('DOMContentLoaded', () => {
    const completeInfoBox = document.getElementById('complete-info-box');

    const orderNumber = sessionStorage.getItem('lastOrderNumber');
    const totalPrice = sessionStorage.getItem('lastOrderTotalPrice');

    if (!orderNumber) {
        completeInfoBox.innerHTML = `
            <div class="complete-info-row">
                <span>주문 정보</span>
                <strong>주문 정보를 찾을 수 없습니다.</strong>
            </div>
        `;
        return;
    }

    completeInfoBox.innerHTML = `
        <div class="complete-info-row">
            <span>주문번호</span>
            <strong>${orderNumber}</strong>
        </div>
        <div class="complete-info-row">
            <span>결제금액</span>
            <strong>${Number(totalPrice).toLocaleString()}원</strong>
        </div>
        <div class="complete-info-row">
            <span>상태</span>
            <strong>결제 완료</strong>
        </div>
    `;
});