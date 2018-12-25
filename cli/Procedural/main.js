'use strict';

const net = require('net');
const dgram = require('dgram');

const err = require('../errors.js');

console.log(process.argv);

const scanPortUDP = (port, host, family, success, callback) => {
    let socket;
    if (family === 4) socket = dgram.createSocket('udp4');
    else if (family === 6) socket = dgram.createSocket('udp6');

    socket.send('my packet', 0, 9, parseInt(port), host
        , (err, bytes) => {
            // console.log("ERROR: " + err, bytes);
            // success.closed.push({port: port, host: host, method:'UDP', family: 'ipv' + family});
            setTimeout(() => {
                socket.unref();
                socket.close();
                if (callback) callback('timeout');
            }, 2000);
        }
    );

    socket.on('error', (err) => {
        console.log("called error");
        console.log(err);
        success.closed.push({port: port, host: host, method: 'UDP', family: 'ipv' + family});
        // socket.unref();
        // socket.close();
        if (callback) callback('closed');
    });

    socket.on('message', (msg, info) => {
        console.log(`socket got: ${msg} from ${info.address}:${info.port}`);
        success.open.push({port: port, host: host, method: 'UDP', family: 'ipv' + family});
        if (callback) callback('open');
    });

    socket.on('listening', () => {//empty arg list
        console.log(`server listening ${socket.address().address}:${socket.address().port}`);
    });
};

const scanPort = (port, host, family, success, callback) => {
    let socket = net.createConnection({port: port, host: host, family: family});

    socket.on('error', err => {
        success.closed.push({
            port: socket.remotePort,
            host: socket.remoteAddress,
            method: 'TCP',
            family: 'ipv' + family
        });
        socket.unref();
        socket.end();
        if (callback) callback('closed');
    });

    socket.on('connect', () => {
        success.open.push({port: socket.remotePort, host: socket.remoteAddress, method: 'TCP', family: 'ipv' + family});
        socket.unref();
        socket.end();
        if (callback) callback('open');
    });

    socket.on('data', (data) => {
        console.log(data.toString());
    });
};

const scanPortRange = (ports, hosts, method, family) => {
    let success = {
        open: [],
        closed: []
    };
    Promise.all(hosts.map(host => {
        return ports.map(port => {
            if (method === 'tcp') return new Promise((resolve, reject) => scanPort(port, host, family, success, (arg) => resolve(arg)));
            else if (method === 'udp') return new Promise((resolve, reject) => scanPortUDP(port, host, family, success, (arg) => resolve(arg)));
            else return Promise.reject('Unknown method used');
        });
    }).reduce((first, second) => first.concat(second), []))
        .then((res) => {
            // console.log(res);
            return showOpenGates(success, method);
        }, (err) => {
            console.log(err);
            process.exit(1);
        });
};

const showOpenGates = (success) => {
    console.log('Scanning complete');
    if (success.open.length <= success.closed.length || success.open.length <= 100) {//less open ports than closed
        console.log('Open ports are:');
        if (success.open.length === 0) console.log('None');
        else success.open.map(port => {
            console.log(port);
        });
    } else {//less closed ports
        console.log('Too many open ports. Closed ports are:');
        if (success.closed.length === 0) console.log('None');
        else success.closed.map(port => {
            console.log(port);
        })
    }
};

const parsePorts = ports => {
    if (ports.indexOf('-') !== -1) {
        return ports.split(',').map(port => {
            if (port.indexOf('-') !== -1) {
                let range = port.split('-');
                checkPortRangeValidity(range);
                let length = range[1] - range[0] + 1;
                return [...Array(length).keys()].map(x => (x + parseInt(range[0])).toString());
            }
            return port;
        }).reduce((first, second) => first.concat(second), []);
    } else return ports.split(',');
};

