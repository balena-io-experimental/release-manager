"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const App_1 = require("./App");
var sdk = require('balena-sdk').fromSharedOptions();
sdk.auth.logout();
sdk.auth.loginWithToken(process.env.BALENA_API_KEY).then(function () {
    const port = process.env.PORT || 3000;
    const app = new App_1.default(sdk).express;
    app.listen(port, (err) => {
        if (err) {
            return console.log(err);
        }
        return console.log(`server is starting on ${port}`);
    });
}).catch(function () {
    console.log("error authenticating with balena");
});
//# sourceMappingURL=index.js.map