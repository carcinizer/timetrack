import {withData, withDataAsync} from './data.js';
import {getPastResetDate, dayDuration} from './utils.js';
import {cls, createText, createButton, createDiv, createTextInput, createTable, timeText, hmsToTime} from './ui.js';


let table_root = document.getElementById("table_root");
let time_update_targets = {};


function listGroups() {
    clean();
    withData((data) => {
        let g = data.groups;

        createText(table_root, "h2", {}, "Groups:");

        createDiv(table_root, {}, (div) => {
            createTable(div, {}, g.length, 2, (r,l,c) => {
                if(c===0) { // Group settings
                    createButton(r, cls.rowmain(`${g[l].name}`), () => {listGroup(l)});
                }
                else if(c===1) { // Time
                    let t = createText(r, "span", cls.timestats, timeText(g[l]));
                    time_update_targets[l] = t;
                    return cls.time(g[l]);
                }
            });
            
            // Add new group
            createButton(div, cls.add, () => {
                withData((d) => {
                    addGroup(d, "New group", 60*60*1000);
                });
                listGroups();
            });
        });
    });
}



function listGroup(n) {
    clean();
    withData((data) => {
        let g = data.groups[n];

        showGroupTopLine(g,n);
        showGroupTimeLine(g,n);
        showGroupOptions(g,n);
        
        createText(table_root, "h3", {}, "Sites to track (domains):");

        showGroupSites(g,n);
    })
}

function showGroupTopLine(g,n) {
    createDiv(table_root, {className: "line"}, (div) => {
        // Back
        createButton(div, cls.back, () => {listGroups()});

        // Name
        createTextInput(div, cls.groupname(`${g.name}`), (name) => {
            withData((d) => {
                d.groups[n].name = name;
            });
        });
    });
}

function showGroupTimeLine(g,n) {
    createDiv(table_root, {className: "line"}, (div) => {

        let timetext = createText(div, "span", cls.timetext, "Limit: ")

        createTextInput(div, cls.timelimit(g.limit), (lim) => {
            withData((d) => {
                let newlimit = hmsToTime(lim, d.groups[n].limit);
                d.groups[n].limit = newlimit; 
                lim = newlimit;
            })
        });

    });
}

function showGroupOptions(g,n) {
    createDiv(table_root, {className: "line"}, (div) => {
        createDiv(div, {}, (div2) => {
            // Reset time
            createButton(div2, cls.resettime, () => {
                withData((d) => {d.groups[n].time = 0})
            })
            // Tooltip
            createButton(div2, cls.resettime_tooltip, () => {});
            
        })
        // Remove group
        createButton(div, cls.removegroup, () => {
            withData((d) => {removeGroup(d, n); listGroups()})
        });
    });
}

function showGroupSites(g,n) {
    
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
        let tab = await activeTab();

        await withDataAsync(async (d) => {
            let newSite = addSite(d, n, tab.url);
        });

        browser.runtime.sendMessage({type: "updateTimes"});

        listGroup(n, g.sites.length);
    })
}



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
    data.groups[group].sites.push({
        "url": url, 
        newly_added: true // required to not add time since before site entry creation
    });
}

function removeGroup(data, index) {
    data.groups.splice(index, 1);
}

function removeSite(data, group, index) {
    data.groups[group].sites.splice(index, 1);
}


listGroups();
updateTimes();
setInterval(updateTimes, 500);
