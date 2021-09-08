
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

export {dayDuration, getPastResetDate};
