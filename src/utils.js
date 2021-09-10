
const dayDuration = 24*60*60*1000;
const resetHour = 4;

function getPastResetDate() {
    let d = new Date();
    if(d.getHours() < resetHour) {
        d -= day;
    }
    d.setHours(resetHour, 0, 0);
    return d;
}

const matchers = [
    {
        name: "Hostname includes",
        has_url: true,
        match(entry, tab_url) {
            try {
                return entry.url.length > 0 && new URL(tab_url).hostname.includes(entry.url);
            }
            catch {
                return false;
            }
        }
    },
    {
        name: "Hostname (exact)",
        has_url: true,
        match(entry, tab_url) {
            try {
                return entry.url.length > 0 && new URL(tab_url).hostname == entry.url;
            }
            catch {
                return false;
            }
        }
    },
    {
        name: "URL includes",
        has_url: true,
        match(entry, tab_url) {
            try {
                return entry.url.length > 0 && tab_url.includes(entry.url);
            }
            catch {
                return false;
            }
        }
    },
    {
        name: "URL (exact)",
        has_url: true,
        match(entry, tab_url) {
            try {
                return entry.url.length > 0 && tab_url == entry.url;
            }
            catch {
                return false;
            }
        }
    },
    {
        name: "Any active tab",
        has_url: false, 
        match(entry, tab_url) {
            return true;
        }
    }
];


function match(tab_url) {
    return (entry) => matchers[entry.type].match(entry, tab_url);
}

export {dayDuration, getPastResetDate, matchers, match};
