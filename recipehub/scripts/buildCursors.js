const fs = require('node:fs'); const path = require('node:path');
const dir = path.join(__dirname, '../public/images/cursors'); fs.mkdirSync(dir, { recursive: true });
const defs = '<defs><linearGradient id="arrow" x1="14" y1="28" x2="42" y2="56" gradientUnits="userSpaceOnUse"><stop stop-color="#FFB36F"/><stop offset=".52" stop-color="#FF7A36"/><stop offset="1" stop-color="#FF6728"/></linearGradient><linearGradient id="white" x1="20" y1="10" x2="37" y2="38" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFF9F2"/></linearGradient><filter id="shadow" x="-40%" y="-30%" width="180%" height="190%"><feDropShadow dx="1" dy="2" stdDeviation="1.3" flood-color="#78300F" flood-opacity=".25"/></filter></defs>';
const hat = '<path d="M15 30C5 28 5 14 14 11c3-7 10-7 14-1 7-7 17-3 18 6 11 1 12 15 2 18l-5 5-28-3z" fill="url(#white)" stroke="#C94B12" stroke-width="2.4" stroke-linejoin="round"/><path d="M17 32q12 3 28 4" stroke="#FFE1C7" stroke-width="3" stroke-linecap="round"/>';

const arrow = '<path d="M13 29q-3-2-3 3l7 24q2 6 5 1l9-15 12 2q5 0 1-4L27 29q-8-5-14 0z" fill="url(#arrow)" stroke="#C94B12" stroke-width="2.8" stroke-linejoin="round"/><path d="M15 31q5-3 11 1l6 4q-12-3-16 4z" fill="#FFD5A1" opacity=".75"/><path d="m15 34 4 15" stroke="#FFCC92" stroke-width="2" stroke-linecap="round"/>';
const chef = hat + arrow;
const rays = '<g stroke="#FF7A36" stroke-width="4.5" stroke-linecap="round"><path d="m50 9 3-6m2 15 7-3m-7 13 7 2"/></g>';
const hand = '<path d="M24 37C21 30 20 20 19 12 18 6 21 3 25 5c4 1 5 5 5 9l1 13c0-8 3-11 7-9 2 1 3 4 3 8 0-7 4-9 7-6 2 2 2 5 3 8 1-5 5-6 8-2 3 5 1 13-3 19-3 6-7 10-15 10-8 0-12-4-18-9L11 38c-5-4-4-10 0-12 4-1 7 2 10 6z" fill="url(#white)" stroke="#B64A16" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 50q13 3 25-5l4 8q-13 11-29 8z" fill="url(#arrow)" stroke="#B64A16" stroke-width="2.4" stroke-linejoin="round"/><path d="M31 55q10 1 18-4" fill="none" stroke="#FFB36F" stroke-width="3" stroke-linecap="round"/>';
const spatula = '<g transform="rotate(-23 19 33)"><rect x="15" y="29" width="8" height="29" rx="4" fill="#78300F" stroke="#A14716" stroke-width="2"/><rect x="7" y="9" width="24" height="28" rx="6" fill="url(#arrow)" stroke="#C94B12" stroke-width="2.5"/><path d="M13 15v14m6-14v14m6-14v14" stroke="white" stroke-width="2.8" stroke-linecap="round"/></g>';
function image(body, size = 40) { return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 64 64">' + defs + '<g filter="url(#shadow)">' + body + '</g></svg>'; }
const assets = {
    'cursor-default': image(chef),
    'cursor-click': image('<g transform="translate(13 29) scale(.92) translate(-13 -29)">' + chef + rays + '</g>'),
    'cursor-text': image('<path d="M23 10h18M32 10v44M23 54h18" fill="none" stroke="white" stroke-width="9" stroke-linecap="round"/><path d="M23 10h18M32 10v44M23 54h18" fill="none" stroke="#C94B12" stroke-width="5.5" stroke-linecap="round"/><path d="M32 15v34" stroke="#FFB36F" stroke-width="1.8"/><circle cx="32" cy="32" r="1.8" fill="white"/>'),
    'cursor-pointer': image(hand),
    'cursor-drag': image(spatula + '<g transform="translate(17 12) scale(.72)">' + chef + '</g>'),
    'cursor-not-allowed': image(chef + '<circle cx="48" cy="48" r="12" fill="#EB3F20" stroke="#9C300F" stroke-width="2.3"/><path d="m42 42 12 12" stroke="white" stroke-width="4" stroke-linecap="round"/>'),
    'cursor-resize': image('<path d="m17 23-11 9 11 9M6 32h52m-11-9 11 9-11 9" fill="none" stroke="white" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/><path d="m17 23-11 9 11 9M6 32h52m-11-9 11 9-11 9" fill="none" stroke="#C94B12" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><path d="M13 32h38" stroke="#FFB36F" stroke-width="2" stroke-linecap="round"/>')
};
function loading(frame) { let dots = ''; for (let i = 0; i < 12; i++) { const angle = i * Math.PI / 6; dots += '<circle cx="' + (32 + 27 * Math.cos(angle)).toFixed(2) + '" cy="' + (32 + 27 * Math.sin(angle)).toFixed(2) + '" r="' + (i === frame ? 3.2 : 2.3) + '" fill="' + (i === frame ? '#FF6728' : '#FFB36F') + '" opacity="' + (i === frame ? '1' : '.6') + '"/>'; } return image(dots + '<g transform="translate(9 10) scale(.7)">' + chef + '</g>', 44); }
assets['cursor-loading'] = loading(0); for (let i = 0; i < 12; i++)assets['cursor-loading-' + i] = loading(i);
assets['cursor-resize-vertical'] = assets['cursor-resize'].replace('<g filter=', '<g transform="rotate(90 32 32)" filter='); assets['cursor-resize-diagonal'] = assets['cursor-resize'].replace('<g filter=', '<g transform="rotate(45 32 32)" filter=');

function sourceAsset(name, width, height, viewBox) {
    const source = fs.readFileSync(path.join(dir, name), 'utf8');
    const toned = source.replace('</defs>', '<filter id="cookhub-orange-tone" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="identity"/><feFuncG type="gamma" amplitude="1" exponent="2.5" offset="0"/><feFuncB type="gamma" amplitude="1" exponent="2.2" offset="0"/></feComponentTransfer></filter></defs><g filter="url(#cookhub-orange-tone)">').replace('</svg>', '</g></svg>');
    return toned.replace(/width="1920"/, 'width="' + width + '"').replace(/height="1080"/, 'height="' + height + '"').replace('viewBox="0 0 1440 809.999993"', 'viewBox="' + viewBox + '"');
}
assets['cursor-pointer'] = sourceAsset('cursor-hand-source.svg', 52, 46, '512.132812 223 415.5 364');
assets['cursor-default'] = sourceAsset('cursor-default-source.svg', 40, 40, '537 224 365.867188 362');
assets['cursor-click'] = sourceAsset('cursor-click-source.svg', 53, 48, '518 222.078125 404 365.921875');

function matchedLoading(frame) {
    let dots = '';
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const distance = (i - frame + 12) % 12; dots += '<circle cx="' + (32 + 28 * Math.cos(a)).toFixed(2) + '" cy="' + (32 + 28 * Math.sin(a)).toFixed(2) + '" r="' + (distance === 0 ? 3.2 : 2.4) + '" fill="#FF6925" opacity="' + (distance === 0 ? 1 : Math.max(.25, 1 - distance * .065).toFixed(2)) + '"/>'; }
    const normal = assets['cursor-default'].replace('<svg ', '<svg x="12" y="12" ');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' + dots + normal + '</svg>';
}
assets['cursor-loading'] = matchedLoading(0);
for (let i = 0; i < 12; i++)assets['cursor-loading-' + i] = matchedLoading(i);
assets['cursor-text'] = sourceAsset('cursor-text-source.svg', 33, 48, '596.269531 223.15625 247.5 363.75');
assets['cursor-drag'] = sourceAsset('cursor-drag-source.svg', 53, 48, '516.265625 222 407.25 366.558594');
for (const [name, svg] of Object.entries(assets)) fs.writeFileSync(path.join(dir, name + '.svg'), svg);
console.log('Generated ' + Object.keys(assets).length + ' cursors, preserving supplied default and hand artwork');
