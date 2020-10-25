'use strict';

var _ = require('busyman'),
    zclId = require('zcl-id'),
    NotFound = require('./NotFound')

var utils = require('./utils');
// sid: [ 'dir', 'attrs', 'acls', 'cmds', 'cmdRsps' ]
function Spec(cidKey, sidKey) {
    if (!_.isString(cidKey))
        throw new TypeError("cid should be a string, such as 'genBasic'.");

    if (!_.isString(sidKey))
        throw new TypeError("sid should be a string, such as 'attrs' and 'cmds'.");

    this.cid = cidKey;    // cid is a string
    this.sid = sidKey;    // sid is a string
}

/*************************************************************************************************/
/*** Public Methods: Getter and Setter                                                         ***/
/*************************************************************************************************/
Spec.prototype.has = function (rid) {
    var ridkey;

    if (!utils.isValidArgType(rid)) 
        throw new TypeError('aid should be given with a number or a string.');

    if (this.sid === 'attrs' || this.sid === 'acls')
        ridkey = utils.getAidKey(this.cid, rid);
    else if (this.sid === 'cmds')
        ridkey = utils.getCmdKey(this.cid, rid);
    else if (this.sid === 'cmdRsps')
        ridkey = utils.getCmdRspKey(this.cid, rid);
    else
        ridkey  = rid;

    return this[ridkey] !== undefined;
};

Spec.prototype.get = function (rid) {
    var ridkey;

    if (!utils.isValidArgType(rid)) 
        throw new TypeError('rid should be given with a number or a string.');

    if (this.sid === 'attrs' || this.sid === 'acls')
        ridkey = utils.getAidKey(this.cid, rid);
    else if (this.sid === 'cmds')
        ridkey = utils.getCmdKey(this.cid, rid);
    else if (this.sid === 'cmdRsps')
        ridkey = utils.getCmdRspKey(this.cid, rid);
    else
        ridkey  = rid;

    return this[ridkey];
};

Spec.prototype.set = function (rid, value) {
    var ridkey;

    if (!utils.isValidArgType(rid)) 
        throw new TypeError('rid should be given with a number or a string.');

    if (this.sid !== 'cmds' && this.sid !== 'cmdRsps') {
        if (_.isUndefined(value) || _.isFunction(value))
            throw new TypeError('Attribute cannot be a function or undefined.');
    }

    if (this.sid === 'dir') {
        if (rid !== 'value')
            throw new Error("Direction should be named with key 'value'.");
        else if (!_.isNumber(value))
            throw new TypeError("dir.value should be a number.");
        ridkey = rid;
    } else if (this.sid === 'attrs') {
        ridkey = utils.getAidKey(this.cid, rid);
    } else if (this.sid === 'acls') {
        if (!_.isString(value))
            throw new TypeError('Only strings of R, W, RW are accepted');
        else
            value = value.toUpperCase();

        if (value !== 'R' && value !== 'W' && value !== 'RW' && value !== 'WR')
            throw new TypeError('Only strings of R, W, RW are accepted');

        // value = value.toUpperCase();
        ridkey = utils.getAidKey(this.cid, rid);
    } else if (this.sid === 'cmds' || this.sid === 'cmdRsps') {
        var cmdExec;

        if (_.isObject(value)) {
            value._isCb = _.isFunction(value.exec);
            cmdExec = value;
        } else if (_.isFunction(value)) {
            cmdExec = {
                _isCb: true,
                exec: value
            };
        }

        value = cmdExec;

        if (!_.isObject(value) && !_.isFunction(value.exec))
            throw new TypeError('A command should only be a function.');

        ridkey = (this.sid === 'cmds') ? utils.getCmdKey(this.cid, rid) : utils.getCmdRspKey(this.cid, rid);
    } else {
        ridkey  = rid;
    }

    this[ridkey] = value;
    return this;
};

Spec.prototype.clear = function () {
    for(const k in this){
        if (k === 'cid' || k === 'sid') continue
        delete this[k]
    }

    return this;
};

