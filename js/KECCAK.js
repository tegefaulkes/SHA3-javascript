
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
 * @param level {int} the config level
 * @param message {boolean[]} the message block being hashed.
 * @returns {State} a variable for tracking state.
 */
function initState(level, message){
    let config = configs[level];
    if(message.length != config[0]) throw "Message is an invalid length.";
    return {
        config: config,
        rounds:  21 + 2*config[2],
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
    function mod(m, n) {
        if (m >= 0) {
            return m % n;
        } else {
            return n - (Math.abs(m) % n)
        }
    }

/**
 *
 * @param {config} config
 * @param {boolean} fill - fill array with true or false
 * @returns {boolean[]} sArray
 */
function blankS(config, fill = false){
    return new Array(config.b).fill(fill);
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
        c[x] = new Array(5);
        for (let z = 0; z < config.w; z++) {
            c[x][z] = A.getBit(x, 0, z) ^ A.getBit(x, 1, z) ^ A.getBit(x, 2, z) ^ A.getBit(x, 3, z) ^ A.getBit(x, 4, z);
        }
    }

    //step 2
    let d = new Array(5);
    for (let x = 0; x < 5; x++) {
        d[x] = new Array(5);
        for (let z = 0; z < config.w; z++) {
            d[x][z] = c[mod(x - 1, 5)][z] ^ c[mod(x + 1, 5)][mod(z - 1, w)];
        }
    }

    //step 3
    for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
            for (let z = 0; z < config.w; z++) {
                _A.setBit(x, y, z, d[x][z]);
            }
        }
    }
    let _state = cloneState(state);
        _state.A = _A;
    return _state
}

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
    for (let t = 0; t <= 23; t++){
        for(let z = 0; z < config.w; z++){
            let bit = A.getBit(x,y,mod((z-(t+1)*((t+2)/2)),config.w));
            _A.setBit(x,y,z,bit);
            let ty = y;
            y = mod((2*x+3*y),5);
            x = ty;
        }
    }
    let _state = cloneState(state);
    _state.A = _A;
    return _state;
}

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
}

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
                let bit = A.getBit(x,y,z) ^ ((A.getBit(mod(x+1,5),y,z) ^ true) && A.getBit(mod(x+2,5),y,z));
                _A.setBit(x,y,z,bit);
            }
        }
    }
    let _state = cloneState(state);
    _state.A = _A;
    return _state;
}

/**
 *
 * @param t {int}
 * @returns boolean
 */
function rc(t){
    if (mod(t, 255) === 0) return true;
    let R = [true,false,false,false,false,false,false,false];
    for(let i = 0; i<=t; i++){
        R = [false].concat(R);
        R[0] = R[0] ^ R[8];
        R[4] = R[4] ^ R[8];
        R[5] = R[5] ^ R[8];
        R[6] = R[6] ^ R[8];
        R = R.slice(0,8);
    }
    return R[0];
}

/**
 * Implements the ι mapping.
 * @param {State} state
 * @returns {State} _state
 */
function iota(state){
    const config = state.config;
    const A = state.A;
    const roundIndex = state.round;
    let _A = new StateArray(config, blankS(config));

    for (let x = 0; x<5; x++){
        for (let y = 0; y<5; y++){
            for (let z = 0; z<config.w; z++){
                _A.setBit(x,y,z,A.getBit(x,y,z));
            }
        }
    }

    let RC = blankS(config);
    for(let j =0; j<= config.l; j++){
        RC[Math.pow(2,j) - 1] = rc(j + (7 * roundIndex));
    }
    for(let z = 0; z < configw; z++){
        let bit = _A.getBit(0,0,z) ^ RC[z];
        _A.setBit(0,0,z, bit)
    }
    let _state = cloneState(state);
    _state.A = _A;
    return _state;
}


/**
 * stores the state array and utility functions.
 * @class
 */
class StateArray{
    /**
     * constructor for the state array.
     * @constructor
     * @param config the config as defined in configs
     * @param S {boolean[]} message string.
     */
    constructor(config, S){
        this.w = config.w;
        this.b = config.b;
        if(message.length == config.b) throw "message string is an invalid size.";
        /**
         *
         * @type {boolean[]}
         */
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
     * @returns {*[]} - An array of the lane bits, length w.
     */
    stringLane(x,y){
        this.rangeCheck(x,y,0);
        let offset = this.w*(5*y+x);
        return this.A.slice(offset,offset+this.w)
    }

    /**
     *
     * @param y {int} range 0<y<5
     * @returns {boolean[]}
     */
    stringPlane(y){
        this.rangeCheck(0,y,0);
        let start = this.w * 5 * y;
        return this.A.slice(start, start+(5*this.w));
    }

    /**
     *
     * @returns {boolean[]} the state array of length b
     */
    getStateString(){
        return this.A;
    }

    /**
     *
     * @param array {boolean[]} the state array of length b
     */
    setStateArray(array){
        this.A = array;
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


