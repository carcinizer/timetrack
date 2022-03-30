
// Storage structure:
//
// Data:
//  version: int = 2
//  last_reset: int
//  groups: {int: Group}
//  group_order: [int]
//
// Group:
//  name: String
//  sites: {int: Site}
//  site_order: [int]
//  time: int
//  limit: int
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

const DATA_VERSION = 3;

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

        let newdata = newData();
        for (let k in newdata) {
            if(!(k in data)) {
                data[k] = newdata[k];
            }
        }
        data.version = DATA_VERSION;

        return data;
    }
}

export {withData, saveData, newData, adaptData};

