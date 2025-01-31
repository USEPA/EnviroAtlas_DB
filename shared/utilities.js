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

utilities.csv = {
    read: async function (filepath) {
        const fs = require('fs');
        const csv = require('csv');

        let defer = new utilities.Deferred();

        let fields = {};
        let rows = [];
        let rowCount=0;

        fs.createReadStream(filepath)
            .pipe(csv.parse())
            .on('data', (arrayRow) => {
                if (rowCount===0) {
                    fields = arrayRow;
                } else {
                    let objectRow = {};
                    for (let [i,value] of Object.entries(arrayRow)) {
                        let field = fields[i];
                        objectRow[field] = value;
                    }
                    rows.push(objectRow);
                }
                rowCount += 1;
            })
            .on('end', () => {
                defer.resolve({fields,rows});
            });

        return defer.promise
    },
    write: async function (data,filepath) {
        let defer = new utilities.Deferred();
        const fs = require('fs');
        const csv = require('csv');

        const writableStream = fs.createWriteStream(filepath);

        writableStream.on('finish', () => {
            defer.resolve();
        });

        writableStream.on('error', (err) => {
            defer.error(err);
        });

        const stringifier = csv.stringify({ header: true, columns: data.fields });
        stringifier.pipe(writableStream);
        for (let row of data.rows) {
            stringifier.write(row);
        }
        stringifier.end();

        return defer.promise
    }
};

module.exports = utilities;

