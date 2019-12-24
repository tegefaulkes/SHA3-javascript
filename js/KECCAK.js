


//TODO: verify that the keccak_P and maping functions are all functioning as intended.
//TODO: test sponge implementation.

const _DEBUG = true;


/**
 * @typedef config
 * @constant
 * @property {int} b width
 * @property {int} w lane size
 * @property {int} l permutation class
 */

/**
 *
 * @param b {int} width
 * @param w {int} lane size
 * @param l {int} permutation class
 * @returns {config}
 */
function configGen(b, w, l){
    /**
     * @type {config}
     */
    return {b: b, w: w, l: l}
}

const configs = {
    0:  configGen(25,1,0),
    1:  configGen(50,2,1),
    2:  configGen(100,4,2),
    3:  configGen(200,8,3),
    4:  configGen(400,16,4),
    5:  configGen(800,32,5),
    6:  configGen(1600,64,6)
};
//rounds = 12+2l

/**
 * @const
 * @typedef State
 * @type {object}
 * @property {config} config - config storage.
 * @property {int} rounds - number of rounds.
 * @property {int} round - current round.
 * @property {StateArray} A - current state array.
 */

/**
 *  state generator.
 * @param {config} config
 * @param message {boolean[]} the message block being hashed.
 * @returns {State} a variable for tracking state.
 */
function initState(config = configs[6], message = blankS(config)){
    if(message.length !== config.b) throw "Message is an invalid length.";
    return {
        config: config,
        rounds:  12 + 2*config.l,
        round: 0,
        A: new StateArray(config, message)
    };
}

/**
 * clones the state for returning to avoid side effects.
 * @param {State} state - the current state.
 */
function cloneState(state){
    return {...state};
}


//utils functions.

function xor(a,b){
    return (a || b) && !(a && b);
}

/**
 *
 * @param {boolean[]} A
 * @param {boolean[]} B
 * @returns {boolean[]} A XOR B
 */
function xOrStrings(A,B){
    if( A.length !== B.length) throw "Lengths do not match.";
    let C = new Array(A.length);//.fill(false);
    for (let i = 0; i<A.length; i++){
        C[i] = xor(A[i],B[i]);
    }
    return C;
}

function ByteToBitString(string){
//string = "A69F73CCA23A9AC5C8B567DC185A756E97C982164FE25859E0D1DCC1475C80A615B2123AF1F5F94C11E3E9402C3AC558F500199D95B6D3E301758586281DCD26364BC5B8E78F53B823DDA7F4DE9FAD00E67DB72F9F9FEA0CE3C9FEF15A76ADC585EB2EFD1187FB65F9C9A273315167E314FA68B6A322D407015D502ACDEC8C885C4F7784CED04609BB35154A96484B5625D3417C88607ACDE4C2C99BAE5EDF9EEA2AD0FB55A226189E11D24960433E2B0EE045A473099776DD5DE739DB9BA819D54CB903A7A5D7EE"
    let sets = [];
    for (let i = 0; i<25; i++){
        let tmp = string.slice(i*16,(i+1)*16);
        let groups = [];
        for (let j = 0; j<8; j++){
            groups[7-j] = tmp.slice(j*2, (j+1)*2);
        }
        sets[i] = groups.join('');
    }
    return sets.join('');
}

function mod(m, n) {
    if(m%n === 0) return 0;
    if (m >= 0) {
        return m % n;
    } else {
            return n - (Math.abs(m) % n)
        }
}

/**
 *
 * @param {boolean[]} S message array.
 * @returns {string} message in binary.
 */
function sToHex(S){
    let _S = [...S.map((x) => String(false+x))];
    let subArray = _S.slice(0,4);
    let newArray = [];
    let x = 0;
    while(subArray .length !== 0){
        newArray.push(subArray.join(''));
        x++;
        subArray = _S.slice(x*4,x*4+4);
    }
    return newArray.map((x) => parseInt(x,2).toString(16)).join('').toUpperCase();
}

/**
 *
 * @param {boolean[]} S message array.
 * @returns {string} message in binary.
 */
function sToBin(S){
    let _S = [...S.map((x) => String(false+x))];
    let subArray = _S.slice(0,4);
    let newArray = [];
    let x = 0;
    while(subArray .length !== 0){
        newArray.push(subArray.join(''));
        x++;
        subArray = _S.slice(x*4,x*4+4);
    }
    return newArray.map((x) => parseInt(x,2).toString(2)).join('').toUpperCase();
}

