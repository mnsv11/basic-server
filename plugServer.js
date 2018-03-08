let moment = require('moment');
let fs = require('fs');
let path = require('path');
let app = require('express')();
let bodyParser = require('body-parser');
let server = require('http').Server(app);
let io = require('socket.io')(server, {
    pingInterval: 10000,
    pingTimeout: 30000
});

let accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {
    flags: 'a'
});
let port = process.env.PORT || 3001;
let clients = [];


server.listen(port);

io.sockets.on('connect', function(client) {
    let timestamp = moment().format();
    clients.push(client);
    console.log(timestamp + ' [WS]: (' + client.id + ') Client connected');

    client.on('sessionStart', data => {
        console.log(
            timestamp + ' [WS]: (' + client.id + ') #sessionStart: ' + data
        );
    });

    client.on('sessionEnd', data => {
        console.log(
            timestamp + ' [WS]: (' + client.id + ') #sessionEnd: ' + data
        );
    });

    client.on('power', data => {
        console.log(timestamp + ' [WS]: (' + client.id + ') #power: ' + data);
    });

    client.on('currentUsingPower', data => {
        console.log(timestamp + ' [WS]: (' + client.id + ') #currentUsingPower: ' + data);
    });

    client.on('time', data => {
        console.log(timestamp + ' [WS]: (' + client.id + ') #time: ' + data);
    });

    client.on('disconnect', function() {
        clients.splice(clients.indexOf(client), 1);
        console.log(
            timestamp + ' [WS]: (' + client.id + ') Client disconnected'
        );
    });
});

const WifiPlugController = require('./controllers/wifiPlugController');
const wifiPlugController = new WifiPlugController(clients, io);

app.use(require('morgan')('combined', { stream: accessLogStream }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.route('/on').put((req, res) => wifiPlugController.on(req, res));
app.route('/on').options((req, res) => wifiPlugController.option(req, res));
app.route('/off').put((req, res) => wifiPlugController.off(req, res));
app.route('/off').options((req, res) => wifiPlugController.option(req, res));
app.route('/getKw').get((req, res) => wifiPlugController.getKw(req, res));
app.route('/getPowerUsage').get((req, res) => wifiPlugController.getPowerUsage(req, res));
app.route('/getUsedTime').get((req, res) => wifiPlugController.getUsedTime(req, res));
app.route('/getRelayState').get((req, res) => wifiPlugController.getRelayState(req, res));
app.route('/activate').put((req, res) => wifiPlugController.activate(req, res));
app.route('/activate').options((req, res) => wifiPlugController.option(req, res));
app.route('/addPaidPower').put((req, res) => wifiPlugController.addPaidPower(req, res));

let timestamp = moment().format();
console.log(timestamp + ' [Main]: Server listens on port: ' + port);
