import {withData, newGroup, newSite} from './data.js';
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
    select,
    dropTarget
} from './ui.js';



let table_root = document.getElementById("table_root");
let warning = document.getElementById("warning");
let periodic_actions = [];

let wantToExport = false;

const TimeHMSConvert = {fromWidget: hmsToTime, toWidget: timeToHms}

function listGroups() {

    updateWarning();

    dragging_function = (old_no, new_no) => {
        browser.runtime.sendMessage({type: "moveGroup", content: {old_no: old_no, new_no: new_no}})
            .then(listGroups);
    }

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
                ...go.map((gid, n) => {
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
                        }, []),
                        div('drag-target-dummy', []),
                        div('drag-indicator-left', ['☰']),
                        div('drag-indicator-right', ['☰'])
                    ];

                    periodic_actions.push(data => {
                        const g = data.groups[gid];
                        document.getElementById(time_id).innerText = timeToHms(g.time);
                        document.getElementById(progress_id).style.width = `${Math.min(g.time / g.limit, 1) * 100}%`
                    })

                    return [
                        dropTarget(n),
                        button({
                            cls: ['group-button', ...(g.active_now ? ['group-active'] : [])], 
                            properties: {draggable: true, drag_no: n}, 
                            children: button_intetiors
                        }, () => listGroup(gid)),
                    ];
                }),
                dropTarget(go.length),
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

        dragging_function = (old_no, new_no) => {
            browser.runtime.sendMessage({type: "moveSite", content: {gid: id, old_no: old_no, new_no: new_no}})
                .then(() => listGroup(id));
        }

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
    div('centered', [div('line', [
        span({}, [   
            span('small-margin', ['Limit:']),
            textInput({cls: ['time-input']}, valueFromGroup(g,id,'limit', TimeHMSConvert)),
        ]),
        span({}, g.block_after_timeout ? [
            span('small-margin', ['Max extra time:']),
            textInput({cls: ['time-input']}, valueFromGroup(g,id,'max_extra_time', TimeHMSConvert))
        ]: [])
    ])])
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
    checkbox({}, "Don't track tabs in unfocused windows", valueFromGroup(g,id, 'dont_track_unfocused_window')),
    checkbox({}, "Track active tabs", valueFromGroup(g,id, 'track_active')),
    checkbox({}, "Track playing tabs", valueFromGroup(g,id, 'track_playing')),
    div('same-line', [
    checkbox({}, "Block after timeout", valueFromGroup(g,id, 'block_after_timeout')),
    tooltip("When time's up, depending on tracking settings for active/playing tab, displays a blocking pop-up and/or mutes playing tabs"),
    ]),
]}

function groupSites(g,id) { return [

    g.site_order.map((sid,n) => [dropTarget(n), groupSite(g,id,g.sites[sid],sid,n)]),
    dropTarget(g.site_order.length),
    button(cls.add_site(), async () => {
        withActiveTab(tab => {
            withGroup(id, g => {
                addSite(g, tab.url);
            });
        });
    }) 
]}


let sitesShown = new Set();

function groupSite(g,id,site,sid,n) {

    let item = match_items[site.item];
    let div_id = `site-${sid}`;

    return div({cls: ['site-to-track', ...(sitesShown.has(sid) ? [] : ['site-hidden'])], id: div_id}, [
        button(
            {
                cls: ['site-button', 'line-full'], 
                properties: {draggable: true, drag_no: n},
                children: [
                    div('line-full', [
                        span('site-caption', item.description(site)),
                        span({cls: ['site-on-show', 'dimmed']},[`▲`]),
                        span({cls: ['site-on-hide', 'dimmed']},[`▼`])
                    ]),
                    div('drag-target-dummy', []),
                    div('drag-indicator-left', ['☰']),
                    div('drag-indicator-right', ['☰'])
                ]
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
        div({cls: ['site-on-show', 'site-options']}, item.configuration(
            site,
            {
                getsetValue: (val, f) => valueFromSite(g,id,sid, val, f),
                removeSiteFunc: () => withGroup(id, g => removeSite(g,sid)),
            })
        )
    ])
}


function clean() {
    while(table_root.firstChild) {
        table_root.removeChild(table_root.lastChild);
    }
    periodic_actions = [];
}

function valueFromGroup(g, id, name, funcs={fromWidget: x=>x, toWidget: x=>x}) {
    return {
        value: funcs.toWidget(g[name]),
        setter(x) {
            withGroup(id, g => {g[name] = funcs.fromWidget(x)})
        }
    }
}

function valueFromSite(g, id, sid, name, f=()=>{}) {
    return {
        value: g.sites[sid][name],
        setter(x) {
            withGroup(id, g => {
                g.sites[sid][name] = x
                f(g.sites[sid])
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


function addSite(group, url) {
    let id = Date.now()
    group.sites[id] = newSite(url)
    group.site_order.push(id)
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


let dragging_function = null;

function drag(ev) {
    ev.dataTransfer.setData('old', ev.target.drag_no);
    document.body.setAttribute('showdroptargets', true);
}

function dragOver(ev) {
    ev.preventDefault();
}

function dragEnter(ev) {
    if(ev.target.className !== 'drop-target') return;
    ev.preventDefault();
    ev.target.setAttribute('targethover', true);
}

function dragLeave(ev) {
    if(ev.target.className !== 'drop-target') return;
    ev.preventDefault();
    ev.target.removeAttribute('targethover');
}

function drop(ev) {
    document.body.removeAttribute('showdroptargets');

    if(ev.target.className !== 'drop-target') return;
    ev.preventDefault();

    let old_no = ev.dataTransfer.getData('old');
    
    let new_no = ev.target.drop_no;
    if(new_no > old_no) new_no--;

    dragging_function(old_no, new_no);
}



listGroups();
updateTimes();
document.addEventListener('dragstart', drag);
document.addEventListener('dragover', dragOver);
document.addEventListener('drop', drop);
document.addEventListener('dragenter', dragEnter);
document.addEventListener('dragleave', dragLeave);
setInterval(updateTimes, 500);