function sToHexFormatted(S){
    let hex = sToHex(S);
    let len = hex.length;
    let outString = "";
    for (let x = 0; x<12; x++){
        for (let y = 0; y < 16; y++){
            if(x === 11 && y >= 8) break;
            outString += hex.slice(x*32+y*2,x*32+y*2 + 2)+" "
        }
        outString += "\n";
    }
    //for (let i = 0; i < 8)
    console.log(outString);
}

/**
 *
 * @param {StateArray} S
 */
function sPrintLanes(S){
    let outString = "";
    for (let y = 0; y< 5; y++){
        for (let x = 0; x<5; x++){
            outString += `[${x}, ${y}] = ${sToHex(S.A.getStringLane(x,y)).split("0").join("-")} \n`;
        }
    }

    console.log(outString);
}

/**
 *
 * @param {config} config
 * @param {boolean} fill - fill array with true or false
 * @returns {boolean[]} sArray
 */
function blankS(config = configs[6], fill = false){
    return new Array(config.b).fill(fill);
}

/**
 *
 * @param {string} hex - the input string.
 * @returns {boolean[]} S - state
 */
function hexToS(hex){
    const mapping = {
        "0" : [false,false,false,false],
        "1" : [false,false,false,true],
        "2" : [false,false,true,false],
        "3" : [false,false,true,true],
        "4" : [false,true,false,false],
        "5" : [false,true,false,true],
        "6" : [false,true,true,false],
        "7" : [false,true,true,true],
        "8" : [true,false,false,false],
        "9" : [true,false,false,true],
        "A" : [true,false,true,false],
        "B" : [true,false,true,true],
        "C" : [true,true,false,false],
        "D" : [true,true,false,true],
        "E" : [true,true,true,false],
        "F" : [true,true,true,true],
        "a" : [true,false,true,false],
        "b" : [true,false,true,true],
        "c" : [true,true,false,false],
        "d" : [true,true,false,true],
        "e" : [true,true,true,false],
        "f" : [true,true,true,true]
    };
    return hex.split('').map((x) => mapping[x]).flat()
}

//Step mappings.
/**
 * implements the Θ mapping.
 * @param {State} state - the current state.
 * @returns {State} _state - the new state.
 */
function theta(state) {
    const config = state.config;
    const A = state.A;
    let _A = new StateArray(config, blankS(config));
    //step 1
    let c = new Array(5);
    for (let x = 0; x < 5; x++) {
        c[x] = new Array(config.w);
        for (let z = 0; z < config.w; z++) {
            c[x][z] = xor(xor(xor(xor(A.getBit(x, 0, z), A.getBit(x, 1, z)), A.getBit(x, 2, z)), A.getBit(x, 3, z)), A.getBit(x, 4, z));
            if(c[x][z])console.log(`C[${x},${z}] parity of ${c[x][z]};`,A.getBit(x,0,z),A.getBit(x,1,z),A.getBit(x,2,z),A.getBit(x,3,z),A.getBit(x,4,z));
            //c[x][z]? console.log(`C[${x},${z}]`):"";
        }
    }
    //console.log("C",c.flat().flat().map((x) => x^0).join(''));
    console.log(`c[1,1] = ${c[1][1]}`);
    console.log(`c[3,0] = ${c[3][0]}`);

    //step 2
    let d = new Array(5);
    for (let x = 0; x < 5; x++) {
        d[x] = new Array(config.w);
        for (let z = 0; z < config.w; z++) {
            //console.log(mod(x - 1, 5),z,":",mod(x + 1, 5),mod(z - 1, config.w) );
            d[x][z] = xor(c[mod(x - 1, 5)][z], c[mod(x + 1, 5)][mod(z + 1, config.w)]);
            (x === 2 && z ===1)? console.log("checking",c[mod(x - 1, 5)][z],c[mod(x + 1, 5)][mod(z - 1, config.w)],mod(x + 1, 5),mod(z - 1, config.w)):"";
        }
    }
    //console.log("d",d.flat().flat().map((x) => x^0).join(''));
    //console.log(`d[2] = ${d[2].map((x) => x^0).join('')}`);
    //console.log(`d[4] = ${d[4].map((x) => x^0).join('')}`);

    //step 3
    for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
            for (let z = 0; z < config.w; z++) {
                _A.setBit(x, y, z, xor(A.getBit(x,y,z),d[x][z]));
            }
        }
    }
    //console.log(_A.A.flat().flat().map((x) => x^0).join(''));
    let _state = cloneState(state);
        _state.A = _A;
    return _state
} //WORKING?

/**
 * implements he ρ mapping
 * @param {State} state the current state.
 * @returns {State} _state - the new state.
 */
function rho(state){
    const config = state.config;
    const A = state.A;
    let _A = new StateArray(config, blankS(config));

    for (let z = 0; z<config.w; z++){
        _A.setBit(0,0,z,A.getBit(0,0,z));
    }

    let x = 1;
    let y = 0;
    let ty = 0;
    for (let t = 0; t < 24; t++){
        for(let z = 0; z < config.w; z++){
            //console.log(z,mod(z+((t+1)*((t+2)/2)),config.w))
            let shift = (t+1)*((t+2)/2);
            let bit = A.getBit(x,y,mod(z+shift,config.w));
            _A.setBit(x,y,z,bit);
        }
        //console.log("");
        ty = y;
        y = mod((2*x+3*y),5);
        x = ty;
    }
    let _state = cloneState(state);
    _state.A = _A;
    return _state;
} //WORKING

/**
 * implements the π mapping.
 * @param {State} state
 * @returns {State} _state
 */
function pi(state){
    const config = state.config;
    const A = state.A;
    let _A = new StateArray(config,blankS(config));
    for (let x = 0; x<5; x++){
        for (let y = 0; y<5; y++){
            for (let z = 0; z<config.w; z++){
                let bit = A.getBit(mod(x + (3*y), 5), x, z);
                _A.setBit(x,y,z,bit);
            }
        }
    }

    let _state = cloneState(state);
    _state.A = _A;
    return _state;
} //WORKING

/**
 * Inplements the χ mapping
 * @param {State} state
 * @returns {State} _state
 */
function chi(state){
    const config = state.config;
    const A = state.A;
    let _A = new StateArray(config, blankS(config));
    for (let x = 0; x<5; x++){
        for (let y = 0; y<5; y++){
            for (let z = 0; z<config.w; z++){
                let bit = xor(A.getBit(x,y,z), (xor(A.getBit(mod(x+1,5),y,z), true) && A.getBit(mod(x+2,5),y,z)));
                //console.log(bit);
                _A.setBit(x,y,z,bit);
            }
        }
    }
    let _state = cloneState(state);
    _state.A = _A;
    return _state;
} //WORKING

/**
 *
 * @param t {int}
 * @returns boolean
 */
function rc(t){
    if (mod(t, 255) === 0) return true;
    let R = [true,false,false,false,false,false,false,false];
    for(let i = 1; i<=mod(t,255); i++){
        R = [false].concat(R);
        R[0] = xor(R[0], R[8]);
        R[4] = xor(R[4], R[8]);
        R[5] = xor(R[5], R[8]);
        R[6] = xor(R[6], R[8]);
        R = R.slice(0,8);
    }
    return R[0];
} //WORKING probs

/**
 * Implements the ι mapping.
 * @param {State} state
 * @returns {State} _state
 */
function iota(state){
    const config = state.config;
    const A = state.A;
    const roundIndex = state.round;
    let _state = cloneState(state);
    let _A = _state.A; //new StateArray(config, blankS(config));


    // for (let x = 0; x<5; x++){
    //     for (let y = 0; y<5; y++){
    //         for (let z = 0; z<config.w; z++){
    //             _A.setBit(x,y,z,A.getBit(x,y,z));
    //         }
    //     }
    // }

    let RC = new Array(config.w).fill(false); //blankS(config);
    for(let j =0; j <= config.l; j++){
        RC[Math.pow(2,j) - 1] = rc(j + (7 * roundIndex));
    }

    for(let z = 0; z < config.w; z++){
        let bit = xor(_A.getBit(0,0,z), RC[config.w-z-1]);
        _A.setBit(0,0,z, bit)
    }
    //let _state = cloneState(state);
    _state.A = _A;
    return _state;
} //WORKING... probably

/**
 * completes one round of mapping.
 * @param {State} state
 * @returns {State} _state
 */
function rnd(state){
    const endstate = iota(chi(pi(rho(theta(state)))));
    return cloneState(endstate);
} //Should be working now.


class keccak_P_stepped{
    constructor(config = configs[6], message = blankS(config)) {
        /** @type {State} */
        this.state = initState(config, message);
        this.breakRound = this.state.rounds;
    }

    /**
     * checks if the rounds are done.
     * @returns {boolean}
     */
    roundsDone(){
        return this.state.round >= this.state.rounds
    }

    step(){
        if(!this.roundsDone()) {
            let _state = rnd(this.state);
            _state.round = this.state.round + 1;
            this.state = _state;
        }
    }

    setBreak(brek){
        this.breakRound = brek;
    }

    atBreak(){
        return this.state.round === this.breakRound;
    }

    continue(){
        while(!(this.roundsDone() || this.atBreak())){
            this.step();
        }
    }

    getResult(){
            return this.state.A.getStateString();
    }
}

function keccakP(config = config[6], message = blankS(config)){
    let kek = new keccak_P_stepped(config, message);
    kek.continue();
    return kek.getResult();
}


/**
 * stores the state array and utility functions.
 * @class
 */
class StateArray{
    /**
     * constructor for the state array.
     * @constructor
     * @param {config} config the config as defined in configs
     * @param S {boolean[]} message string.
     */
    constructor(config = configs[6], S = blankS(config)){
        this.w = config.w;
        this.b = config.b;
        if(S.length !== config.b) throw "message string is an invalid size.";
        /** @type {boolean[]}*/
        this.A = S //new Array(this.b).fill(0);

    }

    /**
     * returns the bit at (x,y,z)
     * @param {int} x - the x position
     * @param {int} y - the y position
     * @param {int} z - the z position
     * @returns {boolean} the value of the bit
     */
    getBit(x, y, z){
        this.rangeCheck(x,y,z);
        const n = this.w*(5*y+x)+z;
        return this.A[n];
    }

    /**
     * Sets the bit at (x,y,z).
     * @param x {int}
     * @param y {int}
     * @param z {int}
     * @param bit {boolean}
     */
    setBit(x,y,z,bit){
        this.rangeCheck(x,y,z);
        const n = this.w*(5*y+x)+z;
        this.A[n] = bit;
    }

    /**
     *
     * @param {int} x 0<x<5
     * @param {int} y 0<x<5
     * @returns {boolean[]} - An array of the lane bits, length w.
     */
    getStringLane(x,y){
        this.rangeCheck(x,y,0);
        let offset = this.w*(5*y+x);
        return this.A.slice(offset,offset+this.w)
    }

    /**
     *
     * @param y {int} range 0<y<5
     * @returns {boolean[]}
     */
    getStringPlane(y){
        this.rangeCheck(0,y,0);
        let start = this.w * 5 * y;
        return this.A.slice(start, start+(5*this.w));
    }

    /**
     *
     * @returns {boolean[]} the state array of length b
     */
    getStateString(){
        return this.A.slice(0);
    }

    /**
     *
     * @param array {boolean[]} the state array of length b
     */
    setStateArray(array){
        this.A = array.slice(0);
    }

    /**
     * Throws an exception if values exceed valid range.
     * @param x {int} range 0<x<5
     * @param y {int} range 0<y<5
     * @param z {int} range 0<z<w
     */
    rangeCheck(x,y,z){
        if(!_DEBUG) return;
        if(x>4 || x<0) throw "x value exceeds valid range.";
        if(y>4 || y<0) throw "y value exceeds valid range.";
        if(z>this.w || z<0) throw "z value exceeds valid range.";
    }
}


//sponge construction.

/**
 * returns the padding array.
 * @param {int} x
 * @param {int} m
 * @returns {boolean[]}
 */
function pad(x, m){
    let j = mod(-m - 2, x);
    return [true].concat(new Array(j).fill(false),[true]);
}


/**
 * @param {config} config
 * @param {boolean[]} N message array.
 * @param {int} d ?
 * @param {int} r ?
 * @returns {boolean[]} Z output of length d.
 */
