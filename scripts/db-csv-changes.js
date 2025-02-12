#!/usr/bin/env node

const appRoot = require('app-root-path');
const fse = require('fs-extra');
const path = require('path');
const db_sqlite = require(appRoot + '\\shared\\db-sqlite');
const wab = require(appRoot + '\\shared\\wab');
const config = require(appRoot + '\\scripts\\db-csv-changes.config');
processConfig(config);
const utilities = require('@usepa-ngst/utilities/index.cjs');

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
        help.push('init: create insert file with header in change = <change> for table=<table1>,<table2> in db=<db>');
        help.push('eg. db-csv-changes init local change1 subtopics,layers would create local/change2/subtopics-insert.csv and local/change2/layers-insert.csv file with all fields as header');
        help.push('');
        help.push('load: load change = <change> to db=<db>');
        help.push('eg. db-csv-changes load staging * would import all csv files in staging folder to staging db');
        help.push('');
        help.push('deploy: deploy change = <change> to db=<db> from db one level down and move csv file to db=<db> folder</db>');
        help.push('eg. db-csv-changes deploy prod change1 would import csv files in staging/change1 folder into prod db and then move staging/change1 folder to prod folder');
        help.push('');
        help.push('export: export db=<db> as type=<type> config to json file=<file> ');
        help.push('eg. db-csv-changes export prod wab ea_prod_wab_config.json would export wab json file from prod db');
        help.push('');
        help.push('db = local, staging or prod (local not committed to repo. just for development.)');
        help.push('');
        help.push('change = name of folder with csv files containing changes. Note: change = * will import/init all folders for specified db. table = * will init all tables for specific db.');

        let args = require('minimist')(process.argv.slice(2));

        let cmd = "";
//        cmd = "list";
//        cmd = "init";
//        cmd = "load";
//        cmd = "deploy";
//        cmd = "export";
        if (args._.length>0) cmd = args._[0];

        let db = "";
//        db = "local";
//        db = "staging";
//        db = "prod";
        if (args._.length>1) db = args._[1];

        let change = "";
//        change = "1-SoilDataChanges";
//        change = "2-LayerNameAndDownloadSourceChanges";
//        change = '1';
//        change = 'wab';
        if (args._.length>2) change = args._[2];

        let table = "";
//        table = 'wab_test_config.json';
//        table = "layers";
//        table = "subtopics";
//        table = "subtopics,layers";
//        table = "*";
        if (args._.length>3) table = args._[3];

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
                let gitBranch = await getGitBranch(appRoot.path);
                if (['staging','prod'].includes(db) && gitBranch!=='main') {
                    throw 'git branch must be equal to main when db=staging or prod for cmd=deploy or load';
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
                let changeFolders = await getChangeFolders(change,srcDb);

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

                let changeFolders = await getChangeFolders(change,db);

                for (let changeFolderName of changeFolders) {
                    let changeFolder = `${appRoot.path}\\changes\\${db}\\${changeFolderName}`;
                    let changeExists = await utilities.pathExists(changeFolder);
                    if (!changeExists) {
                        await fse.mkdir(changeFolder);
                        console.log(`change folder = ${changeFolder} created`);
                    }
                    //if table passed then create insert csv file with all fields in header but no rows
                    if (table) {
                        let tableNames = getTableNames(table);
                        for (let tableName of tableNames) {
                            //check if insert csv file already exists
                            let insertCsvfile = `${changeFolder}\\${tableName}-insert.csv`;

                            let insertExists = await utilities.pathExists(insertCsvfile);
                            if (!insertExists) {
                                //get all the fields in the passed table to create header with
                                let dbSchema = await dbLib.schema({table:tableName});
//                                console.log(dbSchema);
                                let dbFields = dbSchema.map(item=>item.name);
                                if (!dbSchema.length) throw `table = ${tableName} can not be initialized because it does not exist`;
                                let csvObj = {fields:dbFields,rows:[]};
                                await utilities.csv.write(csvObj,insertCsvfile);

                                console.log(`Insert CSV file ${insertCsvfile} initialized`)
                            } else {
                                console.log(`Warning: insert CSV file ${insertCsvfile} already exists`)
                            }
                        }
                    }
                }
            } else if (cmd==='list') {
//just list folders
                let files = await getAllChangeFolders(db);
                console.log(`Change files in db = ${db}`);
                for (let file of files) {
                    console.log(file);
                }
                if (!files.length) {
                    console.log('None');
                }
            } else if (cmd='export') {
                //3rd argument is usually change
                let exportType = change;
                if (exportType!=='wab') throw 'Only WAB export type is currently supported';
                //4th argument is usually table
                if (!table) throw 'json file path is required for WAB export';
                let jsonfile = table;
                if (!path.isAbsolute(jsonfile)) {
                    jsonfile = process.cwd() + '\\' + jsonfile;
                }
                await wab.writeWabConfig({jsonfile,dbLib});
                console.log(`WAB JSON config file exported to ${jsonfile} from db=${db}`);
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

async function getAllChangeFolders(db) {
    let dbs = Object.keys(dbSources);
    if (!Object.keys(dbSources).includes(db)) {
        throw `db must be either ${dbs.join(',')}`;
    }
    let src = `${appRoot.path}\\changes\\${db}`;
    let files = await fse.readdir(src);
    return files;
}

async function getChangeFolders(change,db) {
    let changeFolders;
    //if change is number then use that to match possible change folder
    let isChangeNumber = /^\d+$/.test(change);
    if (change==='*' || isChangeNumber)  {
        let allChangeFolders = await getAllChangeFolders(db);
        if (change==='*') {
            changeFolders = allChangeFolders;
        } else if (isChangeNumber){
            //loop over change folder to see if we get match based on leading digits
            for (let changeFolder of allChangeFolders) {
                let re = new RegExp(`^${change}-`);
                if (re.test(changeFolder)) {
                    changeFolders = [changeFolder];
                    break;
                }
            }
            if (!changeFolders) throw `numeric change number = ${change} does not exist in db = ${db}`;
        }
    } else {
        changeFolders = [change];
    }
    return changeFolders;
}

function getTableNames(table) {
    let tableNames;
    if (table==='*')  {
        tableNames = Object.keys(config.tables);
    } else {
        tableNames = table.split(',');
    }
    return tableNames;
}

async function getGitBranch(dir) {
    if (!dir) throw 'dir is required to get git branch';
    let out = await utilities.execExternalCommand({cmd:'git branch --show-current',dir});
    let branch = out.stdout.trim('\n');
    return branch;
}

function processConfig(config) {
    for (let table of Object.values(config.tables)) {
        if (table.fields) table.fields = getFullFields(table.fields);
    }
    return config;
}

function getFullFields(fields) {
    let fullFields = [];
    for (let field of fields) {
        if (typeof(field)==='string') field= {name:field,type:'text'};
        if (!field.wabName) field.wabName = field.name;
        fullFields.push(field);
    }
    return fullFields;
}
