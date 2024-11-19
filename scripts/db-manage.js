#!/usr/bin/env node

const appRoot = require('app-root-path');
const fse = require('fs-extra');
const utilities = require(appRoot + '\\shared\\utilities');

//this just to mock up something for now
let dbSources = {local:'',staging:'local',prod:'staging'};

//const devLink = require('./index.js');

(async function () {
    try {
        let help = [];
        help.push('This tool imports data into sqlite from csv.');
        help.push('csv files save in dev folder will be imported into staging db and csv files moved to staging folder');
        help.push('csv files save in staging folder will be imported into prod db and csv files moved to prod folder');
        help.push('When run WITH the register argument, it loads current pacakge into global link store');
        help.push('It always process package.json of in directory where command called:');
        help.push('db-manage <cmd> <db> <change>');
        help.push('db = staging or prod');
        help.push('change = name of folder with csv files containing changes. Note: change = * will import all folders for specified db');
        help.push('eg: node import staging *');
        help.push('eg: node import prod change1');
        help.push('If change is empty then just list all the change folders in <db> ');
        help.push('eg: node import prod');

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

                for (let file of files) {
                    let srcPath = `${appRoot.path}\\changes\\${srcDb}\\${file}`;
                    let destPath = `${appRoot.path}\\changes\\${destDb}\\${file}`;
                    //                   console.log(src);
                    //                   console.log(dest);
                    let sourceExists = await utilities.pathExists(srcPath);
                    if (!sourceExists) {
                        throw `change = ${change} does not exist in source db = ${srcDb}`;
                    }

                    //add code to import csv into sqlite
                    //do same thing for either deploy or load
                    //srcPath => destDB

                    if (cmd==='deploy') {
                        await fse.move(srcPath,destPath);
                    } else if (cmd==='load') {
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
        console.error('error running db-manage:');
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