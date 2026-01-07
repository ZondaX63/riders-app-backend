const path = require('path');

function normalizeImagePath(p) {
    if (!p) return p;

    // Replace backslashes with forward slashes
    let s = p.replace(/\\/g, '/');

    // Extract trailing part starting from /uploads/ if it's an absolute path
    const lower = s.toLowerCase();
    const idx = lower.lastIndexOf('/uploads/');
    if (idx !== -1) {
        s = s.substring(idx + 1); // remove leading '/' from /uploads/...
    } else if (lower.includes('uploads/')) {
        // If it contains uploads/ but not preceded by / (e.g. relative or strange absolute)
        const first = lower.indexOf('uploads/');
        s = s.substring(first);
    }

    // Ensure it starts with 'uploads/'
    if (!s.startsWith('uploads/')) {
        s = 'uploads/' + s.replace(/^\/+/, '');
    }

    return s;
}

module.exports = {
    normalizeImagePath
};
