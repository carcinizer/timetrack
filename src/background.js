import {withData, saveData, newData, adaptData} from './data.js';
import {getPastResetDate, dayDuration, match} from './utils.js';
import {updateIcon} from './icon.js';

function* getAssociatedGroupIDs(tab, data, condition) {

    const matcher = match(tab);

    for (let gid in data.groups) {
        const group = data.groups[gid];

        for (let s in group.sites) {
            if((condition === undefined || group[condition]) 
               && group.enabled
               && matcher(group.sites[s])) 
            {
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
        this.updateGroupsEnabled();
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
                    groupdata.active_now = state.data.groups[id].active_now
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
            moveSite({gid, old_no, new_no}) {
                let [id] = state.data.groups[gid].site_order.splice(old_no, 1);
                state.data.groups[gid].site_order.splice(new_no, 0, id);
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

    updateGroupsEnabled() {
        for(let gid of this.data.group_order) {
            const g = this.data.groups[gid];

            let today = new Date();
            let tz = g.enable_timezone == "UTC" ? "UTC" : "";
            let weekday = today[`get${tz}Day`]()
            today[`set${tz}Seconds`](1);
            today[`set${tz}Minutes`](0);
            today[`set${tz}Hours`](0);

            let daytime = (new Date()).getTime() - today.getTime();
            let enable_hours = daytime >= g.enable_on_hours_begin_ms && daytime <= g.enable_on_hours_end_ms;

            g.enabled = g.enable_on_weekdays[weekday] & (!g.enable_on_hours | enable_hours)
        }
    }

    timePassed(extra_time) {
        let now = this.now() + (extra_time ? extra_time : 0);
        let time = now - this.last_update_time;

        this._done_groups = new Set();
        this.max_timefrac_active = null;

        for (let gid of this.data.group_order) {
            this.data.groups[gid].active_now = false;
        }

        this.tabs.forEach(x => this.tabTimePassed(x,time, 'track_active'));
        this.playing_tabs.forEach(x => this.tabTimePassed(x,time, 'track_playing'));

        this.last_update_time = this.now();

        return this
    }

    tabTimePassed(tab, time, condition) {
        let matcher = match(tab);
        let tab_focused = this.focused_window && this.focused_window.id == tab.windowId;
        let block_on_timeout = false;
        let timeout = false;
        let track_active = false;
        let track_playing = false;
        let extra_time = 0;
        let max_extra_time = 24*60*60*1000;

        for (let gid of getAssociatedGroupIDs(tab, this.data, condition)) {
            const group = this.data.groups[gid];

            if(group.dont_track_unfocused_window && !tab_focused) {
                continue;
            }

            if(this._done_groups.has(gid)) {continue}
            this._done_groups.add(gid);

            this.data.groups[gid].active_now = true;

            if(!this.data.paused) {
                group.time += time;
            }
            
            let timeout_local = group.time > group.limit + group.extra_time;
            if(timeout_local) {
                timeout = timeout | timeout_local;
                block_on_timeout = block_on_timeout | group.block_after_timeout;
                track_active = track_active | group.track_active;
                track_playing = track_playing | group.track_playing;
            }

            if((group.max_extra_time - group.extra_time) < (max_extra_time - extra_time)) {
                extra_time = group.extra_time;
                max_extra_time = group.max_extra_time;
            }

            this.max_timefrac_active = Math.max(this.max_timefrac_active, group.time / group.limit);
        }
        
        if(block_on_timeout)
            this.blockOnTimeout(tab, timeout, track_active, track_playing, extra_time, max_extra_time);
    }

    async blockOnTimeout(tab, timeout, track_active, track_playing, extra_time, max_extra_time) {

        if(await browser.permissions.contains({origins: ["<all_urls>"]})) {

            let message = {
                should_be_blocked: timeout && track_active, 
                should_be_paused: timeout && (track_active || track_playing),
                extra_time: extra_time, 
                max_extra_time: max_extra_time
            }

            // Check if content script exists for a given tab 
            try {
                await browser.tabs.sendMessage(tab.id, message)
            }
            catch {  // Create it if doesn't exist and there's a timeout
                if(timeout) {
                    if(track_active) {
                        await browser.tabs.insertCSS(tab.id, {file: "/src/timeout.css"})
                        await browser.tabs.executeScript(tab.id, {file: "/src/timeout.js"})
                    }
                    if(track_playing || track_active) {
                        await browser.tabs.executeScript(tab.id, {file: "/src/timeoutplaying.js"})
                    }
                    await browser.tabs.sendMessage(tab.id, message)
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
        for(let gid in this.data.groups) {
            const group = this.data.groups[gid];

            if(force || group.next_reset < new Date(this.now())) {
                group.time = Math.max(0, group.time - group.limit)
                group.extra_time = 0;
                group.next_reset = getPastResetDate() + dayDuration + this.data.groups;
            }
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

let bgstate = new BackgroundState();
