/*
   state recovery test
   to run:
   node recover.js
*/

var net = require('net');
var fs = require('fs');
var assert = require('assert');
var dgram = require('dgram');
var exec = require('child_process').exec;

var Messenger = require('bitfloor/messenger');

var Matcher = require('../');
var json2 = require('../deps/json2'); // for pretty-serialize

var BASE_DIR = __dirname + "/recover";
var TIMEOUT = 100;

var env = require('bitfloor/config').env;

var matcher_config = {
    client: {
        ip: 'localhost',
        port: 10001
    },
    feed: {
        ip: '239.255.0.1',
        port: 10001
    }
};

// create the matcher used for testing
var product_id = 0; // fake id, matcher doesn't care except to save state
var matcher = new Matcher(product_id, matcher_config);

function do_test(test_name, cb) {
    // clear the log directory
    exec("rm -rf " + env.logdir + "/*", function(error) {
        if (error) {
            console.log('ERROR:');
            console.log(error);
            process.exit(1);
        }

        // reset matcher state
        matcher.reset();

        matcher.start(function() {
            run_test(test_name, cb);
        });
    });
}

function run_test(test_name, cb) {
    var test_file = BASE_DIR + "/" + test_name;
    var orders = JSON.parse(fs.readFileSync(test_file));

    var client = net.createConnection(matcher_config.client.port);

    client.on('connect', function() {
        var ms = new Messenger(client);

        orders.forEach(function(order) {
            ms.send(order);
        });

        // TODO: jenky
        setTimeout(function() {
            client.end();
            run_recover(cb);
        }, 100);
    });
}

function run_recover(cb) {
    var gold_state = matcher.state();
    gold_state.state_num++; // TODO: jenky, because of a jenky thing in the matcher
    matcher.stop(function() {
        matcher.reset();
        matcher.start(function() {
            var state = matcher.state();
            assert.deepEqual(state, gold_state);
            matcher.stop();
            cb();
        });
    });
}

function process_tests(tests) {
    var test = tests.shift();
    if(test) {
        if(test[0] === '.') {
            return process_tests(tests);
        }

        console.log('running test', test);
        do_test(test, function(ret) {
            console.log('ran test');
            process_tests(tests);
        });
    }
}

var tests = fs.readdirSync(BASE_DIR);
process_tests(tests);
