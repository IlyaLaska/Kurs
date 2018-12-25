'use strict';

const net = require('net');

const startTCPserver = (port, host) => {
    let server = net.createServer();
    server.listen(parseInt(port), host, () => {//no args
        console.log('SERVER IS ON');
    });

    server.on('error', err => {
        console.log(`server error:\n${err.stack}`);
        server.unref();
        server.end();
    });

    server.on('connection', (info) => {//only 1 arg
        // console.log(info);
    });

    server.on('data', (msg, rinfo) => {
        console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
        // console.log(data.toString());
    });
};

/*Main()*/{
    const port = process.argv[2] || '100';
    const host = process.argv[3] || '192.168.1.212';
    const family = process.argv[4] || 4;
    startTCPserver(port, host, family);
}
