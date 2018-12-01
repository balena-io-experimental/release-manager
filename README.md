# Usage

1. Clone the repo
2. change directory into `release-manager` and run `npm install`
3. set your balena API token in the terminal by `export BALENA_API_KEY=123deadbeef456789`. To get your token, follow the [Balena API Token docs](https://www.balena.io/docs/learn/manage/account/#api-keys).
4. Start the server with `npm start`
5. I recommend testing the service using the [postman app](https://www.getpostman.com/). You should be able to hit the api at http://localhost:3000/account

# API

### `GET` /account

Checks what account the server is performing actions as.

return example:
```
{
    "account": "shaun_projects"
}
```

### `GET` /:appid/releases

Fetches a list of the releases for a application defined by appid

return example:
```
{
    "releases": [
        {
            "id": 683039,
            "commit": "3d98372c3a00678d196b11a418078880"
        },
        {
            "id": 682178,
            "commit": "6c04bbf613c2630acd37b9d5d2223d78"
        },
        {
            "id": 682176,
            "commit": "7ec70eabf84ef3c030e908b8913d44a6"
        }
    ]
}
```

### `GET` /:appid/releasetracking

Get the status of whether or not your application has rolling releases (release tracking) enabled.

return example:
```
{
    "releaseTracking": false
}
```

### `POST` /:appid/releasetracking

Allows enabling/disabling release tracking. It optionally allows you to set the releaseHash of the default application release when disabling release tracking.

request Header:
- Content-Type: application/x-www-form-urlencoded

request body:
- status: `<bool>`
- releaseHash: `<releaseHash>`

The releaseHash field is **optional** and when left out, the application will be pinned to the most recently built release.

return example:
```
{
    "releaseTracking": false
}
```

### `GET` /:appid/devices

Returns a list of devices associated with the application

optional query params:
tag: <Any device tag value>

return example:
```
{
    "devices": [
        {
            "id": 1433539,
            "uuid": "3e6c5a7c229e238e62261349dc410582",
            "name": "ancient-wildflower",
            "current_release": "6c04bbf613c2630acd37b9d5d2223d78",
            "online": false,
            "should_be_running__release": null
        },
        {
            "id": 1433538,
            "uuid": "9eeac57c49dbd5b4963d390e259b5dca",
            "name": "blue-glade",
            "current_release": "6c04bbf613c2630acd37b9d5d2223d78",
            "online": false,
            "should_be_running__release": null
        },
        {
            "id": 1433536,
            "uuid": "eef73b4ba86b3e635c28732ab5b743fd",
            "name": "delicate-shadow",
            "current_release": "6c04bbf613c2630acd37b9d5d2223d78",
            "online": false,
            "should_be_running__release": null
        },
        {
            "id": 1433537,
            "uuid": "2acfc7f92d60b39077b7356045553e67",
            "name": "divine-river",
            "current_release": "6c04bbf613c2630acd37b9d5d2223d78",
            "online": false,
            "should_be_running__release": null
        },
        {
            "id": 1433541,
            "uuid": "ff692e4c3d5d64e4d23855b70a79b3b6",
            "name": "lingering-frost",
            "current_release": "6c04bbf613c2630acd37b9d5d2223d78",
            "online": false,
            "should_be_running__release": null
        },
        {
            "id": 1433540,
            "uuid": "df1417e29038efa56a45418554679a66",
            "name": "silent-bush",
            "current_release": "6c04bbf613c2630acd37b9d5d2223d78",
            "online": false,
            "should_be_running__release": null
        }
    ]
}
```