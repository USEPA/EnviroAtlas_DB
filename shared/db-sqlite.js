const sqlite3 = require('better-sqlite3');
const appRoot = require('app-root-path');
const utilities = require('@usepa-ngst/utilities/index.cjs');

let db_sqlite = class db_sqlite {
    constructor(options={}) {
        this.config = options.config;
        this.dbfile = options.dbfile;
        this.pragma = options.pragma || 'journal_mode = WAL';

        this.db = sqlite3(this.dbfile);
        this.db.pragma(this.pragma);
    }
    close () {
        this.db.close();
    }
    prepare ({type,table,fields,key,where,limit}) {
        if (!type) throw new Error('type is required to create delete prepare statement');
        if (!table) throw new Error('table is required to create delete prepare statement');
        let statement;
        if (type === 'delete') {
            if (!key) throw new Error('key is required to create delete prepare statement');
            statement = `DELETE FROM ${table} where ${key}=$${key}`;
        } else if (type === 'insert') {
            if (!fields || !fields.length) throw new Error('fields are required to create insert prepare statement');
            let placeholders = [];
            for (let field of fields) {
                placeholders.push(`$${field}`);
            }
            statement = `INSERT INTO ${table} (${fields.join(',')}) values (${placeholders.join(',')})`;
        } else if (type === 'update') {
            if (!fields || !fields.length) throw new Error('fields are required to create insert prepare statement');
            if (!where && !key) throw new Error('where or key is required to create update prepare statement');

            let settings = [];
            for (let field of fields) {
                if (field===key) continue;
                settings.push(`${field} = $${field}`);
            }

             if (!where) {
                where = `${key} = $${key}`;
            }
            statement = `UPDATE ${table} SET ${settings.join(',')} where ${where}`;

        } else if (type === 'select') {
            statement = `SELECT ${fields ? fields.join(',') : '*'} FROM ${table}`;
            if (!where && key) {
                where = `${key} = $${key}`;
            }
            if (where) statement += ` WHERE ${where}`;
            if (limit) statement += ` LIMIT ${limit}`;
        } else if (type === 'schema') {
            statement = `PRAGMA table_info(${table})`;
        }
//        console.log(statement);

        let prepared = this.db.prepare(statement);

        let call = function (args={}) {
            let {type='run',values} = args;
            if (key && !(key in values)) throw new Error('key defined but not contained in values');

            return prepared[type](values || []);
        };

        let run = function (args={}) {
            return call({type: 'run', ...args});
        };

        let all = function (args={}) {
            return call({type: 'all', ...args});
        };

        return {prepared,call,run,all};
    }

    async select(args) {
        let {table,fields,keyValue,where,values,limit} = args;
        let key;
        if (!where && 'keyValue' in args) {
            key = this.config.tables[table].key;
            values = {[key]:keyValue};
        }
        let select = this.prepare({type:'select',table,fields,key,where,limit});
        let result = select.all({values});
        return result;
    }

    //call this schema instead of pragma since that's already being used
    async schema(args) {
        let {table} = args;
        let schema = this.prepare({type:'schema',table});
        let result = schema.all();
        return result;
    }

    async writeFromCSV({csvfile,where}) {
        //get type and table from file name
        let pathLib = require('path');
        let csvfileParsed = pathLib.parse(csvfile);
        let splitFileName = csvfileParsed.name.split('-');
        let table = splitFileName[0];
        let tableConfig = this.config.tables[table];
        if (!tableConfig) throw new Error(`table = ${table} must be set up in db-csv-changes.config`);
//        let requireKeyInCSV = 'requireKeyInCSV' in this.config ? this.config.requireKeyInCSV : true;
        let type = splitFileName[1];
        if (!(['insert','update','delete'].includes(type))) throw new Error(`type = ${type} must be equal to insert, update or delete`);
        let key = tableConfig.key;

        console.log(table,type,key);

        let csvObj = await utilities.csv.read(csvfile);

        //originally fields in csv before we possible add the key on inserts
        let fields = [...csvObj.fields];

        let csvChanged = false;

        let prepareArgs = {type,table,fields,where};
        //if key is in csv fields then set on prepare
        if (fields.includes(key)) prepareArgs.key = key;

        let command = this.prepare(prepareArgs);
        let rowCount=0;
        for (let csvRow of csvObj.rows) {
            rowCount+=1;
            if (type==='insert') {
                if (rowCount===1) {
                    //for first row get the fields for insert
                    let dbRows = await this.select({table,limit:1});
//                    console.log(dbRows);
                    if (!dbRows.length) {
                        console.log(`Warning: Can no validate insert fields because no rows were found in table = ${table}`);
                    }
                    let missingFields = [];
                    let extraFields = {};
                    for (let csvField of Object.keys(csvRow) ) {
                        extraFields[csvField] = 1;
                    }
                    let dbFields = Object.keys(dbRows[0]);
                    for (let dbField of dbFields) {
                        if (dbField!==key && !(dbField in csvRow)) {
                            missingFields.push(dbField);
                        } else {
                            delete extraFields[dbField];
                        }
                    }
                    if (Object.keys(extraFields).length) {
                        console.log(`Warning: The fields ${Object.keys(extraFields).join(',')} from the CSV can not be inserted because they do not exist in the table = ${table}`);
                    }
                    if (missingFields.length) {
                        console.log(`Can no insert CSV into table = ${table} because it is missing the fields ${missingFields.join(',')}`);
                        break;
                    }

                }
                //if key is in fields then need to check to see if this row is already in DB based on key
                if (fields.includes(key)) {
                    let dbRows = await this.select({table,keyValue:csvRow[key],fields:[key]});
//                    console.log(dbRows);
                    //if this key already found in DB continue instead of throwing error
                    if (dbRows.length) {
                        console.log(`key = ${key} with value = ${csvRow[key]} already exists in table = ${table}`);
                        continue;
                    }
                }
            }

            let result = command.run({values:csvRow});

            //check if csv originally has the key. if not then add it in there so we don't get repeats
            if (type==='insert' && !(fields.includes(key))) {
                //if new csv doesn't have key field then need to add it but only once not for every row
                if (!(csvObj.fields.includes(key))) csvObj.fields.unshift(key);
                //get the key value from sqlite lastInsertRowid
                let keyValue=result.lastInsertRowid;
                console.log(keyValue);
                csvRow[key] = keyValue;
                //mark that csv changed so we know whether to update the csv file
                csvChanged = true;
            }
        }
//        console.log(csvObj);
        //if csv changed because row inserted without key and key needs to be added to csv so row isn't inserted again
        if (csvChanged) {
            utilities.csv.write(csvObj,csvfile);
        }
    }

};


module.exports = db_sqlite;

