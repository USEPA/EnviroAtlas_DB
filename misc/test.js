const appRoot = require('app-root-path');
const utilities = require(appRoot + '\\shared\\utilities');
const db_sqlite = require(appRoot + '\\shared\\db-sqlite');

const config = require(appRoot + '\\scripts\\db-csv-changes.config');

let baseDir = 'C:\\AaronEvans\\Projects\\EPA CAM\\EnviroAtlas\\gitrepos\\EnviroAtlas_DB\\';
let csvDir = baseDir + 'changes\\staging\\';
let dbfile = baseDir + 'db\\staging\\staging.db';

let db = new db_sqlite({dbfile,config});
(async function () {
    writeCSV();
    return;
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

function writeCSV() {
    const fs = require('fs');
    const csv = require('csv');
    const stringify = csv.stringify;

    const data = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
        { name: 'Charlie', age: 35 },
        { name: 'xxx' }
    ];

    let fields = ['name','age'];
    const stringifier = stringify({ header: true ,fields});
    let file = 'output.csv';

//    return utilities.csv.write({fields,rows:data},file);
    return utilities.csv.write({fields,rows:[]},file);


    const writeStream = fs.createWriteStream(file);

    stringifier.pipe(writeStream);

    data.forEach(row => {
        stringifier.write(row);
    });

    stringifier.end();

    writeStream.on('finish', () => {
        console.log('CSV file written successfully!');
    });

    writeStream.on('error', (err) => {
        console.error('Error writing CSV file:', err);
    });
}