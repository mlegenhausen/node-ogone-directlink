
var Ogone = require('../index');

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
}
