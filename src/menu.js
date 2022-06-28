import {withData, newGroup} from './data.js';
import {getPastResetDate, dayDuration, matchers} from './utils.js';
import {
    cls, 
    createText,
    createButton, 
    createDiv,
    createTextInput,
    createTable,
    createSelect,
    createCheckbox,
    timeText,
    hmsToTime,
    timeToHms,
    addElements,
    button,
    textInput,
    div,
    span,
    h1,
    h3,
    checkbox,
    tooltip
} from './ui.js';


let table_root = document.getElementById("table_root");
let warning = document.getElementById("warning");
let periodic_actions = [];

let wantToExport = false;

function listGroups() {

    updateWarning();

    withData((data) => {
        clean();
        const go = data.group_order;

        addElements(table_root, [
            
            button(cls.about, aboutPage),
            button(cls.pause(data.paused), () => {
                browser.runtime.sendMessage({type: "switchPause", content: {}})
                    .then(listGroups);
            }),
            
            h1(['Groups:']),

            div('group-buttons', [
                ...go.map(gid => {
                    const g = data.groups[gid];

                    let timestatus = g.time > g.limit ? "expired" :
                                     g.time > g.limit * 0.9 ? "warn" : "ok";

                    let time_id = `time-${gid}`;
                    let progress_id = `progress-${gid}`;

                    let button_intetiors = [
                        span('group-name', [`${g.name}`]),
                        span({cls: ['group-time'], id: time_id}, [timeToHms(g.time)]),
                        //span('group-time-remaining', [(timestatus == 'expired' ? '+':'-') + timeToHms(Math.abs(g.limit - g.time))]),
                        span('group-limit', ['/' + timeToHms(g.limit)]),
                        span('group-extra-time', g.extra_time ? ['+'+timeToHms(g.extra_time)] : []),
                        div({
                            cls: ['group-progress', 'group-progress-' + timestatus], 
                            id: progress_id,
                            style: {width: `${Math.min(g.time / g.limit, 1) * 100}%`}
                        }, [])
                    ];

                    periodic_actions.push(data => {
                        const g = data.groups[gid];
                        document.getElementById(time_id).innerText = timeToHms(g.time);
                        document.getElementById(progress_id).style.width = `${Math.min(g.time / g.limit, 1) * 100}%`
                    })

                    return button({cls: ['group-button'], children: button_intetiors}, () => listGroup(gid));
                }),
                button({cls: ['group-button'], children: [
                    span('group-name', ['+']),
                    span('group-sub', ['Click to add'])
                ]}, addGroup)
            ]),
            

        ])

        /*createText(table_root, "h2", {}, "Groups:");
        createButton(table_root, cls.about, aboutPage)
        createButton(table_root, cls.pause(data.paused), () => {
            browser.runtime.sendMessage({type: "switchPause", content: {}})
                .then(listGroups);
        });

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
                addGroup();
            });
        });*/
    });
}



function listGroup(id, new_g) {

    updateWarning();

    withData((data) => {
        clean();
        let g = new_g ? new_g : data.groups[id];

        //showGroupTopLine(g,id);
        //showGroupTimeLine(g,id);
        //showGroupOptions(g,id);
        addElements(table_root, [
            ...groupTopLine(g,id),
            ...groupTimeLine(g,id),
            ...groupOptions(g,id)
        ])
        
        
        createText(table_root, "h3", {}, "Sites to track:");

        showGroupSites(g,id);
    })
}

function aboutPage() {
    clean();

    let manifest = browser.runtime.getManifest();

    addElements(table_root, [
        button(cls.back, listGroups),
        div('centered', [
            h1([manifest.name]),
            h3([`Version ${manifest.version}`]),
            
            div('aboutlinks', [
                {type: 'a', properties: {href: "https://github.com/carcinizer/timetrack"}, children: ["Github link"]}
            ]),
            
            

            div('line', [
                button(cls.text("Import data..."), () => {
                    browser.windows.create({
                        type: "detached_panel",
                        url: "/src/import.html",
                        width: 350,
                        height: 250
                    })
                }),

                button(cls.text("Export data..."), () => {
                    wantToExport = true;

                    checkPermissions(null, {wantToExport: wantToExport, humanReadable: true}).then(perm => {
                        if(perm == "") {
                            browser.runtime.sendMessage({type: "export", content: {}});
                        }
                        else {
                            updateWarning();
                        }
                    });
                }),

                button(cls.clean_data, () => {
                    let sending = browser.runtime.sendMessage({type: "cleanData", content: {}});
                    sending.then(() => {listGroups()});
                })
            ])
        ])

    ]);

    //createText(table_root, "h1", {}, `${manifest.name}`);
    //createText(table_root, "h3", {}, `Version ${manifest.version}`);
    
    /*createDiv(table_root, {className: "aboutlinks"}, div => {
        createText(div, "a", {href: "https://github.com/carcinizer/timetrack"}, "GitHub link")
    })

    createButton(table_root, {value: "Import data..."}, () => {
        browser.windows.create({
            type: "detached_panel",
            url: "/src/import.html",
            width: 350,
            height: 250
        })
    })

    createButton(table_root, {value: "Export data..."}, () => {
        wantToExport = true;

        checkPermissions(null, {wantToExport: wantToExport, humanReadable: true}).then(perm => {
            if(perm == "") {
                browser.runtime.sendMessage({type: "export", content: {}});
            }
            else {
                updateWarning();
            }
        });
    })

    createButton(table_root, cls.clean_data, () => {
        let sending = browser.runtime.sendMessage({type: "cleanData", content: {}});
        sending.then(() => {listGroups()});
    })*/
}

