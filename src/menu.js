import {withData, withDataAsync} from './data.js';
import {getPastResetDate, dayDuration} from './utils.js';
import {cls, createText, createButton, createDiv, createTextInput, createTable, timeText, hmsToTime} from './ui.js';

async function activeTab() {
    let tab = (await browser.tabs.query({active: true, currentWindow: true}))[0];
    return {url: new URL(tab.url).hostname, id: tab.id};
}

function addGroup(data, name, limit) {
    if(!data.groups) {
        data.groups = [];
    }

    data.groups.push({
        "name": name, 
        "time": 0, 
        "limit": limit, 
        "reset": dayDuration,
        "reset_last": getPastResetDate(),
        "last_active": Date.now(),
        "sites": []
    });
}

function addSite(data, group, url) {
    data.groups[group].sites.push({"url": url});
}

function removeGroup(data, index) {
    data.groups.splice(index, 1);
}

function removeSite(data, group, index) {
    data.groups[group].sites.splice(index, 1);
}


// Main logic

let table_root = document.getElementById("table_root");
let time_update_targets = {};


function clean() {
    while(table_root.firstChild) {
        table_root.removeChild(table_root.lastChild);
    }
    time_update_targets = {};
}

async function updateTimes() {
    withDataAsync(async (data) => {

        browser.runtime.sendMessage({type: "updateTimes"});

        for (let k in time_update_targets) {
            time_update_targets[k].innerText = timeText(data.groups[k]);
            time_update_targets[k].className = cls.time(data.groups[k]).className;
        }
    });
}

function listGroup(n, editid) {
    clean();
    withData((data) => {
        let g = data.groups[n];

        createDiv(table_root, {className: "line"}, (div) => {
            createButton(div, cls.back, () => {listGroups()});
            createTextInput(div, cls.groupname(`${g.name}`), (name) => {
                withData((d) => {
                    d.groups[n].name = name;
                });
            });
        });

        createDiv(table_root, {className: "line"}, (div) => {
            let timetext = createText(div, "span", cls.timetext, "Limit: ")
            createTextInput(div, cls.timelimit(data.groups[n].limit), (lim) => {
                withData((d) => {
                    let newlimit = hmsToTime(lim, d.groups[n].limit);
                    d.groups[n].limit = newlimit; 
                    lim = newlimit;
                })
            });

        });

        createDiv(table_root, {className: "line"}, (div) => {
            createDiv(div, {}, (div2) => {
                createButton(div2, cls.resettime, () => {
                    withData((d) => {d.groups[n].time = 0})
                })
                let tooltip = createButton(div2, cls.resettime_tooltip, () => {});
                
            })
            createButton(div, cls.removegroup, () => {
                withData((d) => {removeGroup(d, n); listGroups()})
            });
        });
        
        createText(table_root, "h3", {}, "Sites to track (domains):");

        createTable(table_root, {}, g.sites.length, 2, (r,l,c) => {
            if(c===0) { // Domain
                createTextInput(r, cls.rowmain(g.sites[l].url), (url) => {
                    withData((d) => {
                        d.groups[n].sites[l].url = url;
                    });
                    listGroup(n, null);
                });
            }
            else if(c===1) { // Remove
                createButton(r, cls.remove, () => {
                    withData((d) => {
                        removeSite(d,n,l);
                    });
                    listGroup(n, null);
                })
            }
        });
        
        // Add new site
        createButton(table_root, cls.add, async () => {
            await withDataAsync(async (d) => {
                let tab = await activeTab();
                addSite(d, n, tab.url);
                browser.runtime.sendMessage({type: "addSite", skipTab: tab.id});
            });
            listGroup(n, g.sites.length);
        })
        
    });
}

function listGroups() {
    clean();
    withData((data) => {
        let g = data.groups;

        createText(table_root, "h2", {}, "Groups:");

        createDiv(table_root, {}, (div) => {
            createTable(div, {}, g.length, 2, (r,l,c) => {
                if(c===0) {
                    createButton(r, cls.rowmain(`${g[l].name}`), () => {listGroup(l)});
                }
                else if(c===1) {
                    let t = createText(r, "span", cls.timestats, timeText(g[l]));
                    time_update_targets[l] = t;
                    return cls.time(g[l]);
                }
            });

            createButton(div, cls.add, () => {
                withData((d) => {
                    addGroup(d, "New group", 60*60*1000);
                });
                listGroups();
            });
        });
    });
}

listGroups();
updateTimes();
setInterval(updateTimes, 500);
