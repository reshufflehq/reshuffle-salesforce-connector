# reshuffle-salesforce-connector

[Code](https://github.com/reshufflehq/reshuffle-salesforce-connector) |
[npm](https://www.npmjs.com/package/reshuffle-salesforce-connector) |
[Code sample](https://github.com/reshufflehq/reshuffle-salesforce-connector/examples)

`npm install reshuffle-salesforce-connector`

### Reshuffle Salesforce Connector

This package contains a [Reshuffle](https://github.com/reshufflehq/reshuffle)
connector to [Salesforce](https://www.salesforce.com/).

The following example tracks changes to account names:

```js
const { Reshuffle } = require('reshuffle')
const { SalesforceConnector } = require('reshuffle-salesforce-connector')

;(async () => {
  const app = new Reshuffle()
  const sf = new SalesforceConnector(app, {
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    baseURL: process.env.RESHUFFLE_RUNTIME_BASE_URL,
    encryptionKey: process.env.RESHUFFLE_ENCRYPTION_KEY,
  })

  app.start(8000)  // Listen to HTTP for authentication

  console.log('Authenticate with Salesforce')
  await sf.authenticate()
  console.log('Authenticated')

  sf.on({ query: 'SELECT Id,Name FROM Account' }, async (event, app) => {
    console.log(event)
  })

  console.log('Edit an account name to trigger an event...')

})().catch(console.error)
```

#### Table of Contents

[Configuration](#configuration) Configuration options

_Connector events_:

[query](#query) Query result changed

_Connector actions_:

[authenticate](#authenticate) Authenticate against Salsforce

[query](#query) Query Salesforce data

[map](#map) Process a collection of Salesforce objects

[sobject](#sobject) Access a Salesforce object type

_SDK_:

[sdk](#sdk) Get direct JSForce SDK access

##### <a name="configuration"></a>Configuration options

The first step to access Salesforce is to create a new Connected App. You can
do this by accessing the settings on your Salesforce platform. See
[this guide](https://help.salesforce.com/articleView?id=connected_app_create.htm)
for details.

The app should have OAuth access enabled with the following scopes:
* Full access (full)
* Perform requests on your behalf at any time (refresh_token, offline_access)

You can limit the app to only support certain operations, by replacing "Full
access" with more specific scopes.

Once the app is created, copy the clientId (Consumer Key) and clientSecret
(Consumer Secret). We recommend configuring them in the environment variables
like so:

```js
const app = new Reshuffle()
const salesforceConnector = new SalesforceConnector(app, {
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    baseURL: process.env.RESHUFFLE_RUNTIME_BASE_URL,
    encryptionKey: process.env.RESHUFFLE_ENCRYPTION_KEY,
})
```

The configuration also uses `RESHUFFLE_RUNTIME_BASE_URL` to point to the base
URL of the server hosting the Reshuffle runtime, and `RESHUFFLE_ENCRYPTION_KEY`
which is a 64 digit hex string (32 bytes) which is used to encpyt the access
tokens received from Salesforce during the authentication process.

#### Connector events

##### <a name="query"></a>Query event

_Example:_

```js
async (event, app) => {
  console.log('Salesforce event:', event)
})
```

This event is fired when the result of a query changes. This could be when
a new object is added, and existing object removed, or one of the queried
fields changes.

For example, the following event will trigger when a new Account object is
created, when an Account object is removed or when an account name changes:

```js
salesforceConnector.on(
  { query: 'SELECT Id,Name FROM Account' },
  async (event, app) => {
    console.log(event)
  },
)
```

Note that the event will not trigger if other fields, like the account owner,
are changed. You can exapnd the query to SELECT other fields as well. In this
case these fields will also trigger the event and will be returned in the
event object.

#### Connector actions

##### <a name="authenticate"></a>Authenticate action

_Definition:_

```ts
() => void
```

_Usage:_

```js
await salesforceConnector.authenticate()
```

Authenticate against the Salesforce API. This action return immediately if
a connection is already authenticated or if it finds valid access tokens
in the datastore and is able to connect with Salesforce.

If it does not have valid access token, the action attempts to open a browser
to allow the user to authenticate through a standard OAuth flow.

Note that in order to complete the OAuth flow, Reshuffle must be accessible
from the Internet, with its base URL provided to the connector config
(typically through the RESHUFFLE_RUNTIME_BASE_URL environment variable). If
Reshuffle is running on your dev machine, we recommend using
[ngrok](https://ngrok.com) to expose a local port to the world (see example
in the scripts section of package.json).

When Reshuffle is running on a server, you can use the `authenticator` utility
provided with this connector to start the authentication process from your
(or your user's) machine.

##### <a name="query"></a>Query action

_Definition:_

```ts
(
  query: string,
) => object
```

_Usage:_

```js
const res = await salesforceConnector.query('SELECT Id, Name FROM Account')
console.log('Salesforce accounts:')
for (const account of res.records) {
  console.log(' ', account.Id, account.Name)
}
```

Query Salesforce for data.

##### <a name="map"></a>Map action

_Definition:_

```ts
(
  type: string,
  func: object => void,
) => object
```

_Usage:_

```js
const res = await salesforceConnector.map('Account', async (account) => {
  if (account.Name.startsWith('A')) {
    console.log(account)
  }
})
```

Apply a JavaScript function to process a collection of Salesforce objects
of the specified type.

##### <a name="sobject"></a>Sobject action

_Definition:_

```ts
(
  type: string,
) => object
```

_Usage:_

```js
const account = await salesforceConnector.sobject('Account')
const res = account.find({ Name: 'Acme' }, '*')
})
```

Get an accessor to a Salesforce object type. The accessor provides methods for
finding objects of this type and provide CRUD operations on this type of
object.

#### SDK

##### <a name="sdk"></a>SDK action

_Definition:_

```ts
() => object
```

_Usage:_

```js
const conn = await salesforceConnector.sdk()
```

The connector uses [JSForce](https://jsforce.github.io/) to connect with
Salesforce. This action returns the underlying JSForce connection so you can
directly access its [methods](https://jsforce.github.io/document).
