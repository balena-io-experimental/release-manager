import * as express from 'express'
var truthy = require('truthy');
var bodyParser = require('body-parser');
var schedule = require('node-schedule');

class App {
  public express
  sdk;
  constructor (sdk) {
    this.express = express()
    this.sdk = sdk
    this.mountRoutes()
  }

  // Get a list of available releases
  private getReleaseList (appId) {
    return this.sdk.models.release.getAllByApplication(appId)
        .then(function(releases) {
          var list = releases.map(function(release) {return {id: release.id, commit: release.commit}})
          return Promise.resolve(list);
        }).catch(function(err) {
          return Promise.reject(err);
        });
  }

  // Check if releaseHash is a valid release
  private isValidRelease (appId, releaseHash) {
    return this.getReleaseList(appId)
      .then(function(list) {
        var hashes = list.map(function(release) {return release.commit})
        return Promise.resolve(hashes.includes(releaseHash));
      }).catch(function(err) {
        return Promise.reject(err);
      });
  }

  // Get the currently targeted default release for an app
  private getDefaultReleaseHash (appId) {
    return this.sdk.models.application.getTargetReleaseHash(appId)
      .then(function(release) {
        return Promise.resolve(release);
      }).catch(function(err) {
        return Promise.reject(err);
      });
  }

  // Get the most recently built release for an app
  private getLatestReleaseHash (appId) {
    return this.sdk.models.release.getLatestByApplication(appId)
      .then(function(release) {
        console.log("latest release: ", release.id)
        return Promise.resolve(release.commit);
      }).catch(function(err) {
        return Promise.reject(err);
      });
  }

  // Set the default release on an App
  private setDefaultAppRelease (appId, fullReleaseHash) {
    // TODO: validate release is part of release list
    return this.sdk.models.application.pinToRelease(appId, fullReleaseHash)
      .then(function() {
        console.log("set default release")
        return Promise.resolve(true);
      }).catch(function(err) {
        console.log("error setting default release")
        return Promise.reject(err);
      });
  }

  private setDevicesRelease (appId, fullReleaseHash, tag?) {
    let promises = []
    this.getDeviceList(appId, tag).then(devices => {
      promises = devices.forEach(device => {
        return this.sdk.models.device.pinToRelease(device.uuid, fullReleaseHash)
          .then( function() {
            console.log("pinning device ", device.uuid, " to release ", fullReleaseHash)
            return Promise.resolve(device);
          })
      });
    })
    return Promise.all(promises)
  }

  private resetDevicesToAppRelease (appId, tag?) {
    let promises = []
    this.getDeviceList(appId, tag).then(devices => {
      promises = devices.forEach(device => {
        return this.sdk.models.device.trackApplicationRelease(device.uuid)
          .then( function() {
            console.log("resetting device: ", device.uuid)
            return Promise.resolve(device);
          }).catch(function(err) {
            console.log("error resetting default release for device ", device.uuid)
            return Promise.reject(err);
          });
      });
    })
    return Promise.all(promises)
  }

  // Disable rolling releases and pin default to most recently built release
  private disableReleaseTracking (appId, releaseHash) {
    return this.setDefaultAppRelease(appId, releaseHash)
      .then(function() {
        return Promise.resolve(true);
      }).catch(function(err) {
        return Promise.reject(err);
      });
  }

  // Enable release tracking on the specified app
  private enableReleaseTracking (appId) {
    return this.sdk.models.application.trackLatestRelease(appId)
      .then(function() {
        return Promise.resolve(true);
      }).catch(function(err) {
        return Promise.reject(err);
      });
  }

