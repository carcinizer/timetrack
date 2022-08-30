

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

    add_site() {return {
        children: ["+", span('group-sub', ["Add current site"])],
        cls: ["add-site", "site-to-track"]
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

    site_data: {
        cls: ["site-data"]
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

    Object.assign(elem, obj.properties)
    for(let k in obj.eproperties) {
        elem[k] = obj.eproperties[k](elem);
    }

    obj.children?.forEach(child => addElements(elem, child));

    Object.assign(elem.style, obj.style)

    if(obj.id) elem.id = obj.id;

    root.append(elem);
}


function button(obj, f) {
    return Object.assign({}, obj, {
        type: 'button',
        properties: Object.assign({type: 'button', onclick: f}, obj.properties),
    })
}

function textInput(obj, {value, setter}) {
    return Object.assign({}, obj, {
        type: 'input',
        properties: {type: 'text', value: value},
        eproperties: {onchange: (e) => () => {setter(e.value)}},
    })
}

function checkbox(_unused, label, {value, setter}) {
    return div('same-line', [
        button(
            {cls: value ? ["checkbox", "enabled"] : ["checkbox"]}, 
            () => {setter(!value)}
        ),
        span('checkbox-label', [label])
    ])
}

function select(obj, choices, {value, setter}) {

    let options = [];
    for (let i in choices) {
        options.push({
            type: 'option',
            properties: {value: i, selected: value == i},
            children: [choices[i]]
        })
    }

    return Object.assign({}, obj, {
        type: 'select',
        eproperties: {onchange: e => () => {setter(e.value)}},
        children: options
    })
}

function dropTarget(no) {
    return div('drop-target-container', [
        div({cls: ['drop-target'], properties: {drop_no: no}}, [])
    ])
}

function tooltip(text, extra_cls=[], element = button({cls: ['tooltip-container', 'unclickable'], children: ["?"]})) {
    element.cls.push(...extra_cls);
    element.children.push( [span('tooltip', [text])] )
    return element;
}

let expandables_expanded = new Set();

function expandable(id, {parent_cls=[], div_cls=[], button_obj={}, children=[]}) {

    parent_cls.push('expandable-root')
    if(!expandables_expanded.has(id)) {
        parent_cls.push('expandable-hidden')
    }

    return div({id: id, cls: parent_cls}, [
        button(button_obj, () => {
            let div = document.getElementById(id);
            if(div.classList.toggle('expandable-hidden')) {
                expandables_expanded.delete(id);
            }
            else {
                expandables_expanded.add(id);
            }
        }),
        div({cls: ['expandable-on-show', ...div_cls]}, children)
    ])
}


const simpleGroup = name => (p, children) => {
    if(children === undefined) {
        return {type: name, children: p}
    }
    if(typeof p == 'string') {
        return {type: name, cls: [p], children: children}
    }

    return Object.assign({type: name, children: children}, p)
}

const div = simpleGroup('div');
const span = simpleGroup('span');
const h1 = simpleGroup('h1');
const h3 = simpleGroup('h3');


const decos = {
    expandable: [
        span({cls: ['expandable-on-show', 'dimmed']},[`▲`]),
        span({cls: ['expandable-on-hide', 'dimmed']},[`▼`])
    ]
}

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
    select,
    dropTarget,
    expandable,
    decos
};
