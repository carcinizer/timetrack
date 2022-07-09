import {withData, saveData, newData, adaptData} from './data.js';
import {getPastResetDate, dayDuration, match} from './utils.js';

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

function getGradient(frac, paused) {
    if(paused) {
        return {fg: gradient_inactive_fg, bg: gradient_inactive_bg}
    }
    else if(frac > 1.0) {
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

function drawProgressCircle(timefraction, colortf, paused, radius_outer, radius_inner) {

    // clamp fractions for correct rendering
    let tf = timefraction;
    tf = tf && tf > 0 ? tf : 0.00001;
    tf = tf < 1       ? tf : 0.99999;

    let begin = 3/2 * Math.PI;
    let end = (3/2 + 2*tf) * Math.PI;

    let gradients = getGradient(colortf, paused);

    icon_ctx.fillStyle = gradients.fg;
    drawSolidArc(icon_ctx, begin, end, false, radius_outer, radius_inner);
    icon_ctx.fillStyle = gradients.bg;
    drawSolidArc(icon_ctx, begin, end, true, radius_outer, radius_inner);
}

function updateIcon(timefraction_current, timefraction_max, paused) {

    let active = timefraction_current != null && !paused;
    icon_ctx.clearRect(0,0,32,32);
    
    drawProgressCircle(timefraction_max, timefraction_max, paused, 15, active ? 12 : 10);
    if(active) {
        drawProgressCircle(timefraction_current, timefraction_max, paused, 7, 10);
    }

    browser.browserAction.setIcon({imageData: icon_ctx.getImageData(0,0,32,32)});
}

function* getAssociatedGroupIDs(tab, data, condition) {

    const matcher = match(tab);

    for (let gid in data.groups) {
        const group = data.groups[gid];

        for (let s in group.sites) {
            if((condition === undefined || group[condition]) && matcher(group.sites[s])) {
                yield gid;
                break;
            }
        }
    }
}


class BackgroundState {
    constructor(test) {
        this.init(test)
    }

    async init(test) {

        this.now = test ? () => 0 : Date.now;

        this.saveData = test ? async () => {return this} : async () => {await saveData(this.data); return this}

        this.last_update_time = this.now();
        this.last_update_active = false;
        await this.updateTabs();

        withData(d => {
            this.data = test ? newData() : d; 
            this.update();
        })

        // Event hooks
        // TODO - cleanup?
        chrome.tabs.onActivated.addListener(() => {this.update()})
        chrome.tabs.onUpdated.addListener(() => {this.update()})
        chrome.tabs.onRemoved.addListener(() => {this.update()})
        chrome.windows.onFocusChanged.addListener(() => {this.update()})
        browser.runtime.onMessage.addListener(async (msg,s,sr) => {return await this.onMessage(msg,s,sr)})
        setInterval(() => {this.update()}, 30000);
    }

    async updateTabs() {
        let active_tabs = await browser.tabs.query({active: true});
        this.tabs = new Set(active_tabs);

        let playing_tabs = await browser.tabs.query({audible: true});
        this.playing_tabs = new Set(playing_tabs);

        this.focused_window = await browser.windows.getLastFocused();
        if(!this.focused_window.focused)
            this.focused_window = null;

        return this
    }

    async update() {
        this.timePassed();
        await this.updateTabs();
        this.rewind();
        this.timePassed(); // Once again to get max time fractions for currently active tabs
        await this.saveData();
        this.updateIcon();
    }

    async onMessage({type, content}, sender, sendResponse) {
        let state = this;
        const messages = {
            updateTimes() {
            },
            updateGroupSettings({id, groupdata}) {
                let group = state.data.groups[id];
                if(group) {
                    groupdata.time = state.data.groups[id].time
                    groupdata.extra_time = state.data.groups[id].extra_time
                }
                state.data.groups[id] = groupdata;

                if(!state.data.group_order.includes(id)) {
                    state.data.group_order.push(id);
                }
            },
            removeGroup({id}) {
                delete state.data.groups[id];
                state.data.group_order = state.data.group_order.filter(x=>x!=id);
            },
            moveGroup({old_no, new_no}) {
                let [id] = state.data.group_order.splice(old_no, 1);
                state.data.group_order.splice(new_no, 0, id);
            },
            getData() {
                return state.data;
            },
            reset({id}) {
                state.reset(id);
            },
            rewind() {
                state.rewind(true);
            },
            cleanData() {
                state.data = newData();
            },
            switchPause() {
                state.data.paused = !state.data.paused;
            },
            export() {
                let objecturl = URL.createObjectURL(
                    new Blob([JSON.stringify(state.data, null, 4)]),
                    {type: "application/json"});

                browser.downloads.download({
                    url: objecturl,
                    filename: "timetrack_config.json",
                    saveAs: true
                });
            },
            import({data}) {
                state.data = adaptData(data);
            },
            moreTime({amount}) {
                for(let gid of getAssociatedGroupIDs(sender.tab, state.data)) {
                    state.data.groups[gid].extra_time += amount;
                }
            }
        }

        let obj = messages[type](content);
        await state.update()
        sendResponse(obj)
    }

    timePassed(extra_time) {
        let now = this.now() + (extra_time ? extra_time : 0);
        let time = now - this.last_update_time;

        this._done_groups = new Set();
        this.max_timefrac_active = null;

        this.tabs.forEach(x => this.tabTimePassed(x,time, 'track_active'));
        this.playing_tabs.forEach(x => this.tabTimePassed(x,time, 'track_playing'));

        this.last_update_time = this.now();

        return this
    }

    tabTimePassed(tab, time, condition) {
        let matcher = match(tab);
        let tab_focused = this.focused_window && this.focused_window.id == tab.windowId;

        for (let gid of getAssociatedGroupIDs(tab, this.data, condition)) {
            const group = this.data.groups[gid];

            if(group.dont_track_unfocused_window && !tab_focused) {
                continue;
            }

            if(this._done_groups.has(gid)) {continue}
            this._done_groups.add(gid);

            if(!this.data.paused) {
                group.time += time;
            }
            
            this.refreshContentScript(tab, group);

            this.max_timefrac_active = Math.max(this.max_timefrac_active, group.time / group.limit);
        }
    }

    async refreshContentScript(tab, group) {

        if(group.block_after_timeout && await browser.permissions.contains({origins: ["<all_urls>"]})) {

            let timeout = group.time > group.limit + group.extra_time;

            // Check if content script exists for a given tab 
            try {await browser.tabs.sendMessage(tab.id, {should_be_blocked: timeout})}
            catch {  // Create it if doesn't exist and there's a timeout
                if(timeout) {
                    await browser.tabs.insertCSS(tab.id, {file: "/src/timeout.css"})
                    await browser.tabs.executeScript(tab.id, {file: "/src/timeout.js"})
                }
            };
        }
    }

    reset(gid) {
        this.data.groups[gid].time = 0;
        this.data.groups[gid].extra_time = 0;
        return this
    }

    rewind(force) {
        if(force || typeof this.data.last_reset != "number" || this.data.last_reset + dayDuration < new Date(this.now())) {
            for(let gid in this.data.groups) {
                const group = this.data.groups[gid];
                group.time = Math.max(0, group.time - group.limit)
                group.extra_time = 0;
            }
            this.data.last_reset = getPastResetDate();
        }
        return this
    }

    updateIcon() {
        this.max_timefrac = 0;
        for(let gid in this.data.groups) {
            const group = this.data.groups[gid];
            this.max_timefrac = Math.max(this.max_timefrac, group.time / group.limit);
        }

        updateIcon(this.max_timefrac_active, this.max_timefrac, this.data.paused);
        return this
    }

    blockTab(tab) {
        browser.permissions.contains({origins: ["<all_urls>"]}).then(perm => {if(perm) {
            browser.contentScripts.register({
                matches: [tab.url],
                js: [{file: "/src/timeout.js"}],
                css: [{file: "/src/timeout.css"}]
            })
        }})
    }
}

function tests(testlist) {
    let a = 0
    let b = 0
    for( {name, test} in testlist) {
        let passed = test() ? "[ OK ]" : "[Fail]"

        console.log(`${passed} ${name}`)
        if(passed) {a++}
        b++;
    }
    console.log("-----------------------------")
    console.log(`Passed ${a}/${b}`)
}


function execute_tests() {
    tests([
        {name: "None", test: () => {
            return true;
        }},
    ])
}


let bgstate = new BackgroundState();
