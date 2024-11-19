let utilities = {};

utilities.Deferred = class Deferred {
    constructor(options) {
        this.status = "pending";
        this.value;
        this.resolve;
        this.reject;
        //Also store the status and value to expose to outside
        this.promise = new Promise((resolve,reject)=>{
            this.resolve = function (result) {
                this.status = "resolved";
                this.value = result;
                resolve(result);
            };
            this.reject = function (error) {
                this.status = "rejected";
                this.value = error;
                reject(error);
            };
        });
    }
};

//check that file/directory exists
utilities.pathExists = async function (path) {
    const fse = require('fs-extra');

    let defer = new utilities.Deferred();
    try {
        await fse.access(path);
        defer.resolve(true);
    } catch (ex) {
//        console.error(ex);
        defer.resolve(false);
    }
    return defer.promise;
};

module.exports = utilities;

