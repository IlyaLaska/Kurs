'use strict';

const net = require('net');
const dgram = require('dgram');

const Parser = require("./parser");


class Scanner {

    performScan() {
        const parser = new Parser();

        let success = [];
        new Promise((resolve) => {
            if(parser.scanParameters.tcp) {
                if(parser.scanParameters.ipv4) this.scanPortRange(parser.scanParameters.ports, parser.scanParameters.hosts, 'tcp', 4, (arg, scanRes) => {
                    success = scanRes;
                    resolve(arg);
                });
                if(parser.scanParameters.ipv6) this.scanPortRange(parser.scanParameters.ports, parser.scanParameters.hosts, 'tcp', 6, (arg, scanRes) => {
                    success = scanRes;
                    resolve(arg);
                });
            }
            if(parser.scanParameters.udp) {
                if(parser.scanParameters.ipv4) this.scanPortRange(parser.scanParameters.ports, parser.scanParameters.hosts, 'udp', 4, (arg, scanRes) => {
                    success = scanRes;
                    resolve(arg);
                });
                if(parser.scanParameters.ipv6) this.scanPortRange(parser.scanParameters.ports, parser.scanParameters.hosts, 'udp', 6, (arg, scanRes) => {
                    success = scanRes;
                    resolve(arg);
                });
            }
        }).then(res => {
            return this.showOpenGates(success);
        });

    }
    
    scanPortUDP(port, host, family, success, callback) {
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
                    if(callback) callback('timeout');
                }, 2000);
            }
        );

        socket.on('error', (err) => {
            console.log("called error");
            console.log(err);
            success.closed.push({port: port, host: host, method:'UDP', family: 'ipv' + family});
            // socket.unref();
            // socket.close();
            if(callback) callback('closed');
        });

        socket.on('message', (msg, info) => {
            console.log(`socket got: ${msg} from ${info.address}:${info.port}`);
            success.open.push({port: port, host: host, method:'UDP', family: 'ipv' + family});
            if(callback) callback('open');
        });

        socket.on('listening', () => {//empty arg list
            console.log(`server listening ${socket.address().address}:${socket.address().port}`);
        });
    };

    scanPort(port, host, family, success, callback) {
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
            success.open.push({
                port: socket.remotePort,
                host: socket.remoteAddress,
                method: 'TCP',
                family: 'ipv' + family
            });
            socket.unref();
            socket.end();
            if (callback) callback('open');
        });

        socket.on('data', (data) => {
            console.log(data.toString());
        });
    };

    scanPortRange(ports, hosts, method, family, callback) {
        let success = {
            open: [],
            closed: []
        };
        Promise.all(hosts.map(host => {
            return ports.map(port => {
                if (method === 'tcp') return new Promise((resolve, reject) => this.scanPort(port, host, family, success, (arg) => resolve(arg)));
                else if (method === 'udp') return new Promise((resolve, reject) => this.scanPortUDP(port, host, family, success, (arg) => resolve(arg)));
                else return Promise.reject('Unknown method used');
            });
        }).reduce((first, second) => first.concat(second), []))
            .then((res) => {
                if(callback) callback('done', success);
                else return this.showOpenGates(success);
            }, (err) => {
                console.log(err);
                process.exit(1);
            });
    };

    showOpenGates(success) {
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
}

module.exports = Scanner;