const parseHosts = hosts => {
    let isIPV6 = false;
    let isURL = false;
    hosts.split(',').map((host) => {
        if (host.indexOf(':') !== -1 && !(host.split(':')[0].slice(0, 4) === 'http')) isIPV6 = true;
        else if (isNaN(parseInt(host.split('.').pop()))) isURL = true;
    });
    if (!isURL && !isIPV6) {
        if (hosts.indexOf('-') !== -1) {
            return hosts.split(',').map(host => {
                if (host.indexOf('-') !== -1) {
                    let range = host.split('-');
                    range[1] = range[0].slice(0, range[0].lastIndexOf('.') + 1) + range[1];
                    checkIPV4HostRangeValidity(range);
                    let length = range[1].slice(range[1].lastIndexOf('.') + 1) - range[0].slice(range[0].lastIndexOf('.') + 1) + 1;
                    return [...Array(length).keys()].map(x => range[0]
                            .slice(0, range[0].lastIndexOf('.') + 1) +
                        (x + parseInt(range[0].slice(range[0].lastIndexOf('.') + 1))).toString());
                }
                return host;
            }).reduce((first, second) => first.concat(second), []);
        } else return hosts.split(',');
    } else if (isURL) {
        if (hosts.indexOf(',') !== -1) return hosts.split(',');
        else {
            const returner = [];
            returner.push(hosts);
            return returner;
        }
    } else if (isIPV6) {
        if (hosts.indexOf('-') !== -1) {
            return hosts.split(',').map(host => {
                if (host.indexOf('-') !== -1) {//has range
                    let range = host.split('-');
                    range[1] = range[0].slice(0, range[0].lastIndexOf(':') + 1) + range[1];
                    checkIPV6HostRangeValidity(range);
                    let snd = parseInt(range[1].slice(range[1].lastIndexOf(':') + 1), 16);
                    let fst = parseInt(range[0].slice(range[0].lastIndexOf(':') + 1), 16);
                    // console.log(fst, snd);
                    let length = snd - fst + 1;
                    // console.log(range, length);
                    return [...Array(length).keys()].map(x => range[0]
                            .slice(0, range[0].lastIndexOf(':') + 1) +
                        (x + parseInt(range[0].slice(range[0].lastIndexOf(':') + 1), 16)).toString(16));
                }
                return host;
            }).reduce((first, second) => first.concat(second), []);
        } else return hosts.split(',');
    } else throw new err.BadHostNotationError('Incorrect host notation', hosts);
};

const checkPortRangeValidity = range => {
    if (range[0] === "" || range[1] === "") throw new err.RangeError('Unbounded port range', range);
    if (parseInt(range[0]) > parseInt(range[1])) {
        let tempZero = range[0];
        range[0] = range[1];
        range[1] = tempZero;
    }
};

const checkIPV6HostRangeValidity = range => {
    if ((range[0].lastIndexOf(':') === range[0].length - 1 && range[0] !== '::')//':' is the last elem, but address is not '::'
        || (range[1].lastIndexOf(':') === range[1].length - 1) && range[1] !== '::') throw new err.RangeError('Unbounded host range', range);
    if (parseInt(range[0].slice(range[0].lastIndexOf(':') + 1), 16) > parseInt(range[1].slice(range[1].lastIndexOf(':') + 1), 16)) {
        let tempZero = range[0];
        range[0] = range[1];
        range[1] = tempZero;
    }
};

const checkIPV4HostRangeValidity = range => {
    if (range[0].lastIndexOf('.') === range[0].length - 1
        || range[1].lastIndexOf('.') === range[1].length - 1) throw new err.RangeError('Unbounded host range', range);
    if (parseInt(range[0].slice(range[0].lastIndexOf('.') + 1)) > parseInt(range[1].slice(range[1].lastIndexOf('.') + 1))) {
        let tempZero = range[0];
        range[0] = range[1];
        range[1] = tempZero;
    }
};

const showHelp = () => {
    console.log(`Port scanner help:
        Use this tool to check for open ports on one or more TCP/UDP host
        Use:
        main.js [ports] [hosts] [tcp] [udp] [ipv4] [ipv6]
        ports: specifies the ports to scan. Use "," for single ports and "-" for port ranges, def = 1-65535
        hosts: optional parameter, def = 127.0.0.1
        tcp: use to perform a tcp scan, def = true
        udp: use to perform a udp scan, def = false
        ipv4: use to perform ipv4 scan when using url as a host, def = true
        ipv6: use to perform ipv6 scan when using url as a host, def = false
        ex:
            $:main.js 80,400-500,8080 127.0.0.1-20 udp
        will perform scan for selected ports on each selected host using udp ipv4 protocol
        `);
};

