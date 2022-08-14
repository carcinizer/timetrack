
var pauser_running = pauser_running;

if(!pauser_running) {
    pauser_running = true;
    let keep_paused = false;

    browser.runtime.onMessage.addListener(({should_be_paused}) => {
        keep_paused = should_be_paused;

        if(!should_be_paused) return;

        for (let i of document.querySelectorAll('audio,video')) {
            i.pause()
            
            if(!i.timetrack_onplay_modified) {
                i.timetrack_onplay_modified = true;

                let old_onplay = i.onplay;

                i.onplay = () => {
                    old_onplay();
                    if(keep_paused) i.pause();
                }
            }
        }
    })
}
