let TPLink = require('tplink-cloud-api');
let uuidV4 = require('uuid/v4');


const TPLINK_TERM = process.env.TPLINK_TERM || uuidV4();
let deviceList;
let myTPLink;
let myPlug;
let allowedUsage =  0;
let startValue;
let powerEnable = true;
let totOnTime = 0;
let tempTime = 0;
let powerUsage = [];
module.exports = class WifiPlugController {


    constructor(clients, io) {
        this.io = io;
        this.connect();
    }

    /**
     * Conect to TP link
     * @returns {Promise.<void>}
     */
    async connect() {
        myTPLink = await TPLink.login('mattias.svedklint@ericsson.com', 'fuonApp', TPLINK_TERM);
        deviceList = await myTPLink.getDeviceList();
        myPlug = myTPLink.getHS110("My Smart Plug");
        await myPlug.powerOff();
        this.setStartValue();
        this.controlUsage();
        this.updateOnTime();
        this.updatePowerUsage();
    }

    /**
     * Turn off power
     * @param req
     * @param res
     * @returns {Promise.<void>}
     */
    async off(req, res){
        console.log('turn off plug');
        this.setHeader(res);
        await myPlug.powerOff();
        this.updateOnTime();
        res.send(200);
    }

    /**
     * Turn on Power
     * @param req
     * @param res
     * @returns {Promise.<void>}
     */
    async on(req, res){
        console.log('turn on plug');
        this.setHeader(res);
        await myPlug.powerOn();
        this.updateOnTime();
        res.send(200);

    }

    /**
     * Get current used time
     * @param req
     * @param res
     * @returns {Promise.<void>}
     */
    async getUsedTime(req, res){
        this.setHeader(res);
        console.log('getUsedTime');
        let sysInfo = await myPlug.getSysInfo();
        res.json(sysInfo);
    }

    /**
     * Get power information
     * @param req
     * @param res
     * @returns {Promise.<void>}
     */
    async getKw(req, res){
        this.setHeader(res);
        console.log('getKw');
        let power = await myPlug.getPowerUsage();
        res.json(power);
    }


    /**
     * Get state if power is on or off
     * @param req
     * @param res
     * @returns {Promise.<void>}
     */
    async getRelayState (req, res) {
        let state = await myPlug.get_relay_state();
        this.setHeader(res);
        res.json({state: state});
    }

    /**
     * Get power information
     * @param req
     * @param res
     */
    getPowerUsage (req, res) {
        this.setHeader(res);
        res.json(powerUsage);
    }

    /**
     * Activate power and set new usage value
     * @param req
     * @param res
     * @returns {Promise.<void>}
     */
    async activate(req, res){
        this.setHeader(res);
        allowedUsage = req.body.usageValue;
        console.log('Activate and set allow usage ' + allowedUsage);
        await myPlug.powerOn();
        this.setStartValue();
        powerEnable = true;
        this.updateOnTime();
        this.updatePowerUsage();
        res.json({ message: `WiFi Plug is activated` });
    }

    addPaidPower(req, res) {
        allowedUsage = req.body.usageValue;
        console.log('Set allow usage ' + allowedUsage);
    }

    /**
     * start interval to check if user used more power then it is paid for
     */
    controlUsage() {
        setInterval(() => {
            this.updatePowerLeftToUse();
            this.updateOnTime();
        }, 5000);

        setInterval(() => {
            this.updatePowerUsage();
        }, 60000);
    }

    /**
     * Set value to control usage from
     * @returns {Promise.<void>}
     */
    async setStartValue () {
        startValue = await myPlug.getPowerUsage();
        console.log('set start value ' + startValue.total);
    }

    /**
     * Check used power, if used all prepaid it will turn off power;
     * @returns {Promise.<void>}
     */
    async updatePowerLeftToUse() {

        let powerInfo = await myPlug.getPowerUsage();
        let usedPower = (Number(powerInfo.total.toFixed(3)) - Number(startValue.total.toFixed(3))).toFixed(3);
        let endValue = Number((Number(startValue.total.toFixed(3)) + allowedUsage).toFixed(3));
        this.io.emit('power', {usedPower: Number(usedPower), maxToUse: allowedUsage});
        if (Number(powerInfo.total.toFixed(3)) >= endValue && powerEnable) {
            await myPlug.powerOff();
            powerEnable = false;
            this.updatePowerUsage();
            this.updateOnTime();
            console.log('Power off, out of prepaid power');
        }
    }

    /**
     * Update time and power usage
     * @returns {Promise.<void>}
     */
    async updateOnTime () {
        let sysInfo = await myPlug.getSysInfo();
        let powerInfo = await myPlug.getPowerUsage();

        let endValue = Number((Number(startValue.total.toFixed(3)) + allowedUsage).toFixed(3));
        let powerLeft = Number((endValue - powerInfo.total).toFixed(3));
        let secondsLeft = 0;

        if(powerLeft > 0) {
            secondsLeft = Math.ceil((3600 / powerInfo.power) * (powerLeft * 1000));
        }
        if(sysInfo.on_time === 0 && tempTime > 0) {
            totOnTime += tempTime;
        }
        tempTime = sysInfo.on_time;
        this.io.emit('time', {currentOnTime: sysInfo.on_time, totOnTime: totOnTime, power: powerInfo.power, secondsLeft: secondsLeft});
    }

    /**
     * Update amount of watts that is used
     * @returns {Promise.<void>}
     */
    async updatePowerUsage() {
        let powerInfo = await myPlug.getPowerUsage();
        powerUsage.push({value: powerInfo.power, date: new Date()});

        if (powerUsage.length === 121) {
            powerUsage.shift();
        }
        this.io.emit('currentUsingPower', powerUsage);
    }

    /**
     * Set headers on response
     * @param res
     */
    setHeader(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept'
        );
        res.setHeader(
            'Access-Control-Allow-Methods',
            'PUT, POST, GET, PATCH, DELETE, OPTIONS'
        );
        res.setHeader('Content-Type', 'application/json');
    }


    /**
     * Handler options request
     * @param req
     * @param res
     */
    option (req, res) {
        this.setHeader(res);
        res.send(200);
    }
};

