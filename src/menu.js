import {withData} from './data.js';
import {getPastResetDate, dayDuration, matchers} from './utils.js';
import {cls, createText, createButton, createDiv, createTextInput, createTable, createSelect, timeText, hmsToTime} from './ui.js';


let table_root = document.getElementById("table_root");
let time_update_targets = {};


function listGroups() {
    withData((data) => {
        clean();
        const g = data.groups;
        const go = data.group_order;

        createText(table_root, "h2", {}, "Groups:");

        createDiv(table_root, {}, (div) => {
            createTable(div, {}, go.length, 2, (r,l,c) => {
                const group = data.groups[go[l]];
                if(c===0) { // Group settings
                    createButton(r, cls.rowmain(`${group.name}`), () => {listGroup(go[l])});
                }
                else if(c===1) { // Time
                    let t = createText(r, "span", cls.timestats, timeText(group));
                    time_update_targets[go[l]] = t;
                    return cls.time(group);
                }
            });
            
            // Add new group
            createButton(div, cls.add, () => {
                addGroup("New group", 60*60*1000);
            });
        });
    });
}



function listGroup(id, new_g) {
    withData((data) => {
        clean();
        let g = new_g ? new_g : data.groups[id];

        showGroupTopLine(g,id);
        showGroupTimeLine(g,id);
        showGroupOptions(g,id);
        
        createText(table_root, "h3", {}, "Sites to track:");

        showGroupSites(g,id);
    })
}

function showGroupTopLine(g,id) {
    createDiv(table_root, {className: "line"}, (div) => {
        // Back
        createButton(div, cls.back, () => {listGroups()});

        // Name
        createTextInput(div, cls.groupname(`${g.name}`), (name) => {
            withGroup(id, g => {g.name = name})
        });
    });
}

function showGroupTimeLine(g,id) {
    createDiv(table_root, {className: "line"}, (div) => {

        let timetext = createText(div, "span", cls.timetext, "Limit: ")

        createTextInput(div, cls.timelimit(g.limit), (lim) => {
            withGroup(id, g => {
                let newlimit = hmsToTime(lim, g.limit);
                g.limit = newlimit; 
                lim = newlimit;
            })
        });

    });
}

function showGroupOptions(g,id) {
    createDiv(table_root, {className: "line"}, (div) => {
        createDiv(div, {}, (div2) => {
            // Reset time
            createButton(div2, cls.resettime, () => {
                // TODO - reset
                //withGroup(g => {g.time = 0})
            })
            // Tooltip
            createButton(div2, cls.resettime_tooltip, () => {});
            
        })
        // Remove group
        createButton(div, cls.removegroup, () => {
            removeGroup(id);
        });
    });
}

function showGroupSites(g,id) {
    
    let matchersnames = {};
    for (let m in matchers) {
        matchersnames[m] = matchers[m].name;
    }

    createTable(table_root, {}, g.site_order.length, 3, (r,l,c) => {

        let sid = g.site_order[l];

        if(c===0) { // Type
            createSelect(r, {}, 
                g.sites[sid].method, 
                matchersnames,
                i => {withGroup(id, g => {
                    g.sites[sid].method = i;
                })}
            );
        }
        else if(c===1) { // Domain
            let uclass = cls.rowmain(g.sites[sid].data)

            if( !matchers[g.sites[sid].method].has_url ) {
                uclass.disabled = true;
            }

            createTextInput(r, uclass, (url) => {
                withGroup(id, g => {
                    g.sites[sid].data = url;
                });
            });
        }
        else if(c===2) { // Remove
            createButton(r, cls.remove, () => {
                withGroup(id, g => {removeSite(g,sid);});
            })
        }
    });
    
    // Add new site
    createButton(table_root, cls.add, async () => {
        withActiveTab(tab => {
            withGroup(id, g => {
                addSite(g, tab.url);
            });
        });
    })
}



function clean() {
    while(table_root.firstChild) {
        table_root.removeChild(table_root.lastChild);
    }
    time_update_targets = {};
}

function updateTimes() {

    let sending = browser.runtime.sendMessage({type: "updateTimes"});
    sending.then(() => {
        withData(data => {
        for (let k in time_update_targets) {
            time_update_targets[k].innerText = timeText(data.groups[k]);
            time_update_targets[k].className = cls.time(data.groups[k]).className;
        }});
    });
}



function withActiveTab(f) {
    let promise = browser.tabs.query({active: true, currentWindow: true});
    promise.then(tabs => {
        let tab = tabs[0]
        let url = new URL(tab.url).hostname || "about:";
        f({url, id: tab.id})
    });
}

function addGroup(name, limit) {
    let id = Date.now();
    let group = {
        name: name, 
        sites: {},
        site_order: [],
        time: 0, 
        limit: limit, 
    };
    updateGroup(id, group, () => {listGroup(id, group)});
}

function withGroup(id, callback, after_opt) {
    withData((data) => {
        callback(data.groups[id]);
        updateGroup(id, data.groups[id], after_opt ? after_opt : () => {listGroup(id)});
    });
}

function updateGroup(id, groupdata, callback_after) {
    let sending = browser.runtime.sendMessage({type: "updateGroupSettings", content: {id: id, groupdata: groupdata}});
    sending.then(() => {callback_after()})
}


function addSite(group, string) {
    let id = Date.now()
    group.sites[id] = {
        method: "domain_has",
        data: string
    };
    group.site_order.push(id);
}

function removeGroup(id) {
    let sending = browser.runtime.sendMessage({type: "removeGroup", content: {id: id}});
    sending.then(listGroups)
}

function removeSite(group, id) {
    delete group.sites[id];
    group.site_order = group.site_order.filter(x=>x!=id);
}


listGroups();
updateTimes();
setInterval(updateTimes, 500);
