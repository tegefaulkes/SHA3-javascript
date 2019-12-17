
const _DEBUG = true;

const configs = {
    25:   [25,1,0],
    50:   [50,2,1],
    100:  [100,4,2],
    200:  [200,8,3],
    400:  [400,16,4],
    800:  [800,32,5],
    1600: [1600,64,6]
};
//rounds = 12+2l

class KECCAK_P {
    /**
     * constructor for the KECCAK-P
     * @constructor
     * @param config one of the 6 configuration options in configs.
     * @param rounds number of rounds
     */
    constructor(config, rounds) {
        this.b = config[0];
        this.w = config[1];
        this.l = config[2];
        this.config = config;
        this.rounds = rounds;

    }


    //utils functions.
    mod(m, n) {
        if (m >= 0) {
            return m % n;
        } else {
            return n - (Math.abs(m) % n)
        }
    }

//Step mappings.
    /**
     * implements the Θ mapping.
     * @param A {StateArray} takes the state array
     * @returns StateArray the transformed state array.
     */
    theta(A) {
        //step 1
        let c = new Array(5);
        for (let x = 0; x < 5; x++) {
            c[x] = new Array(5);
            for (let z = 0; z < this.w; z++) {
                c[x][z] = A.getBit(x, 0, z) ^ A.getBit(x, 1, z) ^ A.getBit(x, 2, z) ^ A.getBit(x, 3, z) ^ A.getBit(x, 4, z);
            }
        }

        //step 2
        let d = new Array(5);
        for (let x = 0; x < 5; x++) {
            d[x] = new Array(5);
            for (let z = 0; z < this.w; z++) {
                d[x][z] = c[this.mod(x - 1, 5)][z] ^ c[this.mod(x + 1, 5)][this.mod(z - 1, this.w)];
            }
        }

        //step 3
        let _A = new StateArray(this.config);
        for (let x = 0; x < 5; x++) {
            for (let y = 0; y < 5; y++) {
                for (let z = 0; z < this.w; z++) {
                    _A.setBit(x, y, z, d[x][z]);
                }
            }
        }
        return _A;
    }

    /**
     * implements he ρ mapping
     * @param A {StateArray}
     * @returns StateArray
     */
    rho(A){
        let _A = new StateArray(this.config);
        for (let z = 0; z<this.w; z++){
            _A.setBit(0,0,z,A.getBit(0,0,z));
        }
        let x = 1;
        let y = 0;
        for (let t = 0; t <= 23; t++){
            for(let z = 0; z < this.w; z++){
                let bit = A.getBit(x,y,this.mod((z-(t+1)*((t+2)/2)),this.w));
                _A.setBit(x,y,z,bit);
                let ty = y;
                y = this.mod((2*x+3*y),5);
                x = ty;
            }
        }
        return _A;
    }

    /**
     * implements the π mapping.
     * @param A {StateArray}
     * @returns StateArray
     */
    pi(A){
        let _A = new StateArray(this.config);
        for (let x = 0; x<5; x++){
            for (let y = 0; y<5; y++){
                for (let z = 0; z<5; z++){
                    let bit = A.getBit(this.mod(x + (3*y), 5), x, z);
                    _A.setBit(x,y,z,bit);
                }
            }
        }
        return _A;
    }

    /**
     * Inplements the χ mapping
     * @param A {StateArray}
     * @returns StateArray
     */
    chi(A){
        let _A = new StateArray(this.config);
        for (let x = 0; x<5; x++){
            for (let y = 0; y<5; y++){
                for (let z = 0; z<5; z++){
                    let bit = A.getBit(x,y,z) ^ ((A.getBit(this.mod(x+1,5),y,z) ^ true) & A.getBit(this.mod(x+2,5),y,z));
                    _A.setBit(x,y,z,bit);
                }
            }
        }
        return _A;
    }

    /**
     *
     * @param t {int}
     * @returns boolean
     */
    rc(t){
        if (this.mod(t, 255) === 0) return true;
        let R = [true,false,false,false,false,false,false,false]
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
     * @param A {StateArray}
     * @param roundIndex {int}
     * @returns StateArray
     */
    iota(A, roundIndex){
        let _A = new StateArray(this.config);
        for (let x = 0; x<5; x++){
            for (let y = 0; y<5; y++){
                for (let z = 0; z<5; z++){
                    _A.setBit(x,y,z,A.getBit(x,y,z));
                }
            }
        }

        let RC = new Array(this.w).fill(false);
        for(let j =0; j<= this.l; j++){
            RC[Math.pow(2,j) - 1] = this.rc(j + (7 * roundIndex));
        }
        for(let z = 0; z < this.w; z++){
            let bit = _A.getBit(0,0,z) ^ RC[z];
            _A.setBit(0,0,z, bit)
        }
        return _A
    }

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
     */
    constructor(config){
        this.w = config[1];
        this.b = config[0];
        /**
         *
         * @type {boolean[]}
         */
        this.A = new Array(this.b).fill(0);

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


