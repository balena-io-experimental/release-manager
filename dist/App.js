"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
var truthy = require('truthy');
var bodyParser = require('body-parser');
var schedule = require('node-schedule');
class App {
    constructor(sdk) {
        this.express = express();
        this.sdk = sdk;
        this.mountRoutes();
    }
    // Get a list of available releases
    getReleaseList(appId) {
        return this.sdk.models.release.getAllByApplication(appId)
            .then(function (releases) {
            var list = releases.map(function (release) { return { id: release.id, commit: release.commit }; });
            return Promise.resolve(list);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }
    // Check if releaseHash is a valid release
    isValidRelease(appId, releaseHash) {
        return this.getReleaseList(appId)
            .then(function (list) {
            var hashes = list.map(function (release) { return release.commit; });
            return Promise.resolve(hashes.includes(releaseHash));
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }
    // Get the currently targeted default release for an app
    getDefaultReleaseHash(appId) {
        return this.sdk.models.application.getTargetReleaseHash(appId)
            .then(function (release) {
            return Promise.resolve(release);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }
    // Get the most recently built release for an app
    getLatestReleaseHash(appId) {
        return this.sdk.models.release.getLatestByApplication(appId)
            .then(function (release) {
            console.log("latest release: ", release.id);
            return Promise.resolve(release.commit);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }
    // Set the default release on an App
    setDefaultAppRelease(appId, fullReleaseHash) {
        return this.sdk.models.application.pinToRelease(appId, fullReleaseHash)
            .then(function () {
            console.log("set default release");
            return Promise.resolve(true);
        }).catch(function (err) {
            console.log("error setting default release");
            return Promise.reject(err);
        });
    }
    // Disable rolling releases and pin default to most recently built release
    disableReleaseTracking(appId, releaseHash) {
        return this.setDefaultAppRelease(appId, releaseHash)
            .then(function () {
            return Promise.resolve(true);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }
    // Enable release tracking on the specified app
    enableReleaseTracking(appId) {
        return this.sdk.models.application.trackLatestRelease(appId)
            .then(function () {
            return Promise.resolve(true);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }
    getDeviceList(appId, tag) {
        if (tag) {
            var options = {
                $filter: {
                    device_tag: {
                        $any: {
                            $alias: 'dt',
                            $expr: {
                                dt: {
                                    tag_key: tag
                                }
                            }
                        }
                    }
                }
            };
        }
        return this.sdk.models.device.getAllByApplication(appId, options)
            .then(function (devices) {
            var list = devices.map(function (device) {
                return { id: device.id,
                    uuid: device.uuid,
                    name: device.device_name,
                    current_release: device.is_on__commit,
                    online: device.is_online,
                    should_be_running__release: device.should_be_running__release };
            });
            return Promise.resolve(list);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }
    mountRoutes() {
        const router = express.Router();
        router.get('/', (req, res) => {
            res.json({
                message: 'Hello release manager!!!!'
            });
        });
        // Return the currenly account holder name
        router.get('/account', (req, res) => {
            this.sdk.auth.whoami().then(function (username) {
                if (!username) {
                    res.json({
                        message: 'Error: unauthorized'
                    });
                    console.log('No account logged in or token expired/revoked');
                }
                else {
                    res.json({
                        account: username
                    });
                    console.log('My username is:', username);
                }
            });
        });
        // Query status of release tracking
        router.get('/:appid/releasetracking', (req, res) => {
            var app = Number(req.params.appid);
            // TODO: validate the app id
            this.sdk.models.application.willTrackNewReleases(app)
                .then(function (isEnabled) {
                console.log(isEnabled);
                res.json({
                    releaseTracking: isEnabled
                });
            }).catch(function (err) {
                res.json({
                    error: err
                });
            });
        });
        router.post('/:appid/releasetracking', (req, res) => {
            var app = Number(req.params.appid);
            // TODO: validate the app id
            console.log(req.body);
            if (!req.body.status) {
                console.log("no value set");
                res.status(400).json({
                    error: "no request body"
                });
            }
            else {
                // TODO validate status to ensure its 1 or 0
                var state = truthy(req.body.status);
                if (!state) {
                    //set fleet state here
                    console.log("disabling release tracking");
                    if (req.body.releaseHash) {
                        // if a release is supplied
                        var releaseHash = req.body.releaseHash;
                        // TODO check if releaseHash is part of list of releases
                        this.isValidRelease(app, releaseHash).then((isValid) => {
                            console.log("isValid: ", isValid);
                            if (isValid) {
                                this.disableReleaseTracking(app, releaseHash)
                                    .then(function () {
                                    res.json({
                                        releaseTracking: false
                                    });
                                }).catch(function (err) {
                                    res.json({
                                        error: err
                                    });
                                });
                            }
                            else {
                                res.json({
                                    error: "release " + releaseHash + " doesn't exist in App " + app
                                });
                            }
                        });
                    }
                    else {
                        // if no release set, set it to the latest
                        this.getLatestReleaseHash(app)
                            .then((latestRelease) => {
                            console.log("latestRelease: ", latestRelease);
                            this.disableReleaseTracking(app, latestRelease)
                                .then(function () {
                                res.json({
                                    releaseTracking: false
                                });
                            }).catch(function (err) {
                                res.json({
                                    error: err
                                });
                            });
                        });
                    }
                }
                else {
                    this.enableReleaseTracking(app)
                        .then(function () {
                        res.json({
                            releaseTracking: true
                        });
                    }).catch(function (err) {
                        res.json({
                            error: err
                        });
                    });
                }
            }
        });
        router.get('/:appid/schedulerelease', (req, res) => {
            var app = Number(req.params.appid);
            var date = new Date(2018, 10, 30, 16, 30, 0, 0);
            console.log("scheduling release for ", date.toLocaleString());
            var j = schedule.scheduleJob(date.toLocaleString(), function () {
                console.log('Setting new release for App: ', app);
            });
        });
        // Get list of release for an app
        router.get('/:appid/releases', (req, res) => {
            var app = Number(req.params.appid);
            // TODO: validate the app id
            this.getReleaseList(app)
                .then(function (list) {
                //console.log(list)
                res.json({
                    releases: list
                });
            }).catch(function (err) {
                res.json({
                    error: err
                });
            });
        });
        //Get list of device in app
        router.get('/:appid/devices', (req, res) => {
            var app = Number(req.params.appid);
            // TODO: validate the app id
            var tag = (req.query.tag) ? String(req.query.tag) : '';
            console.log("query.tag: ", req.query.tag);
            this.getDeviceList(app, tag)
                .then(function (list) {
                res.json({
                    devices: list
                });
            }).catch(function (err) {
                res.json({
                    error: err
                });
            });
        });
        this.express.use(bodyParser.json()); // for parsing application/json
        this.express.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-
        this.express.use('/', router);
    }
}
exports.default = App;
//# sourceMappingURL=App.js.map