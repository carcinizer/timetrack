

let overflow = document.body.style.overflow;

let blocker = document.createElement('div')
blocker.className = "timetrack-timeout-blocker"


let h = document.createElement('h1');
h.innerText = "Time's up";
h.className = "timetrack-timeout-content"

let button = document.createElement('input')
button.type = 'button';
button.id = 'timetrack-timeout-more';
button.value = 'Just 5 more minutes...';


function block() {
    overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    blocker.hidden = false;
}

function unblock() {
    document.body.style.overflow = overflow;
    blocker.hidden = true;
    // TODO - 5 more minutes
}

blocker.append(h);
//blocker.append(button);
document.body.appendChild(blocker)
document.getElementById('timetrack-timeout-more').onclick = unblock

block();