Spec.prototype.init = function (resrcs, zcl) {
    // each time of init(), all resources will be cleared. Please use .set() to add/modify resource
    var self = this.clear()

    if (_.isNil(zcl))
        zcl = true;

    if (!_.isPlainObject(resrcs))
        throw new TypeError('Spec attributes should be wrapped in an object.');

    switch (this.sid) {
        case 'dir':
            if (resrcs.value === undefined)
                throw new Error("Direction should be an object with an only key named 'value'.");
            this.set('value', resrcs.value);
            break;
        case 'attrs':
            _.forEach(resrcs, function (attrVal, attrId) {
                if (zcl && !zclId.attr(self.cid, attrId))
                    throw new TypeError('Attr id: ' + attrId + ' is not an ZCL-defined attribute.');

                if (_.isObject(attrVal))
                    attrVal._isCb = _.isFunction(attrVal.read) || _.isFunction(attrVal.write);

                self.set(attrId, attrVal);   // set will turn attrId to string
            });
            break;
        case 'acls':
            _.forEach(resrcs, function (flag, attrId) {
                if (zcl && !zclId.attr(self.cid, attrId))
                    throw new TypeError('Attr id: ' + attrId + ' is not an ZCL-defined attribute.');

                self.set(attrId, flag);   // set will turn attrId to string
            });
            break;
        case 'cmds':
        case 'cmdRsps':
            _.forEach(resrcs, function (cmdCb, cmdId) {
                var cmdExec;

                if (zcl) {
                    if (self.sid === 'cmds' && !zclId.functional(self.cid, cmdId))
                        throw new TypeError('Command id: ' + cmdId + ' is not an ZCL-defined functional command.');
                    else if (self.sid === 'cmdRsps' && !zclId.getCmdRsp(self.cid, cmdId))
                        throw new TypeError('Command id: ' + cmdId + ' is not an ZCL-defined functional command response.');
                }

                if (_.isObject(cmdCb)) {
                    cmdCb._isCb = _.isFunction(cmdCb.exec);
                    cmdExec = cmdCb;
                } else if (_.isFunction(cmdCb)) {
                    cmdExec = {
                        _isCb: true,
                        exec: cmdCb
                    };
                }

                self.set(cmdId, cmdExec);   // set will turn cmdId to string
            });
            break;
    }
};

Spec.prototype.dump = async function () {
    // do not dump keys: 'cid', 'sid'
    const dumped = {}

    for(const ridKey in this){
        if (ridKey !== 'cid' && ridKey !== 'sid') {
            let data = await this.read(ridKey)

            dumped[ridKey] = data;
        }
    }

    return dumped
};

Spec.prototype.dumpSync = function () {
    // do not dump keys: 'cid', 'sid'
    var dumped = {};

    _.forEach(this, function (rval, ridKey) {
        var clonedObj;

        if (ridKey === 'cid' || ridKey === 'sid' || _.isFunction(rval))
            return;

        if (_.isObject(rval)) {
            clonedObj = utils.cloneResourceObject(rval);
            dumped[ridKey] = clonedObj;
        } else if (!_.isFunction(rval)) {
            dumped[ridKey] = rval;
        }
    });

    return dumped;
};

/*************************************************************************************************/
/*** Public Methods: Asynchronous Read/Write/Exec                                              ***/
/*************************************************************************************************/
Spec.prototype.read = async function (rid) {
    var rsc = this.get(rid);

    if (_.isUndefined(rsc) || _.isFunction(rsc))
        throw new NotFound('Resource not found.')

    if (!_.isPlainObject(rsc))
        return rsc

    // if we are here, rsc is a plain object
    if (!rsc._isCb)
        return _.omit(rsc, [ '_isCb' ])

    // rsc should be read from users callback
    if (_.isFunction(rsc.exec)) {
        // an exec resource cannot be read, so checks for it first
        const err = new Error('Resource is unreadable.')
        err.code = '_exec_'
        throw err
    } 
    
    if (!_.isFunction(rsc.read)) {
        const err = new Error('Resource is unreadable.')
        err.code = '_unreadable_'
        throw err
    }
    
    return await rsc.read();
};

Spec.prototype.write = async function (rid, value) {
    var rsc = this.get(rid);

    if (_.isUndefined(rsc) || _.isFunction(rsc))
        throw new NotFound('Resource not found.')

    if (!_.isPlainObject(rsc)) {
        this.set(rid, value);
        return value
    }

    // if we are here, rsc is a plain object
    if (!rsc._isCb) {
        this.set(rid, value);
        return _.omit(value, [ '_isCb' ])
    }

    // rsc should be written by users callback
    if (_.isFunction(rsc.exec)) {
        // an exec resource cannot be written, so checks for it first
        const ex = new Error('Resource is unwritable.')
        ex.code = '_exec_'
        throw ex
    } else if (_.isFunction(rsc.write)) {
        return await rsc.write(value);
    } else {
        const ex = new Error('Resource is unwritable.')
        ex.code = '_unwritable_'
        throw ex
    }
};

Spec.prototype.exec = async function (rid, argus) {
    // we must pass zapp to the first element in argus (an array)
    var rsc = this.get(rid);

    if (!_.isArray(argus))
        throw new TypeError('argus should be an array with at least one element and must be the first element in the array.');

    if (_.isUndefined(rsc)) {
        const ex = new Error('Resource not found.')
        ex.code = '_notfound_'
        throw ex
    } 
    
    if (_.isObject(rsc) && _.isFunction(rsc.exec)) {
        return await rsc.exec.apply(this, argus);    // argus: [ zapp, argObj, _callback ]
    } else {
        const ex = new Error('Resource is unexecutable.')
        ex.code = '_unexecutable_'
        throw ex
    }
        
};

module.exports = Spec;
