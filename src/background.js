import {withData, saveData, newData} from './data.js';
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

function getGradient(frac, active) {
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

function drawSolidArc(ctx, begin, end, counterclockwise, radius_outer, radius_inner) {
    
    ctx.beginPath();
    ctx.arc(16,16, radius_outer, begin, end, counterclockwise);
    ctx.arc(16,16, radius_inner, end, begin, !counterclockwise);
    ctx.closePath();
    ctx.fill();
}

function drawProgressCircle(timefraction, colortf, active, radius_outer, radius_inner) {

    // clamp fractions for correct rendering
    let tf = timefraction;
    tf = tf && tf > 0 ? tf : 0.00001;
    tf = tf < 1       ? tf : 0.99999;

    let begin = 3/2 * Math.PI;
    let end = (3/2 + 2*tf) * Math.PI;

    let gradients = getGradient(colortf, active);

    icon_ctx.fillStyle = gradients.fg;
    drawSolidArc(icon_ctx, begin, end, false, radius_outer, radius_inner);
    icon_ctx.fillStyle = gradients.bg;
    drawSolidArc(icon_ctx, begin, end, true, radius_outer, radius_inner);
}

function updateIcon(timefraction_current, timefraction_max) {

    let active = timefraction_current != null;
    icon_ctx.clearRect(0,0,32,32);
    
    drawProgressCircle(timefraction_max, timefraction_max, true, 15, active ? 12 : 10);
    if(active) {
        drawProgressCircle(timefraction_current, timefraction_max, true, 7, 10);
    }

    console.log("Icon: ", timefraction_current, timefraction_max)
    browser.browserAction.setIcon({imageData: icon_ctx.getImageData(0,0,32,32)});
}


class BackgroundState {
    constructor(test) {
        withData(d => {this.data = test ? newData() : d})
        this.now = test ? () => 0 : Date.now;

        this.saveData = test ? () => {return this} : () => {saveData(this.data); return this}

        this.last_update_time = this.now();
        this.last_update_active = false;
        this.updateTabs();

        // Event hooks
        // TODO - cleanup?
        chrome.tabs.onActivated.addListener(() => {this.update()})
        chrome.tabs.onUpdated.addListener(() => {this.update()})
        chrome.tabs.onRemoved.addListener(() => {this.update()})
        chrome.runtime.onMessage.addListener((msg,s,sr) => {this.onMessage(msg,s,sr)})
        setInterval(() => {this.update()}, 30000);

        console.log("Constructed: ", this)
    }

    updateTabs(callback_after_opt) {
        let callback_after = callback_after_opt ? callback_after_opt : () => {};
        let promise = browser.tabs.query({active: true});
        promise.then(x => {this.tabs = new Set(x); callback_after()});
        return this
    }

    update() {
        return this
            .timePassed()
            .updateTabs(() => {
                this.rewind()
                .timePassed() // Once again to get max time fractions for currently active tabs
                .saveData()
                .updateIcon();
            })
    }

    onMessage({type, content}, sender, sendResponse) {
        let state = this;
        console.log("Got", type, content)
        const messages = {
            updateTimes() {
            },
            updateGroupSettings({id, groupdata}) {
                let group = state.data.groups[id];
                if(group) {groupdata.time = state.data.groups[id].time}
                state.data.groups[id] = groupdata;

                if(!state.data.group_order.includes(id)) {
                    state.data.group_order.push(id);
                }
            },
            removeGroup({id}) {
                delete state.data.groups[id];
                state.data.group_order = state.data.group_order.filter(x=>x!=id);
            },
            getData() {
                return state.data;
            },
            reset({id}) {
                state.reset(id);
            },
            cleanData() {
                state.data = newData();
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
            }
        }

        let obj = messages[type](content);
        state.update()
        sendResponse(obj)
    }

    timePassed(extra_time) {
        let now = this.now() + (extra_time ? extra_time : 0);
        let time = now - this.last_update_time;

        this._done_groups = new Set();
        this.max_timefrac_active = null;

        this.tabs.forEach(x => this.tabTimePassed(x,time));

        this.last_update_time = this.now();

        return this
    }

    tabTimePassed(tab, time) {
        let matcher = match(tab);

        for (let gid in this.data.groups) {

            if(this._done_groups.has(gid)) {
                continue
            }

            let group = this.data.groups[gid];

            for (let s in group.sites) {
                if(matcher(group.sites[s])) {
                    this._done_groups.add(gid);
                    group.time += time;

                    this.max_timefrac_active = Math.max(this.max_timefrac_active, group.time / group.limit);
                    break;
                }
            }
        }
    }

    reset(gid) {
        this.data.groups[gid].time = 0;
        return this
    }

    rewind() {
        if(this.data.last_reset + dayDuration < new Date(this.now())) {
            for(let gid in this.data.groups) {
                const group = this.data.groups[gid];
                group.time = Math.max(0, group.time - group.limit)
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

        updateIcon(this.max_timefrac_active, this.max_timefrac);
        return this
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
