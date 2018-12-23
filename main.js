//TODO ipv6 support
//TODO udp support - somewhat done - still very unreliable
//TODO rewrite in OOP
//TODO add error classes
//TODO deal with promise.reject on wrong method in scanPortRange - should it throw an error?
//TODO fix udp breakdown on large port range
//DONE//TODO fix refuse to exit on large port range

'use strict';

let net = require('net');
let dgram = require('dgram');

let err = require('./errors.js');

function log(...args) {return console.log(...args)}

console.log(process.argv);

let scanPortUDP = (port, host, success, callback) => {
    const socket = dgram.createSocket('udp4');
    socket.bind(parseInt(port), host);
    // console.log("HOST: " + host);

    socket.on('error', (err) => {
        // console.log(`socket error:\n${err.stack}`);
        // console.log('err');
        socket.unref();
        socket.close();
        if(callback) callback('closed');
    });

    socket.on('message', (msg, info) => {
        console.log(`socket got: ${msg} from ${info.address}:${info.port}`);
    });

    socket.on('listening', () => {
        // console.log(`server listening ${socket.address().address}:${socket.address().port}`);
        success.push({port: socket.address().port, host: socket.address().address});
        socket.unref();
        socket.close();
        if(callback) callback('open');
    });
};

let scanPort = (port, host, success, callback) => {
  let socket = net.createConnection({port: port, host: host});

  socket.on('error', err => {
      socket.unref();
      socket.end();
      if(callback) callback('closed');
  });

  socket.on('connect', () => {
      success.push({port: socket.remotePort, host: socket.remoteAddress});
      socket.unref();
      socket.end();
      if(callback) callback('open');
      // return {port: socket.remotePort, host: socket.remoteAddress};
  });
};

let scanPortRange = (ports, hosts, method) => {
    let success = [];
    Promise.all(hosts.map(host => {
        return ports.map(port => {
            if(method === 'tcp') return new Promise((resolve, reject) => scanPort(port, host, success, (arg) => resolve(arg)));
            else if(method === 'udp') return new Promise((resolve, reject) => scanPortUDP(port, host, success, (arg) => resolve(arg)));
            else return Promise.reject('Unknown method used');
        });
    }).reduce((first, second) => first.concat(second), []))
        .then((res) => {
            // console.log(res);
            return showOpenGates(success);
        }, (err) => {
            console.log(err);
            process.exit(1);
        });
};

let showOpenGates = gates => {
  console.log('Scanning complete. Open ports:');
  console.log(gates);
};

let parsePorts = ports => {
    if (ports.indexOf('-') !== -1) {
        return ports.split(',').map(port => {
            if (port.indexOf('-') !== -1) {
                let range = port.split('-');
                try {
                    checkPortRangeValidity(range);
                } catch (error) {
                    if (error instanceof err.RangeError) {
                        console.log(error.message + ": " + error.faultyRange[0] + '-' + error.faultyRange[1]);
                        process.exit(0);
                    }
                }
                let length = range[1] - range[0] + 1;
                return [...Array(length).keys()].map(x => (x + parseInt(range[0])).toString());
            }
            return port;
        }).reduce((first, second) => first.concat(second), []);
    } else return ports.split(',');
};

let parseHosts = hosts => {
    if(hosts.indexOf('.') === -1) throw new Error('Incorrect host notation');
    if (hosts.indexOf('-') !== -1) {
        return hosts.split(',').map(port => {
            if (port.indexOf('-') !== -1) {
                let range = port.split('-');
                range[1] = range[0].slice(0, range[0].lastIndexOf('.')+1) + range[1];
                try {
                    checkHostRangeValidity(range);
                } catch (error) {
                    if (error instanceof err.RangeError) {
                        console.log(error.message + ": " + error.faultyRange[0] + '-' + error.faultyRange[1]);
                        process.exit(0);
                    }
                }
                let length = range[1].slice(range[1].lastIndexOf('.')+1) - range[0].slice(range[0].lastIndexOf('.')+1) + 1;
                return [...Array(length).keys()].map(x => range[0]
                    .slice(0, range[0].lastIndexOf('.')+1) +
                    (x + parseInt(range[0].slice(range[0].lastIndexOf('.')+1))).toString());
            }
            return port;
        }).reduce((first, second) => first.concat(second), []);
    } else return hosts.split(',');
};

