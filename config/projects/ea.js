//Place to store configuratin for db-csv-change script
module.exports = {
    tables: {
        subtopics: {
//including the key allows script to check if item has been inserted so we don't get duplicates
//on insert the csv will be updated with the key value
            key: 'subTopicID',
            fields: [
                {name: 'subTopicID',type:'integer',key:true,new:true},
                {name:'eaID',type:'integer'},
                {name:'topic',exportName:'eaTopic',type:'text'},
                'categoryTab',
                {name:'scale',exportName:'eaScale',type:'text'},
                'name',
                {name:'description',exportName:'eaDescription',type:'text'},
                {name:'eaBC',type:'boolean'},
                {name:'eaCA',type:'boolean'},
                {name:'eaCPW',type:'boolean'},
                {name:'eaCS',type:'boolean'},
                {name:'eaFFM',type:'boolean'},
                {name:'eaNHM',type:'boolean'},
                {name:'eaRCA',type:'boolean'},
                {name:'eaPBS',type:'text'},
                {name:'tags',exportName:'eaTags',type:'array'},
// Got rid of this since already on layer.
//                'sourceType'
            ]
        },
        layers: {
            key: 'layerID',
            fields: [
                {name: 'layerID',type:'integer',key:true,new:true},
                {name: 'subTopicID',type:'integer',new:true},
                {name:'eaID',type:'integer'},
                'name',
                {name:'subLayerName',type:'text',new:true},
                {name:'description',exportName:'eaDescription',type:'text'},
                {name:'metric',exportName:'eaMetric',type:'text'},
                {name:'dfsLink',exportName:'eaDfsLink',type:'text'},
                {name:'metadataID',exportName:'eaMetadata',type:'text'},
                'url',
                {name:'lyrNum',exportName:'eaLyrNum',type:'integer'},
                {name:'tags',exportName:'eaTags',type:'array'},
                'tileLink',
                'tileURL',
                {name:'serviceType',exportName:'type',type:'text'},
                {name:'popup',type:'object'},
                {name:'popupLayers',exportName:'layers',type:'object'},
                {name:'numDecimal',type:'integer'},
                'sourceType',
                'cacheLevelNat',
                'DownloadSource',
                {name:'areaGeog',type:'array'},
                'agoID',
                {name: 'UniqueTag',type:'text',new:true},
                {name: 'HUBsearch',type:'text',new:true},
                {name: 'TagHubText',type:'text',new:true},
                {name:'ViewName',exportName:'View Name',type:'text',new:true}
            ]
        },
        community_uuids: {
            key: 'metadataID'
        },
        national_uuids: {
            key: 'metadataID'
        }
    },
//can set default export here so you don't need to keep setting on command line
//Note: can't always assume that export type equals project since might have multiple export types per project
//In this case exportType is equal to project so don't really need to set this but do it just for future reference.
//Setting it here instead of config/defaults so that is it checked in since it doesn't have to be specific to local machine like say export file.
    exportType: 'ea'
};
