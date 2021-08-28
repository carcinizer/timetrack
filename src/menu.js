import {withData, withDataAsync} from './data.js';

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
        "reset": 24*60*60*1000, // 24 hours
        "reset_last": Date.now(),
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

function timeToHms(time) {
    let hours = Math.floor(time / 3600000);
    let minutes = Math.floor((time / 60000) % 60);
    let seconds = Math.floor((time / 1000) % 60);
    let m0 = minutes > 9 ? "" : "0";
    let s0 = seconds > 9 ? "" : "0";
    return `${hours}:${m0}${minutes}:${s0}${seconds}`;
}

function hmsToTime(hms, fallback) {
    let str = hms.split(":")
    let h = Number(str[0]);
    let m = Number(str[1]);
    let s = Number(str[2]);
    return h+m+s === NaN ? fallback : s*1000+m*60000+h*3600000;
}

let table_root = document.getElementById("table_root");
let time_update_targets = {};

// Common classes/values for widgets
const cls = {
    back: {
        value: "<-",
        className: "back"
    },
    
    remove: {
        value: "-",
        className: "remove"
    },

    removegroup: {
        value: "Remove group",
        className: "removegroup"
    },

    add: {
        value: "+",
        className: "add"
    },

    groupname: (name) => {return {
        value: name,
        className: "groupname"
    }},

    rowmain: (name) => {return {
        value: name,
        className: "rowmain"
    }},

    time: (group) => {
        let s = group.time > group.limit ? "timeexpired"
              : group.time > group.limit * 0.9 ? "timewarn"
              : "timeok";
        return {className: s}
    },

    timelimit: (time) => {return {
        value: timeToHms(time),
        className: "timelimit"
    }},

    resettime: {
        value: "Reset time",
        className: "resettime"
    }
}

function timeText(group) {
    return `${timeToHms(group.time)}/${timeToHms(group.limit)}`;
}

// UI utilities

// Create text with a given tag
function createText(root, tag, properties, text) {
    let node = document.createElement(tag);
    for (let k in properties) {
        node[k] = properties[k];
    }
    node.innerText = text;
    root.append(node);
    return node;
}

// Create button with f(node) being called on click
function createButton(root, properties, f) {

    let node = document.createElement('input');
    node.type = "button";
    node.class = "button";

    node.onclick = () => f(node);
    root.append(node);

    for (let k in properties) {
        node[k] = properties[k];
    }

    return node;
}

// Create text input. The f(value) function should return a parsed value
function createTextInput(root, properties, f) {
    
    let input = document.createElement('input');

    input.type = "text";
    input.onchange = () => {
        f(input.value);
    }
    
    for (let k in properties) {
        input[k] = properties[k];
    }

    root.append(input);
    return input;
}

function createDiv(root, properties, f) {
    let div = document.createElement('table');
    for (let k in properties) {
        div[k] = properties[k];
    }
    f(div);
    root.append(div);
    return div;
}

// Create table with elements listed in columns, generated with function f(root, line, column) -> optional item_properties
function createTable(root, properties, lines, columns, f) {

    let table = document.createElement('table');    

    for (let l = 0 ; l < lines; l++) {
        let tr = document.createElement('tr');
        for (let c = 0; c < columns; c++) {
            let td = document.createElement('td');

            // Create child and apply properties to
            let prop = f(td,l,c);
            for (let k in prop) {
                td[k] = prop[k];
            }
            tr.append(td);
        }
        table.append(tr);
    }
    
    for (let k in properties) {
        table[k] = properties[k];
    }
    root.append(table);
    return table;
}

// Main logic

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

        createButton(table_root, cls.back, () => {listGroups()});
        createTextInput(table_root, cls.groupname(`${g.name}`), (name) => {
            withData((d) => {
                d.groups[n].name = name;
            });
        });

        createDiv(table_root, {}, (div) => {
            let timetext = createText(div, "span", {}, "Limit: ")
            createTextInput(timetext, cls.timelimit(data.groups[n].limit), (lim) => {
                withData((d) => {
                    let newlimit = hmsToTime(lim, d.groups[n].limit);
                    d.groups[n].limit = newlimit; 
                    lim = newlimit;
                })
            });
            createButton(div, cls.resettime, () => {
                withData((d) => {d.groups[n].time = 0})
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
                    let t = createText(r, "span", {}, timeText(g[l]));
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
