
var Ogone = require('../index');
var request = require('request');

exports.testHashify = function(test) {
    var key = 'testtesttesttest';
    var query = {
        PSPID: 'test',
        PSWD: 'test',
        USERID: 'test',
        ORDERID: 'AB5456CB896',
        OPERATION: 'SAL',
        CURRENCY: 'EUR',
        AMOUNT: '12995',
        BRAND: 'VISA',
        CARDNO: '4111111111111111',
        ED: '12/09'
    };
    var sha1 = Ogone.OrderRequest.hashify('sha1', key, query);
    var sha256 = Ogone.OrderRequest.hashify('sha256', key, query);
    var sha512 = Ogone.OrderRequest.hashify('sha512', key, query);
    test.equal(sha1, 'F9E92B124753DDDC8116286C3A7168686798B31B');
    test.equal(sha256, '963B0631B038F1A0E9238C512D40A88D2C7BB6A9BEFE7FF21F5D2B002FF7744E');
    test.equal(sha512, '91C963E214608311F1E068085B52D5190C402A6E60F77246FF989283180EC685D36CED98986999981B0FA033BF7B225528E3FD401593444CEA27F55161DAA887');
    test.done();
};

exports.testNormalize = function(test) {
    var query = {
        'test1': 'foo',
        'tEsT2': 'bar',
        'TEST3': 'foobar'
    };
    var lower = Ogone.Request.lower(query);
    var upper = Ogone.Request.upper(query);

    test.deepEqual(lower, {
        'test1': 'foo',
        'test2': 'bar',
        'test3': 'foobar'
    });
    test.deepEqual(upper, {
        'TEST1': 'foo',
        'TEST2': 'bar',
        'TEST3': 'foobar'
    });
    test.throws(function() {
        test.lower({
            'asd': 'foo',
            'ASD': 'bar'
        });
    });
    test.throws(function() {
         test.upper({
            'asd': 'foo',
            'ASD': 'bar'
        });
    });
    test.done();
};

exports.testOperation = function(test) {
    var req = new Ogone.Request();
    req._send = function(callback) {

    };
    req.operation('Hello', null);
    test.equal(req.query.operation, 'Hello');
    test.done();
};

exports.testPrepare = function(test) {
    var req = new Ogone.Request();
    req.required = ['foo'];
    var result = req._prepare({'foo': 'bar'});
    test.equal(result.FOO, 'bar');
    test.done();
};

exports.testSendPrepareError = function(test) {
    var req = new Ogone.Request();
    req._prepare = function() {
        return new Error('Prepare Error');
    };
    req._send(function(err) {
        test.ok(err instanceof Error);
        test.equal(err.message, 'Prepare Error');
        test.done();
    });
};

exports.testSendPostError = function(test) {
    var _post = request.post;
    var req = new Ogone.Request();
    req._prepare = function() {
        return {};
    };
    request.post = function(message, callback) {
        return callback(new Error('Post Error'));
    };
    req._send(function(err) {
        test.ok(err instanceof Error);
        test.equal(err.message, 'Post Error');
        request.post = _post;
        test.done();
    });
};

exports.testSendParseError = function(test) {
    var _post = request.post;
    var req = new Ogone.Request();
    req._prepare = function() {
        return {};
    };
    request.post = function(message, callback) {
        return callback(null, 'Test');
    };
    req.parser.parseString = function(body, callback) {
        return callback(new Error("Parse Error"));
    };
    req._send(function(err) {
        test.ok(err instanceof Error);
        test.equal(err.message, 'Parse Error');
        request.post = _post;
        test.done();
    });
};

exports.testSendUnknownResult = function(test) {
    var _post = request.post;
    var req = new Ogone.Request();
    req._prepare = function() {
        return {};
    };
    request.post = function(message, callback) {
        return callback(null, 'Test');
    };
    req.parser.parseString = function(body, callback) {
        return callback(null, "Unknown Response");
    };
    req._send(function(err) {
        test.ok(err instanceof Error);
        request.post = _post;
        test.done();
    });
};

exports.testSendNcError = function(test) {
    var _post = request.post;
    var req = new Ogone.Request();
    req._prepare = function() {
        return {};
    };
    request.post = function(message, callback) {
        return callback(null, 'Test');
    };
    req.parser.parseString = function(body, callback) {
        return callback(null, {'@': {
            ncerror: '5001113'
        }});
    };
    req._send(function(err) {
        test.ok(err instanceof Ogone.OgoneError);
        test.equal(err.response.ncerror, '5001113');
        request.post = _post;
        test.done();
    });
};

exports.testSendSuccess = function(test) {
    var _post = request.post;
    var req = new Ogone.Request();
    req._prepare = function() {
        return {foo: 123};
    };
    request.post = function(message, callback) {
        test.equal(message.body, 'foo=123');
        return callback(null, 'Test');
    };
    req.parser.parseString = function(body, callback) {
        return callback(null, {'@': {
            ncerror: '0'
        }});
    };
    req._send(function(err, result) {
        test.equal(result.ncerror, '0');
        request.post = _post;
        test.done();
    });
};

exports.testOgoneMode = function(test) {
    var testa = new Ogone('test');
    test.equal(testa.mode, 'test');
    var prod = new Ogone('prod');
    test.equal(prod.mode, 'prod');
    test.throws(function() {
        new Ogone('error');
    });
    test.done();
};

exports.testStringify = function(test) {
    function Obj(value) {
        this.value = value;
    }
    Obj.prototype.toString = function() {
        return this.value;
    };
    var a = {
        test: new Obj(123)
    };
    test.equal(typeof a.test.value, 'number');
    test.equal(typeof a.test, 'object');
    var result = Ogone.Request.stringify(a);
    test.equal(result, 'test=123');
    test.done();
};