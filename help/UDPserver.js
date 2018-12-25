'use strict';

let dgram = require('dgram');

const startUDPserver = (port, host, family) => {
    const fam = 'udp' + family;
    console.log(fam);
    const server = dgram.createSocket(fam);
    server.bind(port, host);
    server.on('error', (err) => {
        console.log(`server error:\n${err.stack}`);
        server.close();
    });
    server.on('message', (msg, rinfo) => {
        console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
        server.send('Packet received', 0, 15, rinfo.port, rinfo.address, (err, bytes) => {
            console.log(err);
            console.log('Used bytes: ', bytes);
        });
    });
    server.on('listening', () => {
        const address = server.address();
        console.log(`server listening ${address.address}:${address.port}`);
    });
};

/*Main()*/{
    const port = process.argv[2] || '90';
    const host = process.argv[3] || '192.168.1.212';
    const family = process.argv[4] || 4;
    startUDPserver(port, host, family);
}
