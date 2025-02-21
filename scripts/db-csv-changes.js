#!/usr/bin/env node

const appRoot = require('app-root-path');
const fse = require('fs-extra');
const path = require('path');
const db_sqlite = require(appRoot + '\\shared\\db-sqlite');
const utilities = require('@usepa-ngst/utilities/index.cjs');

//this just to mock up something for now
let dbSources = {local:'',staging:'local',prod:'staging'};

//const devLink = require('./index.js');

(async function () {
    try {
        let help = [];
        help.push('This tool imports data into sqlite from csv.');
        help.push('For deploy command, csv files saved in dev folder will be imported into staging db and csv files moved to staging folder');
        help.push('For deploy command, csv files saved in staging folder will be imported into prod db and csv files moved to prod folder');
        help.push('');
        help.push('Note: To run this script from any directory without having to prepend node, it can be installed by:');
        help.push('cd <directory of EnviroAtla_DB>\\scripts');
        help.push('npm install .');
        help.push('');
        help.push('db-csv-changes <cmd> <db> <change> --exportType <export type> --exportFile <export file> --project <project> --configFile <config file>');
        help.push('');
        help.push('Parameters:');
        help.push('');
        help.push('db = local, staging or prod (local not committed to repo. just for development.)');
        help.push('');
        help.push('change = name of folder with csv files containing changes. Note: change = * will import/init all folders for specified db. table = * will init all tables for specific db.');
        help.push('');
        help.push('cmd = list, init, load, deploy, or export');
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
        help.push('export: export db=<db> as type=<export type> config to export file=<export file> ');
        help.push('eg. db-csv-changes export prod --exportType=ea --exportFile=ea_prod_wab_config.json would export ea wab json file from prod db');
        help.push('');
        help.push('--exportType <export type> = exportType is usually equal to the project but can be different if multiple exports set up for single project. export code is set up in shared\exports.');
        help.push('--exportFile <export file> = path to export file. relative path is relative to folder script called from.');
        help.push('Note: default exportType and/or exportFile can be set up in config\defaults.js file or in config\projects\<project>.js for each project');
        help.push('');
        help.push('--project <project> = project config file to be used from config/projects/<project>. default project set up locally in config/project otherwise project=ea');
        help.push('');
        help.push('--configFile <config file> = path to config file to be used. relative path is relative to folder script called from. if configFile and project set then configFile is used for config file');
        help.push('Note: When project used instead of configFile then config/defaults.js can be used to locally override config/projects/<project> fields. when configFile set in command line then config/defaults.js will NOT be used to override its fields.');
        help.push('config/defaults.js looks like {ea: {exportFile=<local export file>}}');

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
        if (args._.length>2) change = args._[2];

        let table = "";
//        table = "layers";
//        table = "subtopics";
//        table = "subtopics,layers";
//        table = "*";
        if (args._.length>3) table = args._[3];

//        args.exportType = 'ea';

//        args.exportFile = 'wab_test_config.json';
//        args.exportFile = 'C:\\AaronEvans\\Projects\\EPA CAM\\EnviroAtlas\\gitrepos\\EnviroAtlas_JSApp\\widgets\\SimpleSearchFilter\\config_layer.json';

        let project = args.project;
        if (!project) {
            try {
                project = require(appRoot + '\\config\\project.js');
            } catch (ex) {
                project = 'ea';
            }
        }

        let configFile;
        if (args.configFile) {
            configFile = args.configFile;
        } else {
            configFile = `${appRoot}\\config\\projects\\${project}.js`;
        }
        if (!(path.isAbsolute(configFile))) {
            configFile = process.cwd() + '\\' + configFile;
        }

        let config;
        try {
            config = require(configFile);
        } catch (ex) {
            if (args.configFile) {
                throw `config file = ${configFile} found from args.configFile = ${args.configFile} not found`;
            } else {
                throw `config file = ${configFile} found from project = ${project} not found`;
            }
        }
        //if config file actually passed then don't over ride with local defaults
        config = processConfig(config,args.configFile ? null : project );

        if (cmd) {
            console.log(`running cmd=${cmd} for project=${project}`);
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
                if (['staging','prod'].includes(db)) {
                    let gitBranch = await getGitBranch(appRoot.path);
                    if (gitBranch!=='main') throw 'git branch must be equal to main when db=staging or prod for cmd=deploy or load';
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
                let exportType = args.exportType;
                if (!exportType) exportType = config.exportType;
                //if export type not set then try to get it from project
                if (!exportType) exportType = project;

                let exportLib;
                try {
                    exportLib = require(appRoot + '\\shared\\exports\\' + exportType);
                } catch (ex) {
                    throw `Export type ${exportType} is not currently supported`;
                }
                //4th argument is usually table
                let exportFile = args.exportFile;
                if (!exportFile) exportFile = config.exportFile;
                if (!exportFile) throw 'export file path is required for export';
                if (!path.isAbsolute(exportFile)) {
                    exportFile = process.cwd() + '\\' + exportFile;
                }
                await exportLib.runExport({exportFile,dbLib});
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

function processConfig(config,project) {
    if (project) {
        //add defaults to config
        let configDefaults;
        try {
            let defaults = require(appRoot + '\\config\\defaults.js');
//get the defaults for this project
            configDefaults = defaults[project] || {};
        } catch (ex) {
            configDefaults = {};
        }
//let local defaults over ride config
        config = {...config,...configDefaults};
    }

    for (let table of Object.values(config.tables)) {
        if (table.fields) table.fields = getFullFields(table.fields);
    }
    return config;
}

function getFullFields(fields) {
    let fullFields = [];
    for (let field of fields) {
        if (typeof(field)==='string') field= {name:field,type:'text'};
        if (!field.exportName) field.exportName = field.name;
        fullFields.push(field);
    }
    return fullFields;
}
