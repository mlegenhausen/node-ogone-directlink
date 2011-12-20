require('sugar');

var crypto = require('crypto');

var request = require('request');
var qs = require('querystring');
var xml2js = require('xml2js');

function amountValidator(value) {
    if (!Object.isNumber(value)) return "Value is now a number";
}

function amountFormator(value) {
    return value * 100;
}

function OgoneError(response) {
    Error.call(this, "NCError: " + response.ncerror || "Unknown");
    this.response = response;
}

OgoneError.prototype = new Error();
OgoneError.prototype.constructor = OgoneError;

function Ogone(pspid, userid, password, mode) {
    this.query = {
        pspid: pspid,
        pswd: password,
        userid: userid
    };
    if (mode && !~['test', 'prod'].indexOf(mode)) throw new Error("Unknown mode: " + mode);
    this.mode = mode || 'test';
}

Ogone.prototype.createOrderRequest = function(algorithm, key) {
    return new OrderRequest(this.query, this.mode, algorithm, key);
};

Ogone.prototype.createMaintenanceOrder = function() {
    return new MaintenanceRequest(this.query, this.mode);
};

Ogone.prototype.createQueryRequest = function() {
    return new QueryRequest(this.query, this.mode);
};

function Request(query, url) {
    this.query = Object.clone(query) || {};
    this.url = url;
    this.parser = new xml2js.Parser();
    this.required = [];
}

Request.prototype.define = function(key, options) {
    options = options || {};
    if (options.required) this.required.push(key);
    this.__defineGetter__(key, function() {
        return this[key];
    }.bind(this.query));

    this.__defineSetter__(key, function(value) {
        if (options.validator) {
            var error = options.validator(value);
            if (error) throw new Error(error);
        }
        this[key] = options.formator ? options.formator(value) : value;
    }.bind(this.query));
    if (options.preset) this[key] = options.preset;
};

Request.prototype.operation = function(operation, callback) {
    this.query.operation = operation;
    this._send(callback);
};

Request.prototype._prepare = function(query) {
    var missing = this.required.exclude.apply(this.required, Object.keys(query));
    if (!missing.isEmpty()) {
        return new Error("Following parameters missing: " + missing.join(", "));
    }
    return Request.upper(query);
};

Request.prototype._send = function(callback) {
    var prepared = this._prepare(this.query);
    if (prepared instanceof Error) {
        return callback(prepared);
    }
    var body = qs.stringify(prepared);
    request.post({
        url: this.url,
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

function OrderRequest(query, mode, algorithm, key) {
    Request.call(this, query, 'https://secure.ogone.com/ncol/' + mode + '/orderdirect.asp');
    this.algorithm = algorithm;
    this.key = key;
    this.define('orderid', {
        required: true
    });
    this.define('amount', {
        required: true,
        validator: amountValidator,
        formator: amountFormator
    });
    this.define('currency', {
        preset: 'EUR'
    });
    this.define('brand', {
        required: true
    });
    this.define('cardno', {
        required: true
    });
    this.define('ed', {
        required: true
    });
    this.define('cvc', {
        required: true
    });
    // Order description
    this.define('com');
    // Customer name
    this.define('cn');
    // E-Mail
    this.define('email');
    // Customer street name and number
    this.define('ownerAddress');
    // Customer zip code
    this.define('ownerZip');
    // Customer town
    this.define('ownerCity');
    // Owner telepohone number
    this.define('ownerTelno');
    // Reference for grouping seleveral order together
    this.define('globOrderId');
    //Remote Address of the customer
    this.define('remote_address');
    // Timeout for transaction
    this.define('rtimeout');
    // Electronic commerce indicator
    this.define('eci');
}

OrderRequest.prototype = new Request();
OrderRequest.constructor = OrderRequest;

OrderRequest.prototype._prepare = function(query) {
    delete query.shasign;
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

function MaintenanceRequest(query, mode) {
    Request.call(this, query, 'https://secure.ogone.com/ncol/' + mode + '/maintenancedirect.asp');
    this.define('payid');
    this.define('orderid');
    this.define('amount', {
        required: true,
        validator: amountValidator,
        formator: amountFormator
    });
}

MaintenanceRequest.prototype = new Request();
MaintenanceRequest.constructor = MaintenanceRequest;

MaintenanceRequest.prototype.ren = Request.prototype.operation.fill('REN');
MaintenanceRequest.prototype.del = Request.prototype.operation.fill('DEL');
MaintenanceRequest.prototype.des = Request.prototype.operation.fill('DES');
MaintenanceRequest.prototype.sal = Request.prototype.operation.fill('SAL');
MaintenanceRequest.prototype.sas = Request.prototype.operation.fill('SAS');
MaintenanceRequest.prototype.rfd = Request.prototype.operation.fill('RFD');
MaintenanceRequest.prototype.rfs = Request.prototype.operation.fill('RFS');

function QueryRequest(query, mode) {
    Request.call(this, query, ' https://secure.ogone.com/ncol/' + mode + '/querydirect.asp');
    this.define('payid');
}

QueryRequest.prototype = new Request();
QueryRequest.constructor = QueryRequest;

QueryRequest.prototype.status = Request.prototype._send;

module.exports = Ogone;
module.exports.Request = Request;
module.exports.OrderRequest = OrderRequest;
module.exports.MaintenanceRequest = MaintenanceRequest;
module.exports.QueryRequest = QueryRequest;
module.exports.OgoneError = OgoneError;