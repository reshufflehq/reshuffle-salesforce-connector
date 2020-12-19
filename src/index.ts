import crypto from 'crypto'
import jsforce from 'jsforce'
import { Request, Response } from 'express'
import { Barrier } from './barrier'
import { encrypt, decrypt } from './encrypt'
import {
  CoreConnector,
  CoreEventHandler,
  Options,
  Reshuffle,
} from './CoreConnector'
import {
  AUTHPATH,
  openAuthenticationWindow,
  validateBaseURL,
  validateClientId,
  validateClientSecret,
  validateEncryptionKey,
  validateQuery,
  validateToken,
} from './common'

interface EventOptions {
  query: string
}

interface Account {
  clientId: string
  clientSecret: string
  redirectUri: string
}

interface Credentials {
  accessToken: string
  refreshToken: string
  instanceUrl: string
}

const NotAuthenticatedError = 'Not authenticated'

export class SalesforceConnector extends CoreConnector {
  private account: Account
  private key: Buffer
  private credentials?: Credentials
  private connection?: jsforce.Connection
  private authorizationBarrier = new Barrier()

  constructor(app: Reshuffle, options: Options, id?: string) {
    super(app, options, id)

    this.account = {
      clientId: validateClientId(options.clientId),
      clientSecret: validateClientSecret(options.clientSecret),
      redirectUri: validateBaseURL(options.baseURL) + AUTHPATH,
    }
    this.key = validateEncryptionKey(options.encryptionKey)

    if (options.accessToken) {
      this.credentials = {
        accessToken: validateToken(options.accessToken),
        refreshToken: validateToken(options.refreshToken),
        instanceUrl: validateBaseURL(options.instanceUrl),
      }
    } else {
      app.registerHTTPDelegate(AUTHPATH, this as any)
    }
  }

  private async getConnection() {
    if (this.connection) {
      return this.connection
    }

    if (this.credentials) {
      const encrypted = encrypt(JSON.stringify(this.credentials), this.key)
      await this.store.update('credentials', async () => encrypted)
    } else {
      const encrypted = await this.store.get('credentials')
      if (!encrypted) {
        throw new Error(NotAuthenticatedError)
      }
      this.credentials = JSON.parse(decrypt(encrypted, this.key))
    }

    const conn = new jsforce.Connection({
      oauth2: new jsforce.OAuth2(this.account),
      ...this.credentials,
    })

    return this.setConnection(conn)
  }

  public async handle(req: Request, res: Response) {
    if (req.method === 'GET' && req.path === AUTHPATH) {
      await this.handleAuthCode(req.query.code, res)
      return true
    } else {
      return false
    }
  }

  private async handleAuthCode(code: any, res: Response) {
    if (typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).send('Invalid code')
    }