function SPONGE(config, N, d, r){ //TODO test this.
    /**
     *
     * @param {int} i index.
     * @param {boolean[]} P
     * @param {int} r substring width.
     * @returns {boolean[]} Pi substring.
     */
    function getSubP(i,P,r){
            return P.slice(i*r, i*r+r);
    }
    let b = config.b;

    let P = N.concat(pad(r,N.length));
    let n = P.length/r;
    let c = b-r;
    let S = blankS(config);

    //Absorbing stage.
    for(let i = 0; i< n; i++){
        S = keccakP(config, xOrStrings( S,getSubP(i,P,r).concat(new Array(c).fill(false))));
    }

    console.log("S; ", S);
    //squeezing stage.
    let Z = [];
    while(Z.length <= d){
        Z = Z.concat(S.slice(0,r));
        S = keccakP(config,S);
    }
    console.log("Z; ",Z);
    return Z.slice(0, d);
}

/**
 *
 * @param {int} c - Capacity.
 * @param {boolean[]} N - the message.
 * @param {int} d
 * @param {config} config - the config.
 * @returns {boolean[]} the hashed message.
 */
function keccak(c,N,d,config = configs[6]){
    return SPONGE(config, N, d, config.b - c);
}


function SHA3_224(M){
    return keccak(448, M.concat([false,true]), 224);
}

function SHA3_256(M){
    return keccak(512, M.concat([false,true]), 256)
}

function SHA3_384(M){
    return keccak(768, M.concat([false,true]), 384)
}

function SHA3_512(M){
    return keccak(1024, M.concat([false,true]), 512)
}

//testing.
/**
 *
 * @param {string} string
 * @returns {State}
 */
function stateFromString(string){
    return initState(configs[6], hexToS(ByteToBitString(string)));
}

/**
 *
 * @param {state} A
 * @param {state} B
 */
function bitDifference(A, B){
    return initState(configs[6],xOrStrings(A.A.A,B.A.A));
}


// // theta test
// state = stateFromString("0600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
// console.log("start");
// sPrintLanes(state);
// state = theta(state);
// console.log("after map");
// sPrintLanes(state);
// endstate = stateFromString("06000000000000000600000000000000010000000000000000000000000000000C0000000000008000000000000000000600000000000000010000000000000000000000000000800C0000000000008000000000000000000600000000000000010000000000000000000000000000000C0000000000008000000000000000000600000000000000010000000000000000000000000000000C0000000000008000000000000000000600000000000000010000000000000000000000000000000C00000000000080");
// console.log("difference");
// sPrintLanes(bitDifference(state, endstate));
// console.log("should be");
// sPrintLanes(endstate);


// //rho test confirmed working.
// state = stateFromString("06000000000000000600000000000000010000000000000000000000000000000C0000000000008000000000000000000600000000000000010000000000000000000000000000800C0000000000008000000000000000000600000000000000010000000000000000000000000000000C0000000000008000000000000000000600000000000000010000000000000000000000000000000C0000000000008000000000000000000600000000000000010000000000000000000000000000000C00000000000080");
// state = rho(state);
// endstate = stateFromString("06000000000000000C0000000000000000000000000000400000000000000000000000640000000000000000000000000000000000600000400000000000000000000000000040000000C800000000000000000000000000001800000000000000000000000800000000000000000000000000004006000000000000000000000000000000C0000000800000000000000000000000000000800C00000000000000000000000000001800000000000000000000000000002000000000000000000020030000000000");
// sPrintLanes(bitDifference(state,endstate));

//console.log(ByteToBitString());
// state = stateFromString("A69F73CCA23A9AC5C8B567DC185A756E97C982164FE25859E0D1DCC1475C80A615B2123AF1F5F94C11E3E9402C3AC558F500199D95B6D3E301758586281DCD26364BC5B8E78F53B823DDA7F4DE9FAD00E67DB72F9F9FEA0CE3C9FEF15A76ADC585EB2EFD1187FB65F9C9A273315167E314FA68B6A322D407015D502ACDEC8C885C4F7784CED04609BB35154A96484B5625D3417C88607ACDE4C2C99BAE5EDF9EEA2AD0FB55A226189E11D24960433E2B0EE045A473099776DD5DE739DB9BA819D54CB903A7A5D7EE");
// sPrintLanes(state);