function groupTopLine(g,id) { return [
    div("line", [
        button(cls.back, listGroups),
        textInput({cls: ['groupname']}, valueFromGroup(g,id,'name'))
    ])
    //createDiv(table_root, {className: "line"}, (div) => {
        // Back
        //createButton(div, cls.back, listGroups);

        // Name
        //createTextInput(div, cls.groupname(`${g.name}`), (name) => {
        //    withGroup(id, g => {g.name = name})
        //});
    //});
]}

function groupTimeLine(g,id) { return [
    div('line', [
        "Limit: ",
        textInput({}, {
            value: timeToHms(g.limit),
            setter: lim => withGroup(id, g => {

                let newlimit = hmsToTime(lim, g.limit);
                g.limit = newlimit; 
                lim = newlimit;

            })
        })
    ])
    
    /*
    createDiv(table_root, {className: "line"}, (div) => {

        let timetext = createText(div, "span", cls.timetext, "Limit: ")

        createTextInput(div, cls.timelimit(g.limit), (lim) => {
            withGroup(id, g => {
                let newlimit = hmsToTime(lim, g.limit);
                g.limit = newlimit; 
                lim = newlimit;
            })
        });

    });*/
]}

function groupOptions(g,id) { return [
    /*createDiv(table_root, {className: "line"}, (div) => {
        createDiv(div, {}, (div2) => {
            // Reset time
            createButton(div2, cls.resettime, () => {
                browser.runtime.sendMessage({type: "reset", content: {id: id}});
            })
            // Tooltip
            createButton(div2, cls.tooltip("Automatic reset occurs every day on 4:00 AM, by subtracting the limit from total time."), () => {});
            
        })
        // Remove group
        createButton(div, cls.removegroup, () => {
            removeGroup(id);
        });
    });

    createCheckbox(table_root, "Block after timeout", {checked: g.block_after_timeout}, 
        (state) => {withGroup(id, g => {
            g.block_after_timeout = state;
    })});*/

    div('line', [
        div('line', [
            button(cls.resettime, () => 
                browser.runtime.sendMessage({type: 'reset', content: {id: id}})
            ),
            tooltip("Automatic rewind occurs every day on 4:00 AM, by subtracting the limit from total time."),
        ]),

        button(cls.removegroup, () => {removeGroup(id)})
    ]),
    checkbox({}, "Block after timeout", valueFromGroup(g,id, 'block_after_timeout'))
]}

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
    periodic_actions = [];
}

function valueFromGroup(g, id, name) {
    return {
        value: g[name],
        setter(x) {
            withGroup(id, g => {g[name] = x})
        }
    }
}

function updateTimes() {

    let sending = browser.runtime.sendMessage({type: "updateTimes"});
    sending.then(() => {
        withData(data => {
        for (let k of periodic_actions) {
            //time_update_targets[k].innerText = timeText(data.groups[k]);
            //time_update_targets[k].className = cls.time(data.groups[k]).className;
            k(data);
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

function addGroup() {
    let id = Date.now();
    let group = newGroup();
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

async function checkPermissions(data, {wantToExport, humanReadable}) {
    let reason = [];
    let cont = {permissions: []};

    if(wantToExport && !(await browser.permissions.contains({permissions: ["downloads"]}))) {
        reason.push("Exporting requires downloads access permissions");
        cont.permissions.push("downloads");
    }

    if(!data) {
        return humanReadable ? reason.join('\n') : cont;
    }

    let url_perm = await browser.permissions.contains({origins: ["<all_urls>"]});

    if(!url_perm) {
        for(let gid of data.group_order) {
            const group = data.groups[gid];
            if(group.block_after_timeout) {
                reason.push(`Group '${group.name}' requires site access permissions in order to display a time-out pop-up`);
                cont.origins = ["<all_urls>"];
            }
        }
    };

    return humanReadable ? reason.join('\n') : cont;
}

function updateWarning() {
    while(warning.firstChild) {
        warning.removeChild(warning.lastChild);
    }
    warning.hidden = true;

    withData(data => {
        checkPermissions(data, {humanReadable: true, wantToExport: wantToExport}).then(reason => {
            if(reason != "") {
                createText(warning, 'span', {}, "⚠️ Permissions ");
                createButton(warning, cls.tooltip(`Permissions required: ${reason}`), () => {})

                checkPermissions(data, {wantToExport: wantToExport}).then(perms => {

                    createButton(warning, {value: "Grant"}, () => {
                        browser.permissions.request(perms);
                    })

                });
                warning.hidden = false;
            }
        })
    })
}



listGroups();
updateTimes();
setInterval(updateTimes, 500);
