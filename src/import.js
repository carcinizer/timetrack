
let file_input = document.getElementById("file");
let error = document.getElementById("error");
let success = document.getElementById("success");

function importData() {
    try {
        let file = file_input.files[0];
        file.text().then(text => {
            let obj = JSON.parse(text);
            browser.runtime.sendMessage({type: "import", content: {data: obj}})
                .then(() => {success.hidden = false;}, displayError)
        })
    }
    catch(x) {displayError(x)}
}
document.getElementById("button").onclick = importData;

function displayError(x) {
    error.innerText = `Error while importing data: ${x.toString()}`
    error.hidden = false;
}

