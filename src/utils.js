
import {span} from './ui.js'

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

function mapObj(obj, f) {
    let a = {};
    for (let i in obj) {
        a[i] = f(obj[i], i, obj)
    }
    return a
}

const match_item_methods = {
    has: {
        name: "contains",
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

function common_item_description(site) {
    return [span('dimmed', [`${this.name} ${this.methods[site.method].name} `]), site.data]
}

const match_items = {
    domain: {
        name: "Domain",
        methods: match_item_methods,
        show_methods: true,
        description: common_item_description,
        get(tab) {
            return new URL(tab.url).hostname;
        }
    },
    url: {
        name: "Full URL",
        methods: match_item_methods,
        show_methods: true,
        description: common_item_description,
        get(tab) {
            return tab.url;
        }
    },
    any: {
        name: "Any site",
        methods: {any: {name: '---', method(item, entry) {return true}}},
        show_methods: false,
        description(site) {
            return ["Any site"]
        },
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

const matchers = {
    item: mapObj(match_items, x=>x.name),
    method(item) {
        return mapObj(match_items[item].methods, x=>x.name)
    }
}

export {dayDuration, getPastResetDate, merge, match, match_items, matchers};
