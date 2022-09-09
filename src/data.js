
// Storage structure:
//
// Data:
//  version: int = DATA_VERSION
//  groups: {int: Group}
//  group_order: [int]
//  paused: bool
//
// Group:
//  name: String
//  sites: {int: Site}
//  site_order: [int]
//  time: int
//  extra_time: int
//  limit: int
//  active_now: bool
//  enabled: bool,
//  enable_on_weekdays: [bool]
//  enable_on_hours: bool,
//  enable_on_hours_begin_ms: int,
//  enable_on_hours_end_ms: int,
//  enable_timezone: "local" | "UTC",
//  block_on_timeout: bool
//  dont_track_unfocused_window: bool
//  track_playing: bool
//  track_active: bool
//  max_extra_time: int
//  next_reset: int
//  reset_at_ms: int
//
// Site:
//  method: String
//  data: String
//  item: String
//  navigated_from: bool
//  exclude_internal_sites: bool
//
// BackgroundState:
//  data: DataProxy
//  last_update_time: int
//  last_update_active: bool
//  excluded_from_count: {String}
//  force_count: {String}
//

const loc = "sync"; // "local" or "sync"

const DATA_VERSION = 12;

function newGroup() {
    return {
        name: "New Group", 
        sites: {},
        site_order: [],
        time: 0, 
        extra_time: 0,
        limit: 60*60*1000, 
        active_now: false,
        enabled: true,
        enable_on_weekdays: [true, true, true, true, true, true, true],
        enable_on_hours: false,
        enable_on_hours_begin_ms: 0,
        enable_on_hours_end_ms: 24*60*60*1000,
        enable_timezone: "local",
        block_on_timeout: false,
        dont_track_unfocused_window: true,
        track_playing: false,
        track_active: true,
        max_extra_time: 15*60*1000,
        next_reset: Date.now(),
        reset_at_ms: 4*60*60*1000
    }
}

function newData() {
    return {
        version: DATA_VERSION,
        groups: {},
        group_order: [],
        paused: false
    }
}

function newSite(data='') {
    return {
        data: data,
        method: 'has',
        item: 'domain',
        navigated_from: false,
        exclude_internal_sites: true
    }
}

// TODO - "with data"
function withData(f) {
    let promise = browser.storage[loc].get();
    promise.then((data) => {
        f(adaptData(data, true))
    })
}

async function saveData(data) {
    await browser.storage[loc].set(data)
}

function adaptData(data, noexceptions) {
    if(noexceptions) {
        try {
            return adaptData(data);
        } 
        catch(x) {
            return newData();
        }
    }
    else {
        if(data.version > DATA_VERSION || data.version < 2) {
            throw new Error(`Incompatible versions, expected versions between 2 to ${DATA_VERSION}, got ${data.version}`);
        }

        if(data.version == DATA_VERSION) {
            return data;
        }

        let newdata = newData();
        for (let k in newdata) {
            if(!(k in data)) {
                data[k] = newdata[k];
            }
        }

        let newgroup = newGroup();
        for (let k in newgroup) {
            for (let gid of data.group_order) {
                const group = data.groups[gid]
                if(!(k in group)) {
                    group[k] = newgroup[k];
                }
            }
        }

        let newsite = newSite();
        for (let k in newsite) {
            for (let {site} of sitesIn(data)) {
                if(!(k in site)) {
                    site[k] = newsite[k];
                }
            }
        }

        const site_v6_migration = {
            url_has(site) {site.item = 'url'; site.method = 'has'},
            url_is(site)  {site.item = 'url'; site.method = 'is'},
            domain_has(site) {site.item = 'domain'; site.method = 'has'},
            domain_is(site)  {site.item = 'domain'; site.method = 'is'},
            any(site)  {site.item = 'any'; site.method = 'any'}
        }

        if(data.version < 6) {
            for (let {site} of sitesIn(data)) {
                site_v6_migration[site.method](site);
            }
        }

        data.version = DATA_VERSION;

        return data;
    }
}


function* groupsIn(data) {
    for (let gid of data.group_order) {
        yield {group: data.groups[gid], gid: gid};
    }
}

function* sitesIn(data) {
    for (let {group, gid} of groupsIn(data)) {
        for (let sid of group.site_order) {
            yield {site: group.sites[sid], sid: sid, group: group, gid: gid};
        }
    }
}


export {withData, saveData, newData, newGroup, newSite, adaptData};