const parseArgs = () => {
    let ports = [];
    let hosts = [];
    let wantTcp = false;
    let wantUdp = false;
    let wantIPV4 = false;
    let wantIPV6 = false;

    // process.argv = process.argv.map(arg => replaceColons(arg));
    let args = process.argv;
    let fullPortRange = '1-65535';
    let localhost = '127.0.0.1';
    try {
        switch (args.length) {
            case 2://no args
                ports = parsePorts(fullPortRange);
                hosts = parseHosts(localhost);
                wantTcp = true;
                wantIPV4 = true;
                break;
            case 3://1 arg
                //arg 1
                if (args[2].indexOf('.') !== -1 || args[2].indexOf(':') !== -1) {//arg is hosts
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(args[2]);
                    wantTcp = true;
                    wantIPV4 = true;
                } else if (parseInt(args[2])) {//arg is ports
                    ports = parsePorts(args[2]);
                    hosts = parseHosts(localhost);
                    wantTcp = true;
                    wantIPV4 = true;
                } else if (args[2] === 'tcp' || args[2] === 'ipv4') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantTcp = true;
                    wantIPV4 = true;
                } else if (args[2] === 'udp') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantUdp = true;
                    wantIPV4 = true;
                } else if (args[2] === 'ipv6') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantTcp = true;
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                break;
            case 4://2 args
                //arg 1
                if (args[2].indexOf('.') !== -1 || args[2].indexOf(':') !== -1) {//arg 1 is hosts
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(args[2]);
                } else if (parseInt(args[2])) {//arg 1 is ports
                    ports = parsePorts(args[2]);
                } else if (args[2] === 'tcp') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantTcp = true;
                } else if (args[2] === 'udp') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantUdp = true;
                } else if (args[2] === 'ipv4') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantTcp = true;
                    wantIPV4 = true;
                } else if (args[2] === 'ipv6') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantTcp = true;
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 2
                if (args[3].indexOf('.') !== -1 || args[3].indexOf(':') !== -1) {//arg 2 is hosts
                    if (hosts.length !== 0) {//hosts already present
                        showHelp();
                        process.exit(0);
                    }
                    hosts = parseHosts(args[3]);
                    wantTcp = true;
                    wantIPV4 = true;
                } else if (args[3] === 'tcp' || args[3] === 'ipv4') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantTcp = true;
                    wantIPV4 = true;
                } else if (args[3] === 'udp') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantUdp = true;
                    wantIPV4 = true;
                } else if (args[3] === 'ipv6') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantTcp = true;
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                break;
            case 5://3 args
                //arg 1
                if (args[2].indexOf('.') !== -1 || args[2].indexOf(':') !== -1) {//arg 1 is hosts
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(args[2]);
                } else if (parseInt(args[2])) {//arg 1 is ports
                    ports = parsePorts(args[2]);
                } else if (args[2] === 'tcp') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantTcp = true;
                } else if (args[2] === 'udp') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantUdp = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 2
                if (args[3].indexOf('.') !== -1 || args[3].indexOf(':') !== -1) {//arg 2 is hosts
                    if (hosts.length !== 0) {//hosts already present
                        showHelp();
                        process.exit(0);
                    }
                    hosts = parseHosts(args[3]);
                } else if (args[3] === 'tcp') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantTcp = true;
                } else if (args[3] === 'udp') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantUdp = true;
                } else if (args[3] === 'ipv4') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantIPV4 = true;
                } else if (args[3] === 'ipv6') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 3
                if (args[4] === 'tcp') {
                    wantTcp = true;
                    wantIPV4 = true;
                } else if (args[4] === 'udp') {
                    wantUdp = true;
                    wantIPV4 = true;
                } else if (args[4] === 'ipv4') {
                    if (!wantUdp) wantTcp = true;//if wantUdp flag was not set, have to activate default parameter
                    wantIPV4 = true;
                } else if (args[4] === 'ipv6') {
                    if (!wantUdp) wantTcp = true;//if wantUdp flag was not set, have to activate default parameter
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                break;
            case 6://4 args
                //arg 1
                if (args[2].indexOf('.') !== -1 || args[2].indexOf(':') !== -1) {//arg 1 is hosts
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(args[2]);
                } else if (parseInt(args[2])) {//arg 1 is ports
                    ports = parsePorts(args[2]);
                } else if (args[2] === 'tcp') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantTcp = true;
                } else if (args[2] === 'udp') {
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(localhost);
                    wantUdp = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 2
                if (args[3].indexOf('.') !== -1 || args[3].indexOf(':') !== -1) {//arg 2 is hosts
                    if (hosts.length !== 0) {//hosts already present
                        showHelp();
                        process.exit(0);
                    }
                    hosts = parseHosts(args[3]);
                } else if (args[3] === 'tcp') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantTcp = true;
                } else if (args[3] === 'udp') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantUdp = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 3
                if (args[4] === 'tcp') {
                    wantTcp = true;
                } else if (args[4] === 'udp') {
                    wantUdp = true;
                } else if (args[4] === 'ipv4') {
                    if (!wantUdp) wantTcp = true;//if wantUdp flag was not set, have to activate default parameter
                    wantIPV4 = true;
                } else if (args[4] === 'ipv6') {
                    if (!wantUdp) wantTcp = true;//if wantUdp flag was not set, have to activate default parameter
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 4
                if (args[5] === 'tcp') {
                    wantTcp = true;
                    wantIPV4 = true;
                } else if (args[5] === 'udp') {
                    wantUdp = true;
                    wantIPV4 = true;
                } else if (args[5] === 'ipv4') {
                    if (!wantUdp) wantTcp = true;//if wantUdp flag was not set, have to activate default parameter
                    wantIPV4 = true;
                } else if (args[5] === 'ipv6') {
                    if (!wantUdp) wantTcp = true;//if wantUdp flag was not set, have to activate default parameter
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                break;
            case 7://5 args
                //arg 1
                if (args[2].indexOf('.') !== -1 || args[2].indexOf(':') !== -1) {//arg 1 is hosts
                    ports = parsePorts(fullPortRange);
                    hosts = parseHosts(args[2]);
                } else if (parseInt(args[2])) {//arg 1 is ports
                    ports = parsePorts(args[2]);
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 2
                if (args[3].indexOf('.') !== -1 || args[3].indexOf(':') !== -1) {//arg 2 is hosts
                    if (hosts.length !== 0) {//hosts already present
                        showHelp();
                        process.exit(0);
                    }
                    hosts = parseHosts(args[3]);
                } else if (args[3] === 'tcp') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantTcp = true;
                } else if (args[3] === 'udp') {
                    if (hosts.length === 0) hosts = parseHosts(localhost);
                    else if (ports.length === 0) ports = parsePorts(fullPortRange);
                    wantUdp = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 3
                if (args[4] === 'tcp') {
                    wantTcp = true;
                } else if (args[4] === 'udp') {
                    wantUdp = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 4
                if (args[5] === 'tcp') {
                    wantTcp = true;
                } else if (args[5] === 'udp') {
                    wantUdp = true;
                } else if (args[5] === 'ipv4') {
                    if (!wantUdp) wantTcp = true;//if wantUdp flag was not set, have to activate default parameter
                    wantIPV4 = true;
                } else if (args[5] === 'ipv6') {
                    if (!wantUdp) wantTcp = true;//if wantUdp flag was not set, have to activate default parameter
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 5
                if (args[6] === 'ipv4') {
                    wantIPV4 = true;
                } else if (args[6] === 'ipv6') {
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                break;
            case 8://6 args
                //arg 1
                if (parseInt(args[2]) && args[2].indexOf('.') === -1 && args[2].indexOf(':') === -1) {//arg 1 is ports
                    ports = parsePorts(args[2]);
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 2
                if (args[3].indexOf('.') !== -1 || args[3].indexOf(':') !== -1) {//arg 2 is hosts
                    hosts = parseHosts(args[3]);
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 3
                if (args[4] === 'tcp') {
                    wantTcp = true;
                } else if (args[4] === 'udp') {
                    wantUdp = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 4
                if (args[5] === 'tcp') {
                    wantTcp = true;
                } else if (args[5] === 'udp') {
                    wantUdp = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 5
                if (args[6] === 'ipv4') {
                    wantIPV4 = true;
                } else if (args[6] === 'ipv6') {
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                //arg 6
                if (args[7] === 'ipv4') {
                    wantIPV4 = true;
                } else if (args[7] === 'ipv6') {
                    wantIPV6 = true;
                } else {
                    showHelp();
                    return process.exit(0);
                }
                break;
            default://too many args
                console.log('Too many args');
                showHelp();
                return process.exit(0);
        }
    } catch (e) {
        if (e instanceof err.BadHostNotationError) {
            console.log(e.name);
            console.log(e.message + ": " + e.host);
            console.log(e.stack);
            process.exit(1);
        } else if (e instanceof err.RangeError) {
            console.log(e.name);
            console.log(e.message + ": " + e.range);
            console.log(e.stack);
            process.exit(1);
        } else {
            console.log('Unknown error:');
            console.log(e.name);
            console.log(e.message);
            console.log(e.stack);
            process.exit(1);
        }
    }

    return {
        ports: ports,
        hosts: hosts,
        tcp: wantTcp,
        udp: wantUdp,
        ipv4: wantIPV4,
        ipv6: wantIPV6
    };
};

/*Main()*/{
    const scanParameters = parseArgs();
    console.log(scanParameters);
    if (scanParameters.tcp) {
        if (scanParameters.ipv4) scanPortRange(scanParameters.ports, scanParameters.hosts, 'tcp', 4);
        if (scanParameters.ipv6) scanPortRange(scanParameters.ports, scanParameters.hosts, 'tcp', 6);
    }
    if (scanParameters.udp) {
        if (scanParameters.ipv4) scanPortRange(scanParameters.ports, scanParameters.hosts, 'udp', 4);
        if (scanParameters.ipv6) scanPortRange(scanParameters.ports, scanParameters.hosts, 'udp', 6);
    }
}
