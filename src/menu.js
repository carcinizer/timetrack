import {withData, newGroup} from './data.js';
import {getPastResetDate, dayDuration, matchers, match_items} from './utils.js';
import {
    cls, 
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
    tooltip,
    select
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
    });
}



function listGroup(id, new_g) {

    updateWarning();

    withData((data) => {
        clean();
        let g = new_g ? new_g : data.groups[id];

        addElements(table_root, [
            ...groupTopLine(g,id),
            ...groupTimeLine(g,id),
            ...groupOptions(g,id),
            h3(["Sites to track:"]),
            ...groupSites(g,id)
        ])
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
}

function groupTopLine(g,id) { return [
    div("line", [
        button(cls.back, listGroups),
        textInput({cls: ['groupname']}, valueFromGroup(g,id,'name'))
    ])
]}

function groupTimeLine(g,id) { return [
    div('line', [
        "Limit: ",
        textInput({cls: ['timelimit']}, {
            value: timeToHms(g.limit),
            setter: lim => withGroup(id, g => {

                let newlimit = hmsToTime(lim, g.limit);
                g.limit = newlimit; 
                lim = newlimit;

            })
        })
    ])
]}

function groupOptions(g,id) { return [
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

function groupSites(g,id) { return [

    ...g.site_order.map(sid => groupSite(g,id,g.sites[sid],sid)),
    button(cls.add_site(), async () => {
        withActiveTab(tab => {
            withGroup(id, g => {
                addSite(g, tab.url);
            });
        });
    }) 
]}


let sitesShown = new Set();

function groupSite(g,id,site,sid) {

    let method_select = select({}, matchers.method(site.item), valueFromSite(g,id,sid, 'method'));
    let show_methods = match_items[site.item].show_methods;
    let div_id = `site-${sid}`;

    return div({cls: ['site-to-track', ...(sitesShown.has(sid) ? [] : ['site-hidden'])], id: div_id}, [
        button(
            {
                cls: ['site-button', 'line-full'], 
                children: [div('line-full', [
                    span('site-caption', match_items[site.item].description(site)),
                    span({cls: ['site-on-show', 'dimmed']},[`▲`]),
                    span({cls: ['site-on-hide', 'dimmed']},[`▼`])
                ])]
            }, 
            () => {
                let div = document.getElementById(div_id);
                if(div.classList.toggle('site-hidden')) {
                    sitesShown.delete(sid);
                }
                else {
                    sitesShown.add(sid);
                }
        }),
        div({cls: ['site-on-show', 'site-options']}, [
            div('line-full', [div({},[
                select({}, matchers.item, valueFromSite(g,id,sid, 'item', ensureExistingMethod)),
                ...(show_methods ? [method_select] : [div({},[])])
            ])]),
            div('line-full', [
                ...(show_methods ? [textInput(
                    cls.site_data(match_items[site.item].show_methods), 
                    valueFromSite(g,id,sid, 'data')
                )] : [div({},[])]),
                button(cls.remove, () => 
                    withGroup(id,g => {removeSite(g,sid)})
                )
            ])
        ])
    ])
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

function valueFromSite(g, id, sid, name, f) {
    return {
        value: g.sites[sid][name],
        setter(x) {
            withGroup(id, g => {
                g.sites[sid][name] = x
                if(f) f(g.sites[sid])
            })
        }
    }
}

function updateTimes() {

    let sending = browser.runtime.sendMessage({type: "updateTimes"});
    sending.then(() => {
        withData(data => {
        for (let k of periodic_actions) {
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
        item: "domain",
        method: "has",
        data: string
    };
    group.site_order.push(id);
}

function ensureExistingMethod(site) {
    if(!(site.method in matchers.method(site.item))) {
        for(let i in matchers.method(site.item)) {
            site.method = i; break;
        }
    }
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
                checkPermissions(data, {wantToExport: wantToExport}).then(perms => {
                    addElements(warning, div('line', [
                        span(["⚠️ Permissions "]),
                        tooltip(`Permissions required: ${reason}`),
                        button({children: ['Grant']}, () => {
                            browser.permissions.request(perms);
                        })
                    ]))
                });
                warning.hidden = false;
            }
        })
    })
}



listGroups();
updateTimes();
setInterval(updateTimes, 500);
