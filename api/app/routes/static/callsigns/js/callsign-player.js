let playing = false;
let firstOne = true;
const callsignPrefixes = ["K", "KA", "N", "W", "WA", "WB", "AA", "AI"];


function getCallsign() {
    // returns object {prefix,number,suffix}
    const prefix = callsignPrefixes[Math.floor(Math.random() * callsignPrefixes.length)];
    const number = Math.floor(Math.random() * 10); // 0-9
    const suffixLength = Math.floor(Math.random() * 3) + 1; // 1-3 letters
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let suffix = "";
    for (let i = 0; i < suffixLength; i++) {
        suffix += letters[Math.floor(Math.random() * letters.length)];
    }
    const callsignParts = {
        "prefix": prefix,
        "number": number,
            "suffix": suffix
    };
    return callsignParts;
    }

async function playCallsign() {
    const player = new jscw();
    while(playing){
        const callsignParts = getCallsign();
        const part1 = callsignParts.prefix + callsignParts.number
        const part2 = callsignParts.suffix
        const callsign = part1 + part2;
        const wpm = document.getElementById('wpm').value;
        const pspace = document.getElementById('pspace').value;
        const callspace = document.getElementById('callspace').value * 1000;
        const call2space = 5;
        playerText = '';
        if (firstOne){
            playerText = 'vvv   ';
            firstOne = false;
        }            
        playerText = playerText + part1 + ' '.repeat(pspace) 
            + part2  + ' '.repeat(call2space) 
            + callsign;
        
        player.setWpm(wpm);
        player.setFreq(600);
        document.getElementById('callsignDisplay').textContent = ' '
        player.play(playerText);
        n = player.getLength(playerText)*1000;
        // Display callsign after it is played.
        setTimeout(function(){
            document.getElementById('callsignDisplay').textContent = callsign;

        },n);
        // Wait call2space then play next
        await new Promise(resolve => setTimeout(resolve, n + callspace)); 
    }
}    

function startPlayback() {
    if (!playing) {
        playing = true;
        firstOne = true;
        playCallsign();
        }
    }
function stopPlayback() {
    playing = false;
    }
    