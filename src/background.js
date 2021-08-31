import {withDataAsync} from './data.js';

const icon_canvas = document.getElementById('icon-canvas');
const icon_ctx = icon_canvas.getContext('2d');

// Icon

function createRadialGradient(ctx, inner, outer) {
    let g = ctx.createRadialGradient(16,16, 13, 16,16, 15);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    return g;
}

const gradient_ok_fg = createRadialGradient(icon_ctx, '#1cec52', '#28de57');
const gradient_ok_bg = createRadialGradient(icon_ctx, '#1f8139', '#1a6f30');
const gradient_warn_fg = createRadialGradient(icon_ctx, '#f3ea59', '#c1ba49');
const gradient_warn_bg = createRadialGradient(icon_ctx, '#757b47', '#646840');
const gradient_expired_fg = createRadialGradient(icon_ctx, '#ef4334', '#d44434');
const gradient_expired_bg = createRadialGradient(icon_ctx, '#833f38', '#76322c');

function getGradient(frac) {
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

function drawSolidArc(ctx, begin, end, counterclockwise) {
    
    ctx.beginPath();
    ctx.arc(16,16, 15, begin, end, counterclockwise);
    ctx.arc(16,16, 13, end, begin, !counterclockwise);
    ctx.closePath();
    ctx.fill();
}

function updateIcon(timefraction) {

    let tf = timefraction;
    tf = tf && tf > 0 ? tf : 0.00001;
    tf = tf < 1       ? tf : 0.99999;

    icon_ctx.clearRect(0,0,32,32);
    let begin = 3/2 * Math.PI;
    let end = (3/2 + 2*tf) * Math.PI;

    let gradients = getGradient(timefraction);

    icon_ctx.fillStyle = gradients.fg;
    drawSolidArc(icon_ctx, begin, end, false);
    icon_ctx.fillStyle = gradients.bg;
    drawSolidArc(icon_ctx, begin, end, true);
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

    for(let group of data.groups) {

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
                group.last_active = Date.now();
            }
        }

        // Cyclic reset
        if(Date.now() > group.reset_last + group.reset) {
            ro = 0;
            group.reset_last = Date.now();
            group.time = Math.max(0, group.time - group.limit);
        }
    }

    return ro;
}

browser.tabs.query({active: true}).then((acttabs) => {

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


    function checkTabActivated(info) {

        withDataAsync(async (data) => {
            
            let o = false;
            if(info.previousTabId != undefined) {
                o = await browser.tabs.get(info.previousTabId);
            }
            let n = await browser.tabs.get(info.tabId);

            activeTabs.delete(info.previousTabId);
            activeTabs.set(info.tabId, n.url);
            
            return changeActive(data, o.url, n.url);
        });
    }

    function checkTabUpdated(tabId, changeInfo, tab) {
        
        withDataAsync(async (data) => {
            if(changeInfo.url) {
                let url = changeInfo.url;

                let ret = changeActive(data, activeTabs[tabId], url);
                activeTabs.set(tabId, url);
                return ret;
            }
        });
    }

    async function updateTimes(data) {
        let ro = 1;

        for (let k of activeTabs.keys()) {
            let tab = await browser.tabs.get(k);
            ro = changeActive(data, tab.url, tab.url);
        }

        let maxfrac = 0;
        for (let g of data.groups) {
            maxfrac = Math.max(maxfrac, g.time / g.limit);
        }

        updateIcon(maxfrac);

        return ro;
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
                    ro = Math.min(ro, changeActive(data, oldurl, tab.url));
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
