
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

const DATA_VERSION = 2;

function newData() {
    return {
        version: DATA_VERSION,
        last_reset: Date.now(),
        groups: {},
        group_order: []
    }
}

// TODO - "with data"
function withData(f) {
    let promise = browser.storage[loc].get();
    promise.then((data) => {
        if(data.version >= 2) {
            f(data)
        }
        else {f(newData())}
    })
}

function saveData(data) {
    console.log("Saved", data);
    chrome.storage[loc].set(data)
}

export {withData, saveData, newData};

