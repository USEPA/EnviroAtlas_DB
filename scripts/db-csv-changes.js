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
        help.push('db-csv-changes <cmd> <db> <change>');
        help.push('cmd = list, load or deploy');
        help.push('list: list all changes in db=<db>');
        help.push('eg. db-csv-changes list staging would list all csv change folders in staging folder');
        help.push('load: load change = <change> to db=<db>');
        help.push('eg. db-csv-changes load staging * would import all csv files in staging folder to staging db');
        help.push('deploy: deploy change = <change> to db=<db> from db one level down and move csv file to db=<db> folder</db>');
        help.push('eg. db-csv-changes deploy prod change1 would import csv files in staging/change1 folder into prod db and then move staging/change1 folder to prod folder');
        help.push('');
        help.push('db = local, staging or prod (local not committed to repo. just for development.)');
        help.push('');
        help.push('change = name of folder with csv files containing changes. Note: change = * will import all folders for specified db');

        let args = require('minimist')(process.argv.slice(2));

        let cmd = "";
//        cmd = "list";
//        cmd = "load";
//        cmd = "deploy";
        if (args._.length>0) cmd = args._[0];

        let db = "";
//        db = "staging";
//        db = "prod";
        if (args._.length>1) db = args._[1];

        let change = "";
//        change = "change1";
//        change = "change2";
        if (args._.length>2) change = args._[2];

        if (cmd) {
            if (!db) throw 'db is required';
            if (['deploy','load'].includes(cmd)) {
                if (cmd==='deploy' && !['staging','prod'].includes(db)) {
                    throw 'change can only be deployed to db = staging or prod';
                }
                if (!change) {
                    throw 'change file name is required for cmd=deploy or load';
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
                let files;
                if (change==='*')  {
                    files = await getAllChangeFiles(srcDb);
                } else {
                    files = [change];
                }

                let dbfile = `${appRoot.path}\\db\\${destDb}\\${destDb}.db`;
                let dbLib = new db_sqlite({dbfile,config});

                for (let file of files) {
                    let srcPath = `${appRoot.path}\\changes\\${srcDb}\\${file}`;
                    let destPath = `${appRoot.path}\\changes\\${destDb}\\${file}`;
                    //                   console.log(src);
                    //                   console.log(dest);
                    let sourceExists = await utilities.pathExists(srcPath);
                    if (!sourceExists) {
                        throw `change = ${change} does not exist in source db = ${srcDb}`;
                    }

                    if (['deploy','load'].includes(cmd)) {
                        //have to write csv changes to DB. then copy to deployed folder if applicable
                        let changeFiles = await fse.readdir(srcPath);
                        for (let changeFile of changeFiles) {
                            await dbLib.writeFromCSV({csvfile:`${srcPath}\\${changeFile}`});
                        }
                        if (cmd==='deploy') {
                            await fse.move(srcPath,destPath);
                        }
                    }

                    console.log(srcDb + '/' + file + ' loaded into ' + destDb);
                }
                if (!files.length) {
                    console.log(`No change files avaiable for import to dest db = ${db}`);
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