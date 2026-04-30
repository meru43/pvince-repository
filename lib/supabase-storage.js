const fs = require('fs/promises');
const path = require('path');
const { supabase, isSupabaseConfigured } = require('./supabase');

function sanitizePathSegment(value) {
    return String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_');
}

function buildObjectPath({ folder = '', originalName = '' }) {
    const ext = path.extname(originalName || '').toLowerCase();
    const baseName = sanitizePathSegment(path.basename(originalName || 'file', ext)) || 'file';
    const folderPath = String(folder || '')
        .split('/')
        .map((segment) => sanitizePathSegment(segment))
        .filter(Boolean)
        .join('/');

    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${baseName}${ext}`;
    return folderPath ? `${folderPath}/${uniqueName}` : uniqueName;
}

async function uploadFileToSupabaseStorage({
    bucket,
    folder = '',
    localFilePath,
    originalName,
    mimeType
}) {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase storage is not configured.');
    }

    if (!bucket) {
        throw new Error('Supabase bucket name is missing.');
    }

    if (!localFilePath) {
        throw new Error('Local file path is missing.');
    }

    const fileBuffer = await fs.readFile(localFilePath);
    const objectPath = buildObjectPath({
        folder,
        originalName
    });

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(objectPath, fileBuffer, {
            contentType: mimeType || 'application/octet-stream',
            upsert: false
        });

    if (error) {
        throw error;
    }

    const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

    return {
        objectPath: data.path,
        publicUrl: publicUrlData.publicUrl
    };
}

module.exports = {
    isSupabaseConfigured,
    uploadFileToSupabaseStorage
};
