#!/usr/bin/env node

const appRoot = require('app-root-path');
const fse = require('fs-extra');
const utilities = require(appRoot + '\\shared\\utilities');
const db_sqlite = require(appRoot + '\\shared\\db-sqlite');
const config = require(appRoot + '\\scripts\\db-csv-changes.config');

//this just to mock up something for now
let dbSources = {local:'',staging:'local',prod:'staging'};

//const devLink = require('./index.js');

(async function () {
    try {
        let help = [];
        help.push('This tool imports data into sqlite from csv.');
        help.push('csv files saved in dev folder will be imported into staging db and csv files moved to staging folder');
        help.push('csv files saved in staging folder will be imported into prod db and csv files moved to prod folder');
        help.push('');
        help.push('db-csv-changes <cmd> <db> <change>');
        help.push('');
        help.push('cmd = list, load or deploy');
        help.push('');
        help.push('list: list all changes in db=<db>');
        help.push('eg. db-csv-changes list staging would list all csv change folders in staging folder');
        help.push('');
        help.push('init: create insert file with header in change = <change> for table=<table> in db=<db>');
        help.push('eg. db-csv-changes init staging change1 layers would create staging/change2/layers-insert.csv file with all fields as header');
        help.push('');
        help.push('load: load change = <change> to db=<db>');
        help.push('eg. db-csv-changes load staging * would import all csv files in staging folder to staging db');
        help.push('');
        help.push('deploy: deploy change = <change> to db=<db> from db one level down and move csv file to db=<db> folder</db>');
        help.push('eg. db-csv-changes deploy prod change1 would import csv files in staging/change1 folder into prod db and then move staging/change1 folder to prod folder');
        help.push('');
        help.push('db = local, staging or prod (local not committed to repo. just for development.)');
        help.push('');
        help.push('change = name of folder with csv files containing changes. Note: change = * will import all folders for specified db');

        let args = require('minimist')(process.argv.slice(2));

        let cmd = "";
//        cmd = "list";
//        cmd = "init";
//        cmd = "load";
//        cmd = "deploy";
        if (args._.length>0) cmd = args._[0];

        let db = "";
//        db = "local";
//        db = "staging";
//        db = "prod";
        if (args._.length>1) db = args._[1];

        let change = "";
//        change = "change1";
//        change = "change2";
//        change = "change3";
        if (args._.length>2) change = args._[2];

        let table = "";
//        table = "layers";
//        table = "subtopics";
        if (args._.length>3) change = args._[3];

        if (cmd) {
            if (!db) throw 'db is required';
            let dbfile = `${appRoot.path}\\db\\${db}\\${db}.db`;
            let dbLib = new db_sqlite({dbfile,config});

            if (['deploy','load'].includes(cmd)) {
                if (cmd==='deploy' && !['staging','prod'].includes(db)) {
                    throw 'change can only be deployed to db = staging or prod';
                }
                if (!change) {
                    throw 'change folder name is required for cmd=deploy or load';
                }

                let srcDb;
                let destDb;
                if (cmd==='deploy') {
                    srcDb = dbSources[db];
                    destDb = db;
                } else if (cmd==='load') {
                    //if just loading then src and dest is same db
                    srcDb = db;
                    destDb = db;
                }
                let changeFolders;
                if (change==='*')  {
                    changeFolders = await getAllChangeFiles(srcDb);
                } else {
                    changeFolders = [change];
                }

                for (let changeFolder of changeFolders) {
                    let srcChangeFolder = `${appRoot.path}\\changes\\${srcDb}\\${changeFolder}`;
                    let destChangeFolder = `${appRoot.path}\\changes\\${destDb}\\${changeFolder}`;
                    //                   console.log(src);
                    //                   console.log(dest);
                    let sourceExists = await utilities.pathExists(srcChangeFolder);
                    if (!sourceExists) {
                        throw `change = ${change} does not exist in source db = ${srcDb}`;
                    }

                    if (['deploy','load'].includes(cmd)) {
                        //have to write csv changes to DB. then copy to deployed folder if applicable
                        let changeFiles = await fse.readdir(srcChangeFolder);
                        for (let changeFile of changeFiles) {
                            await dbLib.writeFromCSV({csvfile:`${srcChangeFolder}\\${changeFile}`});
                        }
                        if (!changeFolders.length) {
                            console.log(`No change files avaiable in change folder = ${srcChangeFolder} for import to dest db = ${db}`);
                        }
                        if (cmd==='deploy') {
                            await fse.move(srcChangeFolder,destChangeFolder);
                        }
                    }

                    console.log(srcDb + '/' + changeFolder + ' loaded into ' + destDb);
                }
                if (!changeFolders.length) {
                    console.log(`No change folders avaiable for import to dest db = ${db}`);
                }

            } else if (cmd==='init') {

                //check if change folder exists
                if (!change) {
                    throw 'change folder name is required for cmd=init';
                }
                let changeFolder = `${appRoot.path}\\changes\\${db}\\${change}`;
                let changeExists = await utilities.pathExists(changeFolder);
                if (!changeExists) {
                    await fse.mkdir(changeFolder);
                }
                //if table passed then create insert csv file with all fields in header but no rows
                if (table) {
                    //check if insert csv file already exists
                    let insertCsvfile = `${changeFolder}\\${table}-insert.csv`;

                    let insertExists = await utilities.pathExists(insertCsvfile);
                    if (!insertExists) {
                        //get all the fields in the passed table to create header with
                        let dbSchema = await dbLib.schema({table:table});
                        console.log(dbSchema);
                        let dbFields = dbSchema.map(item=>item.name);
                        let csvObj = {fields:dbFields,rows:[]};
                        await utilities.csv.write(csvObj,insertCsvfile);

                        console.log(`Insert CSV file ${insertCsvfile} initialized`)
                    } else {
                        console.log(`Warning: insert CSV file ${insertCsvfile} already exists`)
                    }


                }
            } else if (cmd==='list') {
//just list folders
                let files = await getAllChangeFiles(db);
                console.log(`Change files in db = ${db}`);
                for (let file of files) {
                    console.log(file);
                }
                if (!files.length) {
                    console.log('None');
                }
            } else {
                throw `cmd = ${cmd} must be list, load or deply`;
            }

        } else {
            help.forEach((line)=>console.log(line));
        }

    } catch (ex) {
        console.error('error running db-csv-changes:');
        console.error(ex);
    }

    process.exit();
})();

async function getAllChangeFiles(db) {
    let dbs = Object.keys(dbSources);
    if (!Object.keys(dbSources).includes(db)) {
        throw `db must be either ${dbs.join(',')}`;
    }
    let src = `${appRoot.path}\\changes\\${db}`;
    let files = await fse.readdir(src);
    return files;
}
