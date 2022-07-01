
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
            properties: {value: i, selected: value == i},
            children: [choices[i]]
        })
    }

    return {
        type: 'select',
        cls: cls,
        properties: properties,
        eproperties: {onchange: e => () => {setter(e.value)}},
        children: options
    }
}

function tooltip(text, element) {
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


export {
    cls, 
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
