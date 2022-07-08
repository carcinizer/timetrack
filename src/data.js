
// Storage structure:
//
// Data:
//  version: int = DATA_VERSION
//  last_reset: int
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
//  block_on_timeout: bool
//  dont_track_unfocused_window: bool
//  track_playing: bool
//  track_active: bool
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

const DATA_VERSION = 8;

function newGroup() {
    return {
        name: "New Group", 
        sites: {},
        site_order: [],
        time: 0, 
        extra_time: 0,
        limit: 60*60*1000, 
        block_on_timeout: false,
        dont_track_unfocused_window: true,
        track_playing: false,
        track_active: true
    }
}

function newData() {
    return {
        version: DATA_VERSION,
        last_reset: Date.now(),
        groups: {},
        group_order: [],
        paused: false
    }
}

function newSite(data='') {
    return {
        data: data,
        method: 'has',
        item: 'url',
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

