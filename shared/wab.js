const sqlite3 = require('better-sqlite3');
const appRoot = require('app-root-path');
const utilities = require('@usepa-ngst/utilities/index.cjs');

//Even though this is redundant info, have to put these back in because WAB looks for them.
const booleanIconMappings = {
    eaCA: "Clean Air - x",
    eaFFM: "Food, Fuel, and Materials - x",
    eaCS: "Climate Stabilization - x",
    eaNHM: "Natural Hazard Mitigation - x",
    eaCPW: "Clean and Plentiful Water - x",
    eaRCA: "Recreation, Culture, and Aesthetics - x",
    eaBC: "Biodiversity Conservation - x",
    eaBC: "Biodiversity Conservation -x"
};
async function writeWabConfig({jsonfile,dbLib,where,values}) {
    const sw = new utilities.streamWriter();

//    let subtopics = await dbLib.select({table:'subtopics',where,values,keyValue:241,limit:1});
    let subtopics = await dbLib.select({table:'subtopics',where,values});
    let wabRows = [];
    for (let subtopic of subtopics) {
        let subTopicWabRow = {};
        for (let [booleanIcon,booleanIconLabel] of Object.entries(booleanIconMappings) ) {
            if (subtopic[booleanIcon]) {
                if (!(subTopicWabRow.eaBCSDD)) subTopicWabRow.eaBCSDD = [];
                subTopicWabRow.eaBCSDD.push(booleanIconLabel);
            }
        }
        processRow({wabRow:subTopicWabRow,dbRow:subtopic,fields:dbLib.config.tables.subtopics.fields});

        let layers = await dbLib.select({table:'layers',where:'subTopicID = $subTopicID',values:{subTopicID:subtopic.subTopicID}});

        //if this has "sub layers" then the layers are all on their own row
        //if no "sub layer" then subtopic and layer on same row
        let layerWabRow;
        if (layers.length>1) {
            wabRows.push(subTopicWabRow);
            subTopicWabRow.SubLayerIds = [];
            subTopicWabRow.SubLayerNames = [];
            layerWabRow = {};
        } else {
            layerWabRow = subTopicWabRow;
        }
        for (let layer of layers) {
            processRow({wabRow:layerWabRow,dbRow:layer,fields:dbLib.config.tables.layers.fields});
            if (layers.length>1) {
                layerWabRow.IsSubLayer = true;

                subTopicWabRow.SubLayerIds.push(layer.eaID.toString());
                subTopicWabRow.SubLayerNames.push(layer.subLayerName);
                //I guess subTopic also needs areaGeog field which we made only layer field in DB
                if (!('areaGeog' in subTopicWabRow)) subTopicWabRow.areaGeog = layer.areaGeog.split(',');
                //also layer also needs the scale from subTopic
                if ('scale' in subtopic) layerWabRow.eaScale = subtopic.scale;
            }
            wabRows.push(layerWabRow);
            layerWabRow = {};
        }
    }
    let wabConfig = {layers:{layer:wabRows}};
//    console.log(JSON.stringify(wabConfig,null,2));
    await sw.open(jsonfile);
    sw.write(JSON.stringify(wabConfig));
    await sw.end();
}

function processRow({dbRow,wabRow,fields}) {
    for (let field of fields) {
        if (!field.new) {
            let wabValue = dbRow[field.name];
            //Don't include fiels where the value is null, undefined or emptry strings
            if ([null,'',undefined].includes(wabValue)) continue;
            if (field.type==='object') {
                wabValue = JSON.parse(wabValue);
            } else if (field.type==='array') {
                wabValue = wabValue.split(',');
            } else if (field.type==='boolean') {
                wabValue = wabValue ? true : false;
            }
            wabRow[field.wabName] = wabValue;
        }
    }
}
module.exports = {writeWabConfig};

