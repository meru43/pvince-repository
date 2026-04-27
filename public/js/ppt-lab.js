document.addEventListener('DOMContentLoaded', () => {
    const userRole = document.body.dataset.userRole || '';
    const canUploadTemplate = userRole === 'seller' || userRole === 'admin';

    const sellerPanel = document.getElementById('ppt-seller-panel');
    const templateForm = document.getElementById('ppt-template-form');
    const templateMessage = document.getElementById('ppt-template-message');

    const requestForm = document.getElementById('ppt-request-form');
    const searchInput = document.getElementById('ppt-template-search');
    const searchBtn = document.getElementById('ppt-template-search-btn');
    const templateCount = document.getElementById('ppt-template-count');
    const templateGrid = document.getElementById('ppt-template-grid');
    const templateBrowser = document.getElementById('ppt-template-browser');

    const matchBox = document.getElementById('ppt-match-box');
    const matchTitle = document.getElementById('ppt-match-title');
    const matchDesc = document.getElementById('ppt-match-desc');
    const matchPlan = document.getElementById('ppt-match-plan');
    const previewResult = document.getElementById('ppt-preview-result');

    let templates = [];
    let highlightedTemplateId = null;

    if (sellerPanel) {
        sellerPanel.hidden = !canUploadTemplate;
    }

    if (templateBrowser) {
        templateBrowser.hidden = !canUploadTemplate;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString('ko-KR');
    }

    function getFieldTypeLabel(type) {
        if (type === 'textarea') return '긴 텍스트';
        if (type === 'number') return '숫자';
        if (type === 'image') return '이미지';
        return '텍스트';
    }

    function setTemplateMessage(message = '', isError = false) {
        if (!templateMessage) return;
        templateMessage.textContent = message;
        templateMessage.style.color = isError ? '#d93025' : '#6b7280';
    }

    function setMatchVisibility(visible) {
        if (matchBox) {
            matchBox.hidden = !visible;
        }
    }

    function renderTemplates() {
        if (!templateGrid || !templateCount) {
            return;
        }

        templateCount.textContent = `총 ${templates.length}개 템플릿`;

        if (!templates.length) {
            templateGrid.innerHTML = '<p class="empty-message">등록된 PPT 템플릿이 없습니다.</p>';
            return;
        }

        templateGrid.innerHTML = templates.map((template) => `
            <article class="ppt-template-card ${highlightedTemplateId === template.id ? 'is-selected' : ''}">
                <div class="template-preview">
                    ${template.previewImagePath
                ? `<img src="${template.previewImagePath}" alt="${escapeHtml(template.title)}">`
                : '<div class="template-preview-fallback">PPT PREVIEW</div>'
            }
                </div>

                <div class="template-body">
                    <div class="template-title-row">
                        <h3 class="template-title">${escapeHtml(template.title)}</h3>
                        <span class="template-category">${escapeHtml(template.category || '미분류')}</span>
                    </div>

                    <p class="template-desc">${escapeHtml(template.description || '템플릿 설명이 아직 없습니다.')}</p>
                    <p class="template-meta">업로더: ${escapeHtml(template.creatorName)} · 등록일: ${escapeHtml(formatDate(template.createdAt))}</p>
                    <p class="template-file">원본 파일: ${escapeHtml(template.pptFileName)}</p>

                    <div class="template-fields">
                        ${(template.aiAnalysis?.suggested_fields?.length ? template.aiAnalysis.suggested_fields : template.fields).slice(0, 5).map((field) => `
                            <span class="template-field-pill">
                                ${escapeHtml(field.label || field.key)} · ${escapeHtml(getFieldTypeLabel(field.type || 'text'))}
                            </span>
                        `).join('')}
                    </div>

                    <div class="template-actions">
                        <button type="button" class="btn btn-outline ppt-template-preview-btn" data-template-id="${template.id}">
                            템플릿 보기
                        </button>
                        <button type="button" class="btn btn-primary ppt-template-analyze-btn" data-template-id="${template.id}">
                            ${template.aiAnalysisStatus === 'done' ? 'AI 분석 다시하기' : 'AI 분석하기'}
                        </button>
                    </div>

                    <p class="template-meta">AI 분석 상태: ${template.aiAnalysisStatus === 'done' ? '완료' : template.aiAnalysisStatus === 'error' ? '실패' : '대기'}</p>
                </div>
            </article>
        `).join('');
    }

    function buildTemplatePreviewCard(template, recommendation = null) {
        const suggestedFields = template.aiAnalysis?.suggested_fields?.length
            ? template.aiAnalysis.suggested_fields
            : template.fields;

        const matchedInputsHtml = recommendation?.matched_inputs?.length
            ? recommendation.matched_inputs.map((item) => `
                <div class="result-info-row">
                    <span>${escapeHtml(item.input_label)}</span>
                    <strong>${escapeHtml(item.input_value || '-')}</strong>
                </div>
                <div class="result-info-row sub">
                    <span>추천 연결</span>
                    <strong>${escapeHtml(item.suggested_field_label || '-')}</strong>
                </div>
            `).join('')
            : suggestedFields.map((field) => `
                <div class="result-info-row">
                    <span>${escapeHtml(field.label || field.key)}</span>
                    <strong>${escapeHtml(getFieldTypeLabel(field.type || 'text'))}</strong>
                </div>
            `).join('');

        return `
            <article class="ppt-preview-card">
                <div class="ppt-preview-thumb">
                    ${template.previewImagePath
                ? `<img src="${template.previewImagePath}" alt="${escapeHtml(template.title)}">`
                : '<div class="template-preview-fallback">PPT 미리보기 없음</div>'
            }
                </div>

                <div class="ppt-preview-summary">
                    <h4>${escapeHtml(template.title)}</h4>
                    <p class="template-meta">카테고리: ${escapeHtml(template.category || '미분류')}</p>
                    <p class="template-file">원본 파일: ${escapeHtml(template.pptFileName)}</p>
                    ${recommendation?.reason ? `<p class="template-desc">${escapeHtml(recommendation.reason)}</p>` : ''}
                </div>

                ${template.aiAnalysis ? `
                    <div class="ppt-preview-summary analysis">
                        <h4>AI 분석 요약</h4>
                        <p class="template-meta">유형: ${escapeHtml(template.aiAnalysis.template_type || '-')}</p>
                        <p class="template-desc">${escapeHtml(template.aiAnalysis.summary || '분석 요약이 없습니다.')}</p>
                        <ul>
                            ${(template.aiAnalysis.recommended_for || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>추천 사용 상황이 없습니다.</li>'}
                        </ul>
                    </div>
                ` : ''}

                <div class="result-info">
                    ${matchedInputsHtml}
                </div>
            </article>
        `;
    }

    function showTemplateOnly(template) {
        if (templateBrowser) {
            templateBrowser.hidden = false;
        }

        highlightedTemplateId = template.id;
        renderTemplates();
        setMatchVisibility(true);
        matchTitle.textContent = `${template.title} 템플릿 보기`;
        matchDesc.textContent = '판매자가 업로드한 템플릿과 현재 분석 상태를 확인하는 영역입니다.';
        matchPlan.innerHTML = `
            <div class="ppt-preview-summary">
                <h4>현재 템플릿 정보</h4>
                <p class="template-desc">${escapeHtml(template.description || '설명이 아직 없습니다.')}</p>
                <ul>
                    <li>AI 분석 상태: ${template.aiAnalysisStatus === 'done' ? '완료' : template.aiAnalysisStatus === 'error' ? '실패' : '대기'}</li>
                    <li>추천 필드 수: ${template.aiAnalysis?.suggested_fields?.length || template.fields.length || 0}개</li>
                    <li>업로더: ${escapeHtml(template.creatorName)}</li>
                </ul>
            </div>
        `;
        previewResult.innerHTML = buildTemplatePreviewCard(template);
        matchBox?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function showRecommendation(recommendation) {
        if (templateBrowser) {
            templateBrowser.hidden = false;
        }

        const bestTemplate = templates.find((template) => template.id === recommendation.best_template_id) || null;
        highlightedTemplateId = bestTemplate?.id || null;
        renderTemplates();
        setMatchVisibility(true);

        matchTitle.textContent = bestTemplate
            ? `AI 추천 결과 · ${bestTemplate.title}`
            : 'AI 추천 결과';
        matchDesc.textContent = recommendation.reason || '입력한 내용을 기준으로 가장 잘 맞는 템플릿을 추천했습니다.';

        const recommendedItems = recommendation.recommended_templates?.length
            ? recommendation.recommended_templates.map((item) => {
                const template = templates.find((entry) => entry.id === item.id);
                return `
                    <li>
                        <strong>${escapeHtml(template?.title || `템플릿 #${item.id}`)}</strong>
                        <span> · 신뢰도 ${Math.round((item.confidence || 0) * 100)}%</span><br>
                        ${escapeHtml(item.reason || '')}
                    </li>
                `;
            }).join('')
            : '<li>추천 후보가 없습니다.</li>';

        const planItems = recommendation.template_use_plan?.length
            ? recommendation.template_use_plan.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
            : '<li>사용 계획 정보가 없습니다.</li>';

        matchPlan.innerHTML = `
            <div class="ppt-preview-summary">
                <h4>추천 이유</h4>
                <p class="template-desc">${escapeHtml(recommendation.reason || '추천 이유가 없습니다.')}</p>
            </div>
            <div class="ppt-preview-summary">
                <h4>추천 템플릿 후보</h4>
                <ul>${recommendedItems}</ul>
            </div>
            <div class="ppt-preview-summary">
                <h4>예상 구성 계획</h4>
                <ul>${planItems}</ul>
            </div>
        `;

        previewResult.innerHTML = bestTemplate
            ? buildTemplatePreviewCard(bestTemplate, recommendation)
            : '<p class="empty-message">추천된 템플릿이 없습니다.</p>';

        matchBox?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function loadTemplates() {
        if (!templateGrid) return;

        templateGrid.innerHTML = '<p class="empty-message">템플릿을 불러오는 중입니다.</p>';

        try {
            const params = new URLSearchParams({
                q: searchInput?.value?.trim() || ''
            });

            const response = await fetch(`/api/ppt-templates?${params.toString()}`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (!data.success) {
                templateGrid.innerHTML = `<p class="empty-message">${data.message || '템플릿을 불러오지 못했습니다.'}</p>`;
                return;
            }

            templates = data.templates || [];
            renderTemplates();
        } catch (error) {
            console.error('ppt templates load error:', error);
            templateGrid.innerHTML = '<p class="empty-message">서버와 통신 중 오류가 발생했습니다.</p>';
        }
    }

    templateForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(templateForm);
        setTemplateMessage('');

        try {
            const response = await fetch('/api/ppt-templates', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                setTemplateMessage(data.message || '템플릿 저장에 실패했습니다.', true);
                return;
            }

            setTemplateMessage(data.message || '템플릿이 저장되었습니다.');
            templateForm.reset();
            await loadTemplates();
        } catch (error) {
            console.error('ppt template save error:', error);
            setTemplateMessage('서버와 통신 중 오류가 발생했습니다.', true);
        }
    });

    requestForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const requestData = {};
        new FormData(requestForm).forEach((value, key) => {
            requestData[key] = value;
        });

        try {
            const response = await fetch('/api/ppt-templates/recommend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestData)
            });

            const data = await response.json();

            if (!data.success) {
                setMatchVisibility(true);
                matchTitle.textContent = '추천 결과';
                matchDesc.textContent = data.message || '추천 결과를 만들지 못했습니다.';
                matchPlan.innerHTML = '<p class="empty-message">추천 결과가 없습니다.</p>';
                previewResult.innerHTML = '<p class="empty-message">추천 결과가 없습니다.</p>';
                return;
            }

            showRecommendation(data.recommendation);

            if (data.fallback && data.message) {
                alert(data.message);
            }
        } catch (error) {
            console.error('ppt recommend error:', error);
            setMatchVisibility(true);
            matchTitle.textContent = '추천 결과';
            matchDesc.textContent = '서버와 통신 중 오류가 발생했습니다.';
            matchPlan.innerHTML = '<p class="empty-message">추천 결과를 불러오지 못했습니다.</p>';
            previewResult.innerHTML = '<p class="empty-message">추천 결과를 불러오지 못했습니다.</p>';
        }
    });

    searchBtn?.addEventListener('click', async () => {
        await loadTemplates();
    });

    searchInput?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await loadTemplates();
        }
    });

    templateGrid?.addEventListener('click', async (event) => {
        const analyzeButton = event.target.closest('.ppt-template-analyze-btn');
        if (analyzeButton) {
            const templateId = Number(analyzeButton.dataset.templateId);
            const template = templates.find((item) => item.id === templateId);
            if (!template) return;

            analyzeButton.disabled = true;
            analyzeButton.textContent = '분석 중...';

            try {
                const response = await fetch(`/api/ppt-templates/${templateId}/analyze`, {
                    method: 'POST',
                    credentials: 'include'
                });

                const data = await response.json();

                if (!data.success) {
                    alert(data.message || 'AI 분석에 실패했습니다.');
                    return;
                }

                alert(data.message || 'AI 분석이 완료되었습니다.');
                await loadTemplates();
            } catch (error) {
                console.error('ppt ai analyze error:', error);
                alert('서버와 통신 중 오류가 발생했습니다.');
            } finally {
                analyzeButton.disabled = false;
                analyzeButton.textContent = template.aiAnalysisStatus === 'done' ? 'AI 분석 다시하기' : 'AI 분석하기';
            }

            return;
        }

        const previewButton = event.target.closest('.ppt-template-preview-btn');
        if (!previewButton) return;

        const templateId = Number(previewButton.dataset.templateId);
        const template = templates.find((item) => item.id === templateId);
        if (!template) return;

        showTemplateOnly(template);
    });

    loadTemplates();
});
