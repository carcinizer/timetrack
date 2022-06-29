
import {merge} from './utils.js'

// Common classes/values for widgets
const cls = {
    text: (text) => {
        return {children: [text]}
    },

    back: {
        children: ["<-"],
        cls: ["back"]
    },
    
    remove: {
        children: ["-"],
        cls: ["remove"]
    },

    removegroup: {
        children: ["Remove group"],
        cls: ["removegroup"]
    },

    add: {
        children: ["+"],
        cls: ["add"]
    },

    groupname: (name) => {return {
        value: name,
        className: "groupname"
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
        children: ["Reset time"],
        cls: ["resettime"]
    },

    about: {
        children: ["☰"],
        cls: ["about"]
    },

    clean_data: {
        children: ["Clean data"],
        cls: ["removegroup"]
    },

    pause: (status) => {
        return {
            children: [status ? "Resume" : "Pause"],
            cls: ["pause"]
    }},

    site_data: enabled => {
        return {
            cls: ["site-data"],
            properties: {disabled: !enabled}
        }
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

function createCheckbox(root, labeltext, properties, f) {

    let label = document.createElement('label');

    let node = document.createElement('input');
    node.type = "checkbox";
    node.onchange = () => f(node.checked);

    label.append(node);
    createText(label, 'span', {}, labeltext);

    root.append(label);

    for (let k in properties) {
        node[k] = properties[k];
    }

    return label;
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


// Create elements from a "prefab" object
//
// ElementPrefab:
//     type: str
//     cls: [str]
//     properties: Object
//     eproperties: {str: (Element) => any}  // Properties requiring access to final element, such as events
//     children: [ElementPrefab]
//     
function addElements(root, obj) {

    if(Array.isArray(obj)) {
        obj.forEach(x => addElements(root, x))
        return;
    }

    if(typeof obj === "string") {
        root.append(obj);
        return;
    }

    let elem = document.createElement(obj.type);
    obj.cls?.forEach(cls => elem.classList.add(cls));

    merge(elem, obj.properties)
    for(let k in obj.eproperties) {
        elem[k] = obj.eproperties[k](elem);
    }

    obj.children?.forEach(child => addElements(elem, child));

    if(obj.style) {
        merge(elem.style, obj.style)
    }

    elem.id = obj.id;

    root.append(elem);
}


function button({cls, properties, children}, f) {
    return {
        type: 'button',
        cls: cls,
        properties: merge({type: 'button', onclick: f}, properties),
        children: children
    }
}

function textInput({cls, properties, children}, {value, setter}) {
    return {
        type: 'input',
        cls: cls,
        properties: {type: 'text', value: value},
        eproperties: {onchange: (e) => () => {setter(e.value)}},
        children: children
    }
}

function checkbox({cls, properties}, label, {value, setter}) {
    return {
        type: 'label',
        children: [
            label,
            {
                type: 'input',
                cls: cls,
                properties: merge({
                    type: 'checkbox',
                    checked: value,
                    onchange: setter
                }, properties),
            }
        ]
    }
}

function select({cls, properties}, choices, {value, setter}) {

    let options = [];
    for (let i in choices) {
        options.push({
            type: 'option',
            properties: {value: i},
            children: [choices[i]]
        })
    }

    return {
        type: 'select',
        cls: cls,
        properties: merge({value: value}, properties),
        eproperties: {onchange: e => () => {setter(e.value)}},
        children: options
    }
}

function tooltip(text, element) {
    //return div({cls: ['tooltiped']}, ['?', span('tooltip', text)]);
    let elem = element ? element : button({cls: ['tooltip-container'], children: ["?"]});
    elem.children.push( [span('tooltip', [text])] )
    return elem;
}

const simpleGroup = name => (p, children) => {
    if(children === undefined) {
        return {type: name, children: p}
    }
    if(typeof p == 'string') {
        return {type: name, cls: [p], children: children}
    }

    return merge({type: name, children: children}, p)
}

const div = simpleGroup('div');
const span = simpleGroup('span');
const h1 = simpleGroup('h1');
const h3 = simpleGroup('h3');

// function div(cls, children) {
//     return {type: 'div', cls: [cls], children: children}
// }

// function span(cls, children) {
//     return {type: 'span', cls: [cls], children: children}
// }


export {
    cls, 
    createText,
    createButton, 
    createDiv,
    createTextInput,
    createTable,
    createSelect,
    createCheckbox,
    timeText,
    hmsToTime,
    timeToHms,
    addElements,
    button,
    textInput,
    div,
    span,
    h1,
    h3,
    checkbox,
    tooltip,
    select
};
