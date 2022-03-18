

// Common classes/values for widgets
const cls = {
    back: {
        value: "<-",
        className: "back"
    },
    
    remove: {
        value: "-",
        className: "remove"
    },

    removegroup: {
        value: "Remove group",
        className: "removegroup"
    },

    add: {
        value: "+",
        className: "add"
    },

    groupname: (name) => {return {
        value: name,
        className: "groupname"
    }},

    rowmain: (name) => {return {
        value: name,
        className: "rowmain"
    }},

    timestats: {
        className: "timestats"
    },

    time: (group) => {
        let s = group.time > group.limit ? "timeexpired"
              : group.time > group.limit * 0.9 ? "timewarn"
              : "timeok";
        return {className: s}
    },

    timelimit: (time) => {return {
        value: timeToHms(time),
        className: "timelimit"
    }},

    resettime: {
        value: "Reset time",
        className: "resettime"
    },

    resettime_tooltip: {
        value: "?",
        title: "Automatic reset occurs every day on 4:00 AM, by subtracting the limit from total time.",
        className: "resettime-tooltip"
    },

    about: {
        value: "☰",
        className: "about"
    }
}

// Create text with a given tag
function createText(root, tag, properties, text) {
    let node = document.createElement(tag);
    for (let k in properties) {
        node[k] = properties[k];
    }
    node.innerText = text;
    root.append(node);
    return node;
}

// Create button with f(node) being called on click
function createButton(root, properties, f) {

    let node = document.createElement('input');
    node.type = "button";
    node.class = "button";

    node.onclick = () => f(node);
    root.append(node);

    for (let k in properties) {
        node[k] = properties[k];
    }

    return node;
}

// Create text input. The f(value) function should return a parsed value
function createTextInput(root, properties, f) {
    
    let input = document.createElement('input');

    input.type = "text";
    input.onchange = () => {
        f(input.value);
    }
    
    for (let k in properties) {
        input[k] = properties[k];
    }

    root.append(input);
    return input;
}

// Create div, call f(div)
function createDiv(root, properties, f) {
    let div = document.createElement('div');
    for (let k in properties) {
        div[k] = properties[k];
    }
    f(div);
    root.append(div);
    return div;
}

// Create table with elements listed in columns, generated with function f(root_td, line, column) -> optional item_properties
function createTable(root, properties, lines, columns, f) {

    let table = document.createElement('table');    

    for (let l = 0 ; l < lines; l++) {
        let tr = document.createElement('tr');
        for (let c = 0; c < columns; c++) {
            let td = document.createElement('td');

            // Create child and apply properties to it
            let prop = f(td,l,c);
            for (let k in prop) {
                td[k] = prop[k];
            }
            tr.append(td);
        }
        table.append(tr);
    }
    
    for (let k in properties) {
        table[k] = properties[k];
    }
    root.append(table);
    return table;
}

// Create select, execute f(entry_number) on select
function createSelect(root, properties, selected, options, f) {
    let select = document.createElement('select');

    for (let i in options) {
        let option = document.createElement('option');

        option.value = i;
        option.innerText = options[i];

        select.append(option);
    }

    select.value = selected;
    select.onchange = () => {f(select.value)}

    for (let k in properties) {
        select[k] = properties[k];
    }

    root.append(select);
    return select;
}

function timeToHms(time) {
    let hours = Math.floor(time / 3600000);
    let minutes = Math.floor((time / 60000) % 60);
    let seconds = Math.floor((time / 1000) % 60);
    let m0 = minutes > 9 ? "" : "0";
    let s0 = seconds > 9 ? "" : "0";
    return `${hours}:${m0}${minutes}:${s0}${seconds}`;
}

function hmsToTime(hms, fallback) {
    let str = hms.split(":")
    let n1 = Number(str[0]);
    let n2 = Number(str[1]);
    let n3 = Number(str[2]);
    return isNaN(n1) ? fallback 
         : isNaN(n2) ? n1*1000
         : isNaN(n3) ? n1*60000+n2*1000
         : n1*3600000+n2*60000+n3*1000;
}

function timeText(group) {
    return `${timeToHms(group.time)}/${timeToHms(group.limit)}`;
}

export {cls, createText, createButton, createDiv, createTextInput, createTable, createSelect, timeText, timeToHms, hmsToTime};
