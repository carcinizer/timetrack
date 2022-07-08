
import {span, checkbox, textInput, select, div, button, cls} from './ui.js'

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

function ensureExisting(obj, collection) {
    if(!(obj in collection)) {
        for(let i in collection) {
            obj = i; break;
        }
    }
}
const ensureExistingMethod = site => ensureExisting(site.method, matchers.method(site.item));


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
    },
    doesnt_have: {
        name: "doesn't contain",
        method(item, entry) {
            return !item.includes(entry.data)
        }
    },
    isnt: {
        name: "isn't",
        method(item, entry) {
            return item != entry.data
        }
    },
    regexp: {
        name: "satisfies regex",
        method(item, entry) {
            let regexp = new RegExp(entry.data)
            return regexp.test(item)
        }
    }
};

function common_item_description(site) {
    return [span('dimmed', [`${this.name} ${this.methods[site.method].name} `]), site.data]
}

function common_item_configuration(site, {getsetValue, removeSiteFunc}) { return [
    div('line-full', [div({},[
        select({}, matchers.item, getsetValue('item', ensureExistingMethod)),
        select({}, matchers.method(site.item), getsetValue('method'))
    ])]),
    div('line-full', [
        textInput(cls.site_data, getsetValue('data')),
        button(cls.remove, removeSiteFunc)
    ])
]}

const match_items = {
    domain: {
        name: "Domain",
        methods: match_item_methods,
        description: common_item_description,
        configuration: common_item_configuration,
        get(tab) {
            return new URL(tab.url).hostname;
        }
    },
    url: {
        name: "Full URL",
        methods: match_item_methods,
        description: common_item_description,
        configuration: common_item_configuration,
        get(tab) {
            return tab.url;
        }
    },
    title: {
        name: "Title",
        methods: match_item_methods,
        description: common_item_description,
        configuration: common_item_configuration,
        get(tab) {
            return tab.title;
        }
    },
    any: {
        name: "Any site",
        methods: {any: {name: '---', method(item, entry) {return true}}},
        description: (site) => ["Any site"],
        configuration(site, {getsetValue, removeSiteFunc}) {
            return [div('line-full', [
                select({}, matchers.item, getsetValue('item', ensureExistingMethod)),
                button(cls.remove, removeSiteFunc)
            ])]
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
