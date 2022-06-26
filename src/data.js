
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
//
// Site:
//  method: String
//  data: String
//  
// BackgroundState:
//  data: DataProxy
//  last_update_time: int
//  last_update_active: bool
//  excluded_from_count: {String}
//  force_count: {String}
//

const loc = "sync"; // "local" or "sync"

const DATA_VERSION = 5;

function newGroup() {
    return {
        name: "New Group", 
        sites: {},
        site_order: [],
        time: 0, 
        extra_time: 0,
        limit: 60*60*1000, 
        block_on_timeout: false
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

// TODO - "with data"
function withData(f) {
    let promise = browser.storage[loc].get();
    promise.then((data) => {
        f(adaptData(data, true))
    })
}

function saveData(data) {
    chrome.storage[loc].set(data)
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

        data.version = DATA_VERSION;

        return data;
    }
}

export {withData, saveData, newData, newGroup, adaptData};

