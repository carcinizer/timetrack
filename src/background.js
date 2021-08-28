import {withDataAsync} from './data.js';


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
                
                let ro = 1;

                for (let k of activeTabs.keys()) {
                    let tab = await browser.tabs.get(k);
                    ro = changeActive(data, tab.url, tab.url);
                }

                return ro;
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

});
