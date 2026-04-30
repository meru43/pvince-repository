const { createClient } = require('@supabase/supabase-js');

function normalizeEnvValue(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
        return '';
    }

    if (
        (rawValue.startsWith('"') && rawValue.endsWith('"'))
        || (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
        return rawValue.slice(1, -1).trim();
    }

    return rawValue;
}

const supabaseUrl = normalizeEnvValue(process.env.SUPABASE_URL);
const supabaseServiceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

let supabase = null;

if (supabaseUrl && supabaseServiceRoleKey) {
    supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    });
}

function isSupabaseConfigured() {
    return Boolean(supabase);
}

console.log('[SUPABASE ENV CHECK]', {
    hasUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(supabaseServiceRoleKey),
    configured: isSupabaseConfigured(),
    projectHost: supabaseUrl ? supabaseUrl.replace(/^https?:\/\//i, '') : null
});

module.exports = {
    supabase,
    isSupabaseConfigured
};