  private getDeviceList (appId, tag?) {
    if (tag){
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
      }
    }
    return this.sdk.models.device.getAllByApplication(appId, options)
      .then(function(devices) {
        var list = devices.map(function(device) {
          return {id: device.id, 
                  uuid: device.uuid, 
                  name: device.device_name, 
                  current_release: device.is_on__commit, 
                  online: device.is_online,
                  should_be_running__release: device.should_be_running__release }
                })
        return Promise.resolve(list);
      }).catch(function(err) {
        return Promise.reject(err);
      });

  }
  

  private mountRoutes (): void {

    const router = express.Router()

    router.get('/', (req, res) => {
      res.json({
        message: 'Hello release manager!!!!'
      })
    })
    
    // Return the currenly account holder name
    router.get('/account', (req, res) =>{
      this.sdk.auth.whoami().then(function(username) {
        if (!username) {
          res.json({
            message: 'Error: unauthorized' 
          })
          console.log('No account logged in or token expired/revoked');
        } else {
          res.json({
            account: username 
          })
          console.log('My username is:', username);
        }
      });
    })

    // Query status of release tracking
    router.get('/:appid/releasetracking', (req, res) => {
      var app = Number(req.params.appid);
      // TODO: validate the app id
      this.sdk.models.application.willTrackNewReleases(app)
        .then(function(isEnabled) {
          console.log(isEnabled);
          res.json({
            releaseTracking: isEnabled
          })
        }).catch(function(err) {
          res.json({
            error: err
          })
        });
    })

    router.post('/:appid/releasetracking', (req, res) => {
      var app = Number(req.params.appid);
      // TODO: validate the app id
      console.log(req.body)
      if(!req.body.status) {
        console.log("no value set")
        res.status(400).json({
          error: "no request body"
        })
      } else {
        // TODO validate status to ensure its 1 or 0
        var state = truthy(req.body.status)
        if (!state){
          //set fleet state here
          console.log("disabling release tracking")
          if (req.body.releaseHash) {
            // if a release is supplied
            var releaseHash = req.body.releaseHash
            // TODO check if releaseHash is part of list of releases
            this.isValidRelease(app, releaseHash).then((isValid) => {
              console.log("isValid: ", isValid)
              if (isValid) {
                this.disableReleaseTracking(app, releaseHash)
                .then(function() {
                  res.json({
                    releaseTracking: false
                  })
                }).catch(function(err) {
                  res.json({
                    error: err
                  })
                });
              } else {
                res.json({
                  error: "release "+ releaseHash +" doesn't exist in App "+ app 
                })
              }
            })
          } else {
            // if no release set, set it to the latest
            this.getLatestReleaseHash(app)
              .then((latestRelease) => {
                console.log("latestRelease: ",latestRelease)
                this.disableReleaseTracking(app, latestRelease)
                  .then(function() {
                    res.json({
                      releaseTracking: false
                    })
                  }).catch(function(err) {
                    res.json({
                      error: err
                    })
                  });
              })
          }
        } else {
          this.enableReleaseTracking(app)
            .then(function() {
              res.json({
                releaseTracking: true
              })
            }).catch(function(err) {
              res.json({
                error: err
              })
            });
        }
      }
    })

    router.post('/:appid/schedule', (req, res) => {
      var app = Number(req.params.appid);
      var release = req.body.release;
      var reqDatetime = String(req.body.datetime);
      var datetime = new Date(reqDatetime);
      console.log("scheduling release %s on %s at %s",release ,app , datetime.toLocaleString())
      var j = schedule.scheduleJob(datetime.toLocaleString(), () => {
        this.setDefaultAppRelease(app, release)
          .then(() => {
            console.log('Deloy new Default release %s on App %s ',release , app);
          }).catch(() => {
            console.log("Error deploying release %s to App %s", release, app);
          });
      });
      res.json({
        message: "release "+ release + " on App "+ app +" scheduled for "+datetime
      })
    })

    // Get list of release for an app
    router.get('/:appid/releases', (req, res) => {
      var app = Number(req.params.appid);
      // TODO: validate the app id
      this.getReleaseList(app)
        .then(function(list) {
          //console.log(list)
          res.json({
            releases: list
          })
        }).catch(function(err) {
          res.json({
            error: err
          })
        });
    })

    // Reset app to release tracking and all devices to follow latest
    router.get('/:appid/reset', (req, res) => {
      var app = Number(req.params.appid);
      // TODO: validate the app id
      var tag = (req.query.tag) ? String(req.query.tag) : '';
      this.enableReleaseTracking(app)
          .then(() => {
            this.resetDevicesToAppRelease(app, tag)
              .then(function() {
                res.json({
                  releaseTracking: true,
                })
              })
              .catch(function(err) {
                res.json({
                  error: err
                })
              });
          })
          .catch(function(err) {
            res.json({
              error: err
            })
          });
    })

    //Get list of device in app
    router.get('/:appid/devices', (req, res) => {
      var app = Number(req.params.appid);
      // TODO: validate the app id
      var tag = (req.query.tag) ? String(req.query.tag) : '';

      this.getDeviceList(app, tag)
        .then(function(list) {
          res.json({
            devices: list
          })
        }).catch(function(err) {
          res.json({
            error: err
          })
        });
    })
    
    //Set all or a group of devices to a specific release
    // requires post with releaseHash and optionally tag
    router.post('/:appid/devices/release', (req, res) => {
      var app = Number(req.params.appid);
      // TODO: validate the app id

      if(!req.body.releaseHash) {
        console.log("no value set")
        res.status(400).json({
          error: "no request body"
        })
      } else {
        if (req.body.releaseHash) {
          // if a release is supplied
          var releaseHash = req.body.releaseHash
          var tag = (req.body.tag) ? String(req.body.tag) : '';
          this.isValidRelease(app, releaseHash).then((isValid) => {
            console.log("isValid: ", isValid)
            if (isValid) {
              this.setDevicesRelease(app, releaseHash, tag).then(() => {
                console.log("ran setDeviceRelease")
                res.json({
                  message: "ok" 
                })
              })
            } else {
              res.json({
                error: "release "+ releaseHash +" doesn't exist in App "+ app 
              })
            }
          })
        }
      }
    })

    this.express.use(bodyParser.json()); // for parsing application/json
    this.express.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-
    this.express.use('/', router)
  }
}

export default App