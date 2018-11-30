import App from './App'
var sdk = require('balena-sdk').fromSharedOptions()

sdk.auth.logout()
sdk.auth.loginWithToken(process.env.BALENA_API_KEY).then( function () {
  const port = process.env.PORT || 3000
  const app = new App(sdk).express

  app.listen(port, (err) => {
    if (err) {
      return console.log(err)
    }
    return console.log(`server is starting on ${port}`)
  })
}).catch(function (){
  console.log("error authenticating with balena")
})