// Pi test.
// state = stateFromString("06000000000000000C0000000000000000000000000000400000000000000000000000640000000000000000000000000000000000600000400000000000000000000000000040000000C800000000000000000000000000001800000000000000000000000800000000000000000000000000004006000000000000000000000000000000C0000000800000000000000000000000000000800C00000000000000000000000000001800000000000000000000000000002000000000000000000020030000000000");
// sPrintLanes(state);
// sPrintLanes(pi(state));
// sPrintLanes(stateFromString("0600000000000000000000000060000000000000000800000000000000000000002003000000000000000000000000000000C8000000000000000000000000000000000000C0000000000000000000200C0000000000000040000000000000000000000000000000800C00000000000000000000000000000000006400000000000000000000000000180000000000000080000000000000000000000000000000000000000000400000000000004000000000004006000000000000000000001800000000000000"));

//chi test confirmed working.
// state = stateFromString("0600000000000000000000000060000000000000000800000000000000000000002003000000000000000000000000000000C8000000000000000000000000000000000000C0000000000000000000200C0000000000000040000000000000000000000000000000800C00000000000000000000000000000000006400000000000000000000000000180000000000000080000000000000000000000000000000000000000000400000000000004000000000004006000000000000000000001800000000000000");
// state = chi(state);
// endstate = stateFromString("0600000000080000000000000060000000200300000800000600000000000000002003000060000000000000000000000000C80000C0000000000000000000200000000000C000000000C800000000200C00000000000000C00C00000000000000000000000000008C0C00000000000040000000000000000018006400000000008000000000000000180000000000000080006400000000000000000000000000000000400600400000000000004000180000004006000000000000000000401800000000004000");
// sPrintLanes(endstate);
// sPrintLanes(bitDifference(state, endstate));
//

//Iota test confirmed maybe? probably
// state = stateFromString("0600000000080000000000000060000000200300000800000600000000000000002003000060000000000000000000000000C80000C0000000000000000000200000000000C000000000C800000000200C00000000000000C00C00000000000000000000000000008C0C00000000000040000000000000000018006400000000008000000000000000180000000000000080006400000000000000000000000000000000400600400000000000004000180000004006000000000000000000401800000000004000");
// state = iota(state);
// endstate = stateFromString("0700000000080000000000000060000000200300000800000600000000000000002003000060000000000000000000000000C80000C0000000000000000000200000000000C000000000C800000000200C00000000000000C00C00000000000000000000000000008C0C00000000000040000000000000000018006400000000008000000000000000180000000000000080006400000000000000000000000000000000400600400000000000004000180000004006000000000000000000401800000000004000");
// sPrintLanes(bitDifference(state, endstate));


// state = stateFromString("DD395A01022CED2855162019BDA283664626212302AD8E7BD6195615BFB2CDC81036052300BB22F144C219E48A5718060D00C6C98BAC0C1198FCD013C8040106C40058E4023316DDB032DF10C9AC0A58E2D08C8048CF038068E9593236809410980280AFA82F0319B2CCB0082C60DC000CA600D55A054889E4E981F7F41C280520007ACAE6F9A385587992191A816B28A440EA604478409578951348CC01A3B837AD5C3260645E2034CA00A206D031E072E0771060255E01DB0D62A041B0539464E21990064B2055");
// state.round = 1;
// state = iota(state);
// endstate = stateFromString("5FB95A01022CED2855162019BDA283664626212302AD8E7BD6195615BFB2CDC81036052300BB22F144C219E48A5718060D00C6C98BAC0C1198FCD013C8040106C40058E4023316DDB032DF10C9AC0A58E2D08C8048CF038068E9593236809410980280AFA82F0319B2CCB0082C60DC000CA600D55A054889E4E981F7F41C280520007ACAE6F9A385587992191A816B28A440EA604478409578951348CC01A3B837AD5C3260645E2034CA00A206D031E072E0771060255E01DB0D62A041B0539464E21990064B2055");
// sPrintLanes(bitDifference(state, endstate));

//full round test.
state = stateFromString("0600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
state = rnd(state);
endstate = stateFromString("0700000000080000000000000060000000200300000800000600000000000000002003000060000000000000000000000000C80000C0000000000000000000200000000000C000000000C800000000200C00000000000000C00C00000000000000000000000000008C0C00000000000040000000000000000018006400000000008000000000000000180000000000000080006400000000000000000000000000000000400600400000000000004000180000004006000000000000000000401800000000004000");
sPrintLanes(bitDifference(state, endstate));