let replaceColons = hosts => {
    if(hosts.indexOf(':') !== -1) {
        return hosts.split(':').join('.');
    } else return hosts;
};

let checkPortRangeValidity = range => {
    if(range[0] === "" || range[1] === "") throw new err.RangeError('Unbounded port range', range);
    if(parseInt(range[0]) > parseInt(range[1])) {
        let tempZero = range[0];
        range[0] = range[1];
        range[1] = tempZero;
    }
};

let checkHostRangeValidity = range => {
    if(range[0].lastIndexOf('.') === range[0].length - 1
        || range[1].lastIndexOf('.') === range[1].length - 1) throw new err.RangeError('Unbounded host range', range);
    if(parseInt(range[0].slice(range[0].lastIndexOf('.')+1)) > parseInt(range[1].slice(range[1].lastIndexOf('.')+1))) {
        let tempZero = range[0];
        range[0] = range[1];
        range[1] = tempZero;
    }
};

let showHelp = () => {
    console.log(`Port scanner help:
        Use this tool to check for open ports on one or more TCP/UDP host
        Use:
        main.js [ports] [hosts] [tcp] [udp]
        ports: specifies the ports to scan. Use "," for single ports and "-" for port ranges, def = 0-65535
                    ex: main.js 80,400-500,8080
        hosts: optional parameter, def = 127.0.0.1
        tcp: use to perform a tcp scan, def = true
        udp: use to perform a udp scan, def = false`);
};

let parseArgs = () => {
    let ports = [];
    let hosts = [];
    let wantTcp = false;
    let wantUdp = false;
    //bad args or help request
    if(( isNaN(parseInt(process.argv[2])) && (process.argv[2] !== 'tcp' && process.argv[2] !== 'udp'))
        || process.argv[2] === "help") {
        showHelp();
        return process.exit(0);
    }//insufficient or wrong args or help call
    process.argv = process.argv.map(arg => replaceColons(arg));

    //1st arg being dealt with
    if(process.argv.length === 2 || process.argv[2].indexOf('.') !== -1
        || process.argv[2] === 'tcp' || process.argv[2] === 'udp') {//no 1st arg or it is unrelated to ports
        console.log('first arg not ports');
        let fullPortRange = '0-65535';
        ports = parsePorts(fullPortRange);
        if(process.argv[2].indexOf('.') !== -1) hosts = parseHosts(process.argv[2]);//1st arg is hosts
        else if(process.argv[2] === 'tcp') wantTcp = true;//1st arg is tcp request
        else if(process.argv[2] === 'udp') wantUdp = true;//1st arg is udp request
        else {//no 1st argument at all
            let localhost = '127.0.0.1';
            hosts = parseHosts(localhost);
            wantTcp = true;
        }
    } else {//first arg is not hosts or type specifier -> ports then
        ports = parsePorts(process.argv[2]);
    }

    //2nd arg being dealt with
    if(process.argv.length === 3 || process.argv[3] === 'tcp' || process.argv[3] === 'udp') {//no 2nd arg or i is unrelated to hosts
        if(hosts.length === 0) {//1st one was ports
            let localhost = '127.0.0.1';
            hosts = parseHosts(localhost);
        }
        if(process.argv[3] === 'tcp') wantTcp = true;//2nd arg is tcp request
        else if(process.argv[3] === 'udp') wantUdp = true;//2nd arg is udp request
    } else {
        hosts = parseHosts(process.argv[3]);
    }

    //3rd arg being dealt with
    if(process.argv.length <= 4 && wantUdp === false) wantTcp = true;//no 3rd arg and udp not  wanted
    else {
        if(process.argv[4] === 'tcp') wantTcp = true;//3rd arg is tcp request
        else if(process.argv[4] === 'udp') wantUdp = true;//3rd arg is udp request
    }

    //4th arg being dealt with
    if(process.argv[5]=== 'tcp') wantTcp = true;//4th arg is tcp request
    else if(process.argv[5] === 'udp') wantUdp = true;//3rd arg is udp request
    return {
        ports: ports,
        hosts: hosts,
        tcp: wantTcp,
        udp: wantUdp
    };
};

/*Main()*/{
    let scanParameters = parseArgs();
    console.log(scanParameters);
    if(scanParameters.tcp) scanPortRange(scanParameters.ports, scanParameters.hosts, 'tcp');
    if(scanParameters.udp) scanPortRange(scanParameters.ports, scanParameters.hosts, 'udp');
    // process.exit(0);
}
