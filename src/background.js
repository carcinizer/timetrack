import {withDataAsync} from './data.js';
import {getPastResetDate} from './utils.js';

// Icon

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

function getGradient(frac, active) {
    if(frac > 1.0) {
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

function drawProgressCircle(timefraction, colortf, active, radius_outer, radius_inner) {

    // clamp fractions for correct rendering
    let tf = timefraction;
    tf = tf && tf > 0 ? tf : 0.00001;
    tf = tf < 1       ? tf : 0.99999;

    let begin = 3/2 * Math.PI;
    let end = (3/2 + 2*tf) * Math.PI;

    let gradients = getGradient(colortf, active);

    icon_ctx.fillStyle = gradients.fg;
    drawSolidArc(icon_ctx, begin, end, false, radius_outer, radius_inner);
    icon_ctx.fillStyle = gradients.bg;
    drawSolidArc(icon_ctx, begin, end, true, radius_outer, radius_inner);
}

function updateIcon(timefraction_max, max_active, timefraction_current, active) {

    icon_ctx.clearRect(0,0,32,32);
    
    drawProgressCircle(timefraction_max, timefraction_max, max_active, 15, active ? 12 : 10);
    if(active) {
        drawProgressCircle(timefraction_current, timefraction_max, true, 7, 10);
    }

    browser.browserAction.setIcon({imageData: icon_ctx.getImageData(0,0,32,32)});
}


// Tab monitoring

function match(url) {
    return (req) => {
        try {
            return url.length > 0 && new URL(url).hostname.includes(req.url);
        }
        catch {
            return false;
        }
    }
}

function changeActive(data, oldurl, newurl) {

    let ro = 1;
    let active = false;
    let activefrac = 0;
    let activegroups = new Set();

    for(let groupid in data.groups) {
        let group = data.groups[groupid];

        // Deactivate old, add time elapsed
        if(oldurl) {
            let found = group.sites.find(match(oldurl));
            if(found) {
                ro = 0;
                group.time += Date.now() - group.last_active;
            }
        }

        // Activate new, count from now on
        if(newurl) {
            let found = group.sites.find(match(newurl));
            if(found) {
                ro = 0;
                
                active = true;
                activefrac = Math.max(activefrac, group.time / group.limit);
                activegroups.add(groupid);

                group.last_active = Date.now();
            }
        }

        // Cyclic reset
        if(Date.now() > group.reset_last + group.reset) {
            ro = 0;
            group.reset_last = getPastResetDate();
            group.time = Math.max(0, group.time - group.limit);
        }
    }

    return {ro: ro, active: active, activefrac: activefrac, activegroups: activegroups};
}

browser.tabs.query({active: true}).then((acttabs) => {

    // Initialize

    let activeTabs = new Map();
    for (let i of acttabs) {
        activeTabs.set(i.id, i.url);
    }

    withDataAsync(async (d) => {
        for (let i of acttabs) {
            changeActive(d, false, i.url)
        }
        updateTimes(d);
    })


    async function updateTimes(data) {
        let ro = 1;
        let active = false;
        let max_active = false;
        let activefrac = 0;
        let activegroups = new Set();

        for (let k of activeTabs.keys()) {
            let tab = await browser.tabs.get(k);
            let info = changeActive(data, tab.url, tab.url);

            if(info.active) {
                active = true;
                activefrac = Math.max(activefrac, info.activefrac);
                for(let i of info.activegroups) {
                    activegroups.add(i);
                }
            }
            ro = Math.min(ro, active.ro);
        }

        let maxfrac = 0;

        for (let gid in data.groups) {
            let g = data.groups[gid];

            maxfrac = Math.max(maxfrac, g.time / g.limit);
            max_active |= activegroups.has(gid);
        }

        updateIcon(maxfrac, max_active, activefrac, active);

        return ro;
    }


    function checkTabActivated(info) {

        withDataAsync(async (data) => {
            
            let o = false;
            if(info.previousTabId != undefined) {
                o = await browser.tabs.get(info.previousTabId);
            }
            let n = await browser.tabs.get(info.tabId);

            activeTabs.delete(info.previousTabId);
            activeTabs.set(info.tabId, n.url);
            
            let ro = changeActive(data, o.url, n.url).ro;
            return Math.min(ro, await updateTimes(data));
        });
    }

    function checkTabUpdated(tabId, changeInfo, tab) {
        
        withDataAsync(async (data) => {
            if(changeInfo.url) {
                let url = changeInfo.url;

                let ro = changeActive(data, activeTabs[tabId], url).ro;
                activeTabs.set(tabId, url);

                ro = Math.min(ro, await updateTimes(data));
                return ro;
            }
        });
    }

    function checkTabMessage(message) {
        withDataAsync(async (data) => {
            if(message.type === "addSite") {
                let ro = 1;
                for (let k of activeTabs.keys()) {

                    let tab = await browser.tabs.get(k);
                    let oldurl = tab.url;
                    if(message.skipTab === k) {
                        oldurl = false;
                    }
                    ro = Math.min(ro, changeActive(data, oldurl, tab.url).ro);
                }
                return ro;
            }
            else if(message.type === "updateTimes") {
                return await updateTimes(data);
            }
            else {
                console.error(`Unknown message ${message.type}`)
            }
        })
    }

    browser.tabs.onActivated.addListener(checkTabActivated);
    browser.tabs.onUpdated.addListener(checkTabUpdated);
    browser.runtime.onMessage.addListener(checkTabMessage);

    browser.tabs.onRemoved.addListener((id) => activeTabs.delete(id));
    // TODO smarter interval
    setInterval(() => {withDataAsync(async (d) => {return await updateTimes(d)})}, 30000);
});
