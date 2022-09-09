
const icon_canvas = document.getElementById('icon-canvas');
const icon_ctx = icon_canvas.getContext('2d');

function createRadialGradient(ctx, inner, outer) {
    let g = ctx.createRadialGradient(16,16, 11, 16,16, 15);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    return g;
}

const gradient_ok_fg = createRadialGradient(icon_ctx, '#1cec52', '#28de57');
const gradient_ok_bg = createRadialGradient(icon_ctx, '#1f8139', '#1a6f30');
const gradient_inactive_fg = createRadialGradient(icon_ctx, '#0ec9cd', '#31abad');
const gradient_inactive_bg = createRadialGradient(icon_ctx, '#457d7e', '#356668');
const gradient_warn_fg = createRadialGradient(icon_ctx, '#f3ea59', '#c1ba49');
const gradient_warn_bg = createRadialGradient(icon_ctx, '#757b47', '#646840');
const gradient_expired_fg = createRadialGradient(icon_ctx, '#ef4334', '#d44434');
const gradient_expired_bg = createRadialGradient(icon_ctx, '#833f38', '#76322c');

function getGradient(frac, paused) {
    if(paused) {
        return {fg: gradient_inactive_fg, bg: gradient_inactive_bg}
    }
    else if(frac > 1.0) {
        return {fg: gradient_expired_fg, bg: gradient_expired_bg}
    }
    else if(frac > 0.9) {
        return {fg: gradient_warn_fg, bg: gradient_warn_bg}
    }
    else {
        return {fg: gradient_ok_fg, bg: gradient_ok_bg}
    }
}

function drawSolidArc(ctx, begin, end, counterclockwise, radius_outer, radius_inner) {
    
    ctx.beginPath();
    ctx.arc(16,16, radius_outer, begin, end, counterclockwise);
    ctx.arc(16,16, radius_inner, end, begin, !counterclockwise);
    ctx.closePath();
    ctx.fill();
}

function drawProgressCircle(timefraction, colortf, paused, radius_outer, radius_inner) {

    // clamp fractions for correct rendering
    let tf = timefraction;
    tf = tf && tf > 0 ? tf : 0.00001;
    tf = tf < 1       ? tf : 0.99999;

    let begin = 3/2 * Math.PI;
    let end = (3/2 + 2*tf) * Math.PI;

    let gradients = getGradient(colortf, paused);

    icon_ctx.fillStyle = gradients.fg;
    drawSolidArc(icon_ctx, begin, end, false, radius_outer, radius_inner);
    icon_ctx.fillStyle = gradients.bg;
    drawSolidArc(icon_ctx, begin, end, true, radius_outer, radius_inner);
}

function updateIcon(timefraction_current, timefraction_max, paused) {

    let active = timefraction_current != null && !paused;
    icon_ctx.clearRect(0,0,32,32);
    
    drawProgressCircle(timefraction_max, timefraction_max, paused, 15, active ? 12 : 10);
    if(active) {
        drawProgressCircle(timefraction_current, timefraction_max, paused, 7, 10);
    }

    browser.browserAction.setIcon({imageData: icon_ctx.getImageData(0,0,32,32)});
}

export {updateIcon}
