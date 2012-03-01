require('sugar');

var crypto = require('crypto');

var request = require('request');
var qs = require('querystring');
var xml2js = require('xml2js');
var JSONSchema = require('json-schema');

function amountFormator(value) {
    return value * 100;
}

function OgoneError(response) {
    this.name = "OgoneError";
    this.message = "NCError: " + response.ncerror || "Unknown";
    this.response = response;
}

OgoneError.prototype = new Error();
OgoneError.prototype.constructor = OgoneError;

function Ogone(mode, defaults) {
    if (Object.isObject(mode)) {
        defaults = mode;
        mode = null;
    }
    this.defaults = defaults || {};
    if (mode && !~['test', 'prod'].indexOf(mode)) throw new Error("Unknown mode: " + mode);
    this.mode = mode || 'test';
}

Ogone.prototype.createOrderRequest = function(json, algorithm, key) {
	json = json || {};
    Object.merge(json, this.defaults, true);
    return new OrderRequest(this.mode, json, algorithm, key);
};

Ogone.prototype.createMaintenanceOrder = function(json) {
	json = json || {};
    Object.merge(json, this.defaults, true);
    return new MaintenanceRequest(this.mode, json);
};

Ogone.prototype.createQueryRequest = function(json) {
	json = json || {};
    Object.merge(json, this.defaults, true);
    return new QueryRequest(this.mode, json);
};

function Request(url, json, schema) {
    Object.merge(schema || {}, {
        type: 'object',
        properties: {
            pspid: {
                type: 'string',
                required: true
            },
            pswd: {
                type: 'string',
                required: true
            },
            userid: {
                type: 'string',
                required: true
            }
        }
    }, true);
    var result = JSONSchema.validate(json, schema);
    if (!result.valid) throw new Error(result.errors);
    this.query = Object.clone(json) || {};
    this.url = url;
    this.parser = new xml2js.Parser();
}

Request.prototype.operation = function(operation, callback) {
    this.query.operation = operation;
    this._send(callback);
};

Request.prototype._prepare = function(query) {
    return Request.upper(query);
};

Request.prototype._send = function(callback) {
    var prepared = this._prepare(this.query);
    if (prepared instanceof Error) return callback(prepared);
    var body = Request.stringify(prepared);
    request.post({
        uri: this.url,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
    }, function(err, response, body) {
        if (err) return callback(err);
        this.parser.parseString(body, function (err, result) {
            if (err) return callback(err);
            if (!result['@']) return callback(new Error("Unknown response: " + result));
            var normalize = Request.lower(result['@']);
            if (normalize.ncerror && normalize.ncerror !== '0') {
                return callback(new OgoneError(normalize));
            }
            return callback(null, normalize);
        }.bind(this));
    }.bind(this));
};

Request.stringify = function(obj) {
    var prepared = {};
    Object.keys(obj).each(function(key) {
        prepared[key] = obj[key] ? obj[key].toString() : '';
    });
    return qs.stringify(prepared);
}

Request.normalize = function(method, obj) {
    var result = {};
    Object.keys(obj).map(function(key) {
        var normalized = key[method]();
        if (result[normalized]) {
            throw new Error("Can not normalize cause of key: " + key);
        }
        result[normalized] = obj[key];
    });
    return result;
};

Request.lower = Request.normalize.bind(this, 'toLowerCase');
Request.upper = Request.normalize.bind(this, 'toUpperCase');

function OrderRequest(mode, json, algorithm, key) {
    var schema = {
        type: 'object',
        properties: {
            orderid: {
                type: ['string', 'number'],
                required: true
            },
            amount: {
                type: 'number',
                required: true
            },
            currency: {
                type: 'string',
                'default': 'EUR',
                required: true
            },
            brand: {
                type: 'string',
                required: true
            },
            cardno: {
                type: 'string',
                required: true
            },
            ed: {
                type: 'string',
                required: true
            },
            cvc: {
                type: 'string',
                required: true
            },
            com: {
                type: 'string'
            },
            cn: {
                type: 'string'
            },
            email: {
                type: 'string'
            },
            ownerAddress: {
                type: 'string'
            },
            ownerZip: {
                type: 'string'
            },
            ownerCity: {
                type: 'string'
            },
            ownerZip: {
                type: 'string'
            },
            ownerTelno: {
                type: 'string'
            },
            globOrderId: {
                type: 'string'
            },
            remote_address: {
                type: 'string'
            },
            rtimeout: {
                type: 'string'
            },
            eci: {
                type: 'string'
            }
        }
    };
    json.amount = amountFormator(json.amount);
    Request.call(this, 'https://secure.ogone.com/ncol/' + mode + '/orderdirect.asp', json, schema);
    this.algorithm = algorithm;
    this.key = key;
}

OrderRequest.prototype.__proto__ = Request.prototype;
OrderRequest.constructor = OrderRequest;

OrderRequest.prototype._prepare = function(query) {
    if (this.algorithm && this.key) {
        query.shasign = OrderRequest.hashify(this.algorithm, this.key, query);
    }
    return Request.prototype._prepare.apply(this, [query]);
};

OrderRequest.hashify = function(algorithm, key, obj) {
    var shasum = crypto.createHash(algorithm);
    var token = Object.keys(obj).sort().map(function(key) {
        if (obj[key]) return key.toUpperCase() + "=" + obj[key];
    }).join(key) + key;
    return shasum.update(token).digest('hex').toUpperCase();
};

OrderRequest.prototype.res = Request.prototype.operation.fill('RES');
OrderRequest.prototype.sal = Request.prototype.operation.fill('SAL');
OrderRequest.prototype.rfd = Request.prototype.operation.fill('RFD');

function MaintenanceRequest(mode, json) {
    var schema = {
        type: 'object',
        properties: {
            payid: {
                type: ['string', 'number']
            },
            orderid: {
                type: ['string', 'number']
            },
            amount: {
                type: 'number',
                required: true
            }
        }
    };
    json.amount = amountFormator(json.amount);
    Request.call(this, 'https://secure.ogone.com/ncol/' + mode + '/maintenancedirect.asp', json, schema);
}

MaintenanceRequest.prototype.__proto__ = Request.prototype;
MaintenanceRequest.constructor = MaintenanceRequest;

MaintenanceRequest.prototype.ren = Request.prototype.operation.fill('REN');
MaintenanceRequest.prototype.del = Request.prototype.operation.fill('DEL');
MaintenanceRequest.prototype.des = Request.prototype.operation.fill('DES');
MaintenanceRequest.prototype.sal = Request.prototype.operation.fill('SAL');
MaintenanceRequest.prototype.sas = Request.prototype.operation.fill('SAS');
MaintenanceRequest.prototype.rfd = Request.prototype.operation.fill('RFD');
MaintenanceRequest.prototype.rfs = Request.prototype.operation.fill('RFS');

function QueryRequest(mode, json) {
    var schema = {
        type: 'object',
        properties: {
            payid: {
                type: ['string', 'number']
            }
        }
    };
    Request.call(this, 'https://secure.ogone.com/ncol/' + mode + '/querydirect.asp', json, schema);
}

QueryRequest.prototype.__proto__ = Request.prototype;
QueryRequest.constructor = QueryRequest;

QueryRequest.prototype.status = Request.prototype._send;

module.exports = Ogone;
module.exports.Request = Request;
module.exports.OrderRequest = OrderRequest;
module.exports.MaintenanceRequest = MaintenanceRequest;
module.exports.QueryRequest = QueryRequest;
module.exports.OgoneError = OgoneError;