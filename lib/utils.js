var _ = require('busyman'),
    zclId = require('zcl-id');

var utils = {};

utils.isValidArgType = function (param) {
    var isValid = true;

    if (!_.isNumber(param) && !_.isString(param))
        isValid = false;
    else if (_.isNumber(param))
        isValid = !isNaN(param);

    return isValid;
};

utils.isCid = function (cid) {
    var cidItem = zclId.cluster(cid);
    return cidItem ? true : false;
};

utils.getCidKey = function (cid) {
    var cidItem = zclId.cluster(cid);
    return cidItem ? cidItem.key : cid;
};

utils.getCidNum = function (cid) {
    var cidItem = zclId.cluster(cid);
    return cidItem ? cidItem.value : cid;
};

utils.getAidKey = function (cid, aid) {
    var aidItem = zclId.attr(cid, aid);
    return aidItem ? aidItem.key : aid;
};

utils.getCmdKey = function (cid, cmdId) {
    var cmdItem = zclId.functional(cid, cmdId);
    return cmdItem ? cmdItem.key : cmdId;
};

utils.getCmdRspKey = function (cid, cmdId) {
    var cmdItem = zclId.getCmdRsp(cid, cmdId);
    return cmdItem ? cmdItem.key : cmdId;
};

/*************************************************************************************************/
/*** Synchronous Data Dumper                                                                   ***/
/*************************************************************************************************/
utils.dumpClusterSync = function (obj) {
    var dumped = {};

    _.forEach(obj, function (inst, instId) {
        dumped[instId] = inst.dumpSync();
    });

    return dumped;
};

/*************************************************************************************************/
/*** Asynchronous Data Dumper                                                                  ***/
/*************************************************************************************************/
utils.dumpCluster = async function (obj) {
    var dumped = {}

    for(const instId in obj){
        const inst = obj[instId]
        const resrcs = await inst.dump()
        dumped[instId] = resrcs;
    }

    return dumped
};

utils.dumpClusters = async function (so) {
    var dumped = {}

    for(const oidKey in so){
        const obj = so[oidKey]
        if (oidKey === 'zapp') continue

        const data = await utils.dumpCluster(obj)
        dumped[oidKey] = data;
    }

    return dumped
};

utils.cloneResourceObject = function (rObj) {
    var cloned = {};

    if (rObj._isCb) {
        _.forEach(rObj, function (_, rkey) {
            if (rkey === 'read')
                cloned.read = '_read_';
            else if (rkey === 'write')
                cloned.write = '_write_';
            else if (rkey === 'exec')
                cloned.exec = '_exec_';
        });
    } else {
        _.forEach(rObj, function (rval, rkey) {
            if (_.isFunction(rval))
                return;
            else
                cloned[rkey] = rval;
        });
    }

    delete cloned._isCb;
    return cloned;
};

module.exports = utils;