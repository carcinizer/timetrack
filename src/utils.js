
const dayDuration = 24*60*60*1000;
const resetHour = 4;

function getPastResetDate() {
    let d = new Date();
    if(d.getHours() < resetHour) {
        d = new Date(d - dayDuration);
    }
    d.setHours(resetHour, 0, 0);
    return d;
}

const matchers = {
    domain_has: {
        name: "Domain has",
        has_url: true,
        match(entry, tab) {
            try {
                if(entry == "about:") {
                    return true;
                }
                return entry.url.length > 0 && new URL(tab.url).hostname.includes(entry.url);
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
                return entry.url.length > 0 && new URL(tab.url).hostname == entry.url;
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
                return entry.url.length > 0 && tab.url.includes(entry.url);
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
                return entry.url.length > 0 && tab.url == entry.url;
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
    return (entry) => matchers[entry.type].match(entry, tab);
}

export {dayDuration, getPastResetDate, matchers, match};
