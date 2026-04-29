window.createProductJoditEditor = function createProductJoditEditor(textarea) {
    if (!window.Jodit || !textarea) {
        return null;
    }

    return Jodit.make(textarea, {
        height: 420,
        toolbarAdaptive: false,
        buttons: [
            'bold', 'italic', 'underline', 'strikethrough', '|',
            'ul', 'ol', '|',
            'font', 'fontsize', 'paragraph', 'brush', '|',
            'image', 'table', 'link', '|',
            'align', 'outdent', 'indent', '|',
            'undo', 'redo', '|',
            'hr', 'eraser', 'fullsize'
        ],
        uploader: {
            url: '/api/editor/image-upload',
            method: 'POST',
            format: 'json',
            withCredentials: true,
            insertImageAsBase64URI: false,
            filesVariableName: () => 'editorImage',
            isSuccess: (response) => Boolean(response && response.success),
            getMessage: (response) => response?.message || '',
            process: (response) => ({
                files: response?.url ? [response.url] : [],
                path: '',
                baseurl: '',
                url: response?.url || '',
                error: response?.success ? 0 : 1,
                msg: response?.message || ''
            }),
            defaultHandlerSuccess: function (data) {
                const editor = this.j || this;
                const imageUrl = data?.url || data?.files?.[0] || '';

                if (!imageUrl || !editor?.s?.insertImage) {
                    return;
                }

                editor.s.insertImage(imageUrl);
            },
            error: (error) => {
                console.error('Jodit image upload error:', error);
                alert('에디터 이미지 업로드 중 오류가 발생했습니다.');
            }
        }
    });
};

window.normalizeProductEditorHtml = function normalizeProductEditorHtml(html) {
    const rawHtml = String(html || '').trim();
    if (!rawHtml) {
        return '';
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = rawHtml;

    const normalizeWidthClass = (img, widthValue) => {
        img.classList.remove(
            'editor-image-sm',
            'editor-image-md',
            'editor-image-lg',
            'editor-image-full'
        );

        const width = Number(widthValue || 0);
        if (!Number.isFinite(width) || width <= 0) {
            return;
        }

        if (width <= 35) {
            img.classList.add('editor-image-sm');
        } else if (width <= 55) {
            img.classList.add('editor-image-md');
        } else if (width <= 85) {
            img.classList.add('editor-image-lg');
        } else {
            img.classList.add('editor-image-full');
        }
    };

    wrapper.querySelectorAll('img').forEach((img) => {
        const style = img.getAttribute('style') || '';
        const widthMatch = style.match(/width\s*:\s*([0-9.]+)%/i)
            || style.match(/width\s*:\s*([0-9.]+)px/i);

        if (widthMatch) {
            normalizeWidthClass(img, widthMatch[1]);
        }

        const parent = img.parentElement;
        const parentStyle = parent?.getAttribute('style') || '';
        const imageStyle = style.toLowerCase();

        img.classList.remove(
            'editor-image-align-left',
            'editor-image-align-center',
            'editor-image-align-right'
        );

        if (/text-align\s*:\s*center/i.test(parentStyle) || /margin-left\s*:\s*auto/i.test(imageStyle) && /margin-right\s*:\s*auto/i.test(imageStyle)) {
            img.classList.add('editor-image-align-center');
        } else if (/text-align\s*:\s*right/i.test(parentStyle) || /float\s*:\s*right/i.test(imageStyle)) {
            img.classList.add('editor-image-align-right');
        } else {
            img.classList.add('editor-image-align-left');
        }
    });

    return wrapper.innerHTML;
};
