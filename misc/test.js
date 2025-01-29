const appRoot = require('app-root-path');
const utilities = require(appRoot + '\\shared\\utilities');
const db_sqlite = require(appRoot + '\\shared\\db-sqlite');

const config = require(appRoot + '\\scripts\\db-csv-changes.config');

let baseDir = 'C:\\AaronEvans\\Projects\\EPA CAM\\EnviroAtlas\\gitrepos\\EnviroAtlas_DB\\';
let csvDir = baseDir + 'changes\\staging\\';
let dbfile = baseDir + 'db\\staging\\staging.db';

let db = new db_sqlite({dbfile,config});
(async function () {
    try {
        /*
        let values = {categoryTab:'ESB',name:'%Percent agriculture%'};
        let where = 'categoryTab=$categoryTab AND name LIKE $name';
        let result = await db.select({table:'subtopics',keyValue:1,fields:['subTopicId','name'],where,values});
        console.log(result);
        return;
         */
        await db.writeFromCSV({csvfile:csvDir + 'change1\\subtopics-insert.csv',key:'subTopicID'});
        await db.writeFromCSV({csvfile:csvDir + 'change2\\subtopics-update.csv',key:'subTopicID'});
        await db.writeFromCSV({csvfile:csvDir + 'change1\\subtopics-delete.csv',key:'subTopicID'});
    } catch (ex) {
        console.error(ex);
    }
})().then(function(){
    db.close();
});

