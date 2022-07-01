
const dayDuration = 24*60*60*1000;
const resetHour = 4;

function getPastResetDate() {
    let d = new Date();
    if(d.getHours() < resetHour) {
        d = new Date(d - dayDuration);
    }
    d.setHours(resetHour, 0, 0);
    return d.getTime();
}

function merge(ret, add) {
    try {
        for(let k in add) {
            ret[k] = add[k]
        }
    }
    catch(x) {}
    return ret;
}


const match_item_methods = {
    has: {
        name: "has",
        method(item, entry) {
            return item.includes(entry.data)
        }
    },
    is: {
        name: "is",
        method(item, entry) {
            return item == entry.data
        }
    }
};

const match_items = {
    domain: {
        name: "Domain",
        methods: match_item_methods,
        show_methods: true,
        get(tab) {
            return new URL(tab.url).hostname;
        }
    },
    url: {
        name: "Full URL",
        methods: match_item_methods,
        show_methods: true,
        get(tab) {
            return tab.url;
        }
    },
    any: {
        name: "Any tab",
        methods: {any: {name: '---', method(item, entry) {return true}}},
        show_methods: false,
        get(tab) {
            return true
        }
    }
};

function match(tab) {
    return entry => {
        try {
            const item_matcher = match_items[entry.item];
            const item   = item_matcher.get(tab);
            const method = item_matcher.methods[entry.method];

            return method.method(item, entry);
        }
        catch(x) {return false}
    }
}

/*
const matchers = {
    domain_has: {
        name: "Domain has",
        has_url: true,
        match(entry, tab) {
            try {
                if(entry == "about:") {
                    return true;
                }
                return entry.data.length > 0 && new URL(tab.url).hostname.includes(entry.data);
            }
            catch {
                return false;
            }
        }
    },
    domain_is: {
        name: "Domain is",
        has_url: true,
        match(entry, tab) {
            try {
                if(entry == "about:") {
                    return true;
                }
                return entry.data.length > 0 && new URL(tab.url).hostname == entry.data;
            }
            catch {
                return false;
            }
        }
    },
    url_has: {
        name: "URL has",
        has_url: true,
        match(entry, tab) {
            try {
                return entry.data.length > 0 && tab.url.includes(entry.data);
            }
            catch {
                return false;
            }
        }
    },
    url_is: {
        name: "URL is",
        has_url: true,
        match(entry, tab) {
            try {
                return entry.data.length > 0 && tab.url == entry.data;
            }
            catch {
                return false;
            }
        }
    },
    any: {
        name: "Any",
        has_url: false, 
        match(entry, tab) {
            return true;
        }
    }
};


function match(tab) {
    return (entry) => matchers[entry.method].match(entry, tab);
}
*/

export {dayDuration, getPastResetDate, match, match_items};
