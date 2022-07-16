

var running = running;

if(!running) {
    running = true;

    let blocker = document.createElement('div')
    blocker.id = "timetrack-timeout-blocker"

    let h = document.createElement('h1');
    h.innerText = "Time's up";
    h.className = "timetrack-timeout-content"

    let button = document.createElement('input')
    button.type = 'button';
    button.id = 'timetrack-timeout-more';
    button.value = 'Just 5 more minutes...';


    const blocker_query = () => document.getElementById('timetrack-timeout-blocker');

    function block() {
        document.body.setAttribute('timetrack_block_scrolling', true);
    }

    function unblock(send) {
        document.body.removeAttribute('timetrack_block_scrolling');
        if(send) {
            browser.runtime.sendMessage({
                type: "moreTime", 
                content: {amount: 5*60*1000}
            });
        }
    }


    blocker.append(h);
    blocker.append(button);
    document.body.appendChild(blocker)
    document.getElementById('timetrack-timeout-more').onclick = () => {unblock(true)}

    block();

    browser.runtime.onMessage.addListener(({should_be_blocked, extra_time, max_extra_time}) => {
        button.disabled = extra_time >= max_extra_time;
        if(should_be_blocked) {block()} else {unblock(false)}
    })
}