    try {
      const conn = new jsforce.Connection({
        oauth2: new jsforce.OAuth2(this.account),
      })
      const userInfo = await conn.authorize(code)

      this.credentials = {
        accessToken: conn.accessToken,
        refreshToken: conn.refreshToken!,
        instanceUrl: conn.instanceUrl,
      }
      console.log(`SalesforceConnector: Authorized as ${
        userInfo.id} of ${userInfo.organizationId} (${userInfo.url})`)

      const encrypted = encrypt(JSON.stringify(this.credentials), this.key)
      await this.store.update('credentials', async () => encrypted)

      await this.setConnection(conn)

      res.send(
        '<html><head><title>Authenticated</title></head><body>' +
        '<h1>Authentication successful</h1>' +
        '<p>You can safely close this window</p>' +
        '</body></html>'
      )
    } catch (e) {
      console.error(e)
      res.status(500).send('Error authenticating with Salesforce')
    }
  }

  private async setConnection(connection: jsforce.Connection) {
    this.connection = connection

    this.connection.on('refresh', async (accessToken: string) => {
      console.log('SalesforceConnector: Access token refreshed')
      await this.store.update('credentials', async (encrypted) => {
        const credentials = JSON.parse(decrypt(encrypted, this.key))
        credentials.accessToken = accessToken
        return encrypt(JSON.stringify(credentials), this.key)
      })
    })

    await this.createPushTopicsForAllEvents()

    this.authorizationBarrier.arrive()

    return this.connection
  }

  // Events /////////////////////////////////////////////////////////

  public async onStart() {
    await super.onStart()
    await this.createPushTopicsForAllEvents()
  }

  private async createPushTopicsForAllEvents() {
    if (!this.started || !this.connection) {
      return
    }
    console.log('SalesforceConnector: creating push topics for events')
    const optsArray = this.eventManager.mapEvents((ec) => ec.options)
    await Promise.all(
      optsArray.map((opts) => this.createPushTopic(opts.name, opts.query))
    )
  }

  public on(
    options: EventOptions,
    handler: CoreEventHandler,
    eventId?: string,
  ) {
    const queries = this.eventManager.mapEvents((ec) => ec.options.query)

    const query = validateQuery(options.query)
    const name = this.queryToName(query)
    const opts = { query, name }
    const eid = eventId || { account: this.account, options: opts }
    const ec = this.eventManager.addEvent(opts, handler, eid)

    if (this.started && this.connection && !queries.includes(query)) {
      void this.createPushTopic(name, query)
    }

    return ec
  }

  private queryToName(query: string): string {
    const hash = crypto.createHash('md5').update(query).digest()
    const length = hash.length >> 1
    const buffer = Buffer.alloc(length)
    for (let i = 0; i < length; i++) {
      buffer[i] = hash[i] ^ hash[length + i]
    }
    return buffer.toString('hex')
  }

  private async createPushTopic(name: string, query: string) {
    console.log(`SalesforceConnector: listening for query: ${query} (${name})`)

    const topic = {
      Name: name,
      Query: query,
      ApiVersion: 49,
      IsActive: true,
      NotifyForFields: 'Referenced',
      NotifyForOperationCreate: true,
      NotifyForOperationUpdate: true,
      NotifyForOperationDelete: true,
      NotifyForOperationUndelete: true,
    }

    const pts = await this.connection!.sobject('PushTopic')
    const res = await pts.find({ Name: name }, 'Id')
    if (res.length === 0) {
      await pts.create(topic)
    } else {
      await pts.update({ Id: res[0].Id, ...topic })
    }

    this.connection!.streaming.topic(name).subscribe((message) => {
      void this.onTopic(name, message)
    })
  }

  protected onTopic(name: string, message: any) {
    return this.eventManager.fire((ec) => ec.options.name === name, message)
  }

  // Actions ////////////////////////////////////////////////////////

  public async authenticate() {
    if (this.isAuthenticated()) {
      throw new Error('Already authenticated')
    }
    try {
      await this.getConnection()
    } catch (e) {
      if (e.message !== NotAuthenticatedError) {
        throw e
      }
      if (!this.started) {
        throw new Error('Unable to authenticate: connector not started')
      }
      openAuthenticationWindow(
        this.account.clientId,
        this.account.clientSecret,
        this.options.baseURL,
      )
      await this.authorizationBarrier.join()
    }
  }

  public isAuthenticated() {
    return this.credentials !== undefined
  }

  public async query(qs: string) {
    const conn = await this.getConnection()
    return conn.query(qs)
  }

  public async map(type: string, operator: (obj: Record<string, any>) => any) {
    const conn = await this.getConnection()
    const so = await conn.sobject(type)
    const list = await so.find({}, 'Id').execute()
    const res = []
    for (const { Id } of list) {
      const objs = await so.retrieve([Id!])
      res.push(await operator(objs[0]))
    }
    return res
  }

  public async sobject(type: string) {
    const conn = await this.getConnection()
    return conn.sobject(type)
  }

  // SDK ////////////////////////////////////////////////////////////

  public async sdk() {
    return this.getConnection()
  }
}
