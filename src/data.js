
const loc = "local"; // "local" or "sync"

async function loadData() {
    try {
        let storage = await browser.storage[loc].get();
        if(storage.groups === undefined) {
            storage.groups = [];
        }
        return storage;
    }
    catch(err) {
        return {groups: []}
    }
}

async function saveData(timer_data) {
    return await browser.storage[loc].set(timer_data);
}


let data = {};
let promise = loadData();

function updateData(changes,area) {
    data.groups = changes.groups.newValue;
}

browser.storage.onChanged.addListener(updateData);

// Execute f with data. A function can return a truthy value to indicate readonly access
async function withData(f) {

    if(promise) {
        data = await promise;
        promise = false;
    }

    let ret = f(data);
    if(!ret) {
        await saveData(data);
    }
}

async function withDataAsync(f) {

    if(promise) {
        data = await promise;
        promise = false;
    }

    let ret = await f(data);
    if(!ret) {
        await saveData(data);
    }
}

export {withData, withDataAsync};
