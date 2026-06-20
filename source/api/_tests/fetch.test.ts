import * as http from "http"

import { ProxyAgent } from "undici"
import { api } from "../fetch"

interface ResponseMock {
  body?: any
  statusCode?: number
  contentType?: string
}

class TestServer {
  private port = 30001
  private hostname = "localhost"
  private response: ResponseMock = null as any
  private router = (_req: any, res: any) => {
    res.statusCode = this.response && this.response.statusCode ? this.response.statusCode : 200
    res.setHeader(
      "Content-Type",
      this.response && this.response.contentType ? this.response.contentType : "application/json"
    )
    res.end(this.response ? this.response.body : null)
  }
  private server = http.createServer(this.router)

  start = async (response: ResponseMock): Promise<void> => {
    this.response = response
    return new Promise<void>((resolve, reject) => {
      this.server.on("error", (e) => {
        reject(e)
      })
      this.server.listen(this.port, this.hostname, undefined, () => resolve())
    })
  }
  stop = async (): Promise<void> => {
    this.response = null as any
    return new Promise<void>((resolve, reject) => {
      this.server.close((err: any) => (err ? reject(err) : resolve()))
    })
  }
}

describe("fetch", () => {
  let url: string
  let server = new TestServer()

  beforeEach(() => {
    url = "http://localhost:30001/"
  })

  afterEach(async () => {
    await server.stop()
  })

  it("handles json success", async () => {
    let body = { key: "valid json" }
    await server.start({
      body: JSON.stringify(body),
    })

    let response = await api(url, {})
    expect(response.ok).toBe(true)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject(body)
  })

  it("handles json error", async () => {
    let body = { key: "valid json" }
    await server.start({
      body: JSON.stringify(body),
      statusCode: 500,
    })

    let response = await api(url, {})
    expect(response.ok).toBe(false)
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject(body)
  })

  it("handles plain text error", async () => {
    let body = "any plain text response"
    await server.start({
      body: body,
      statusCode: 500,
      contentType: "text/plain",
    })

    let response = await api(url, {})
    expect(response.ok).toBe(false)
    expect(response.status).toBe(500)
    expect(await response.text()).toBe(body)
  })

  it("sets proxy dispatcher when HTTPS_PROXY env variable is defined", async () => {
    const proxyUrl = "http://localhost:30002/"
    const abortController = new AbortController()
    abortController.abort()

    await server.start({})

    let options = { method: "GET", dispatcher: undefined, signal: abortController.signal }
    await api(url, options, true, { HTTPS_PROXY: proxyUrl }).catch(() => undefined)
    expect(options.dispatcher).toBeInstanceOf(ProxyAgent)
  })

  it("sets proxy dispatcher when https_proxy env variable is defined", async () => {
    const proxyUrl = "http://localhost:30002/"
    const abortController = new AbortController()
    abortController.abort()

    await server.start({})

    let options = { method: "GET", dispatcher: undefined, signal: abortController.signal }
    await api(url, options, true, { https_proxy: proxyUrl }).catch(() => undefined)
    expect(options.dispatcher).toBeInstanceOf(ProxyAgent)
  })

  it("sets proxy dispatcher when HTTP_PROXY env variable is defined", async () => {
    const proxyUrl = "http://localhost:30002/"
    const abortController = new AbortController()
    abortController.abort()

    await server.start({})

    let options = { method: "GET", dispatcher: undefined, signal: abortController.signal }
    await api(url, options, true, { HTTP_PROXY: proxyUrl }).catch(() => undefined)
    expect(options.dispatcher).toBeInstanceOf(ProxyAgent)
  })

  it("sets proxy dispatcher when http_proxy env variable is defined", async () => {
    const proxyUrl = "http://localhost:30002/"
    const abortController = new AbortController()
    abortController.abort()

    await server.start({})

    let options = { method: "GET", dispatcher: undefined, signal: abortController.signal }
    await api(url, options, true, { http_proxy: proxyUrl }).catch(() => undefined)
    expect(options.dispatcher).toBeInstanceOf(ProxyAgent)
  })
})
