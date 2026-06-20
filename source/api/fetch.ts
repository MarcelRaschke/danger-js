import { fetch as undiciFetch, Headers, ProxyAgent } from "undici"
import type { Request, RequestInit, Response } from "undici"
import AsyncRetry from "async-retry"

import { debug } from "../debug"

export type FetchResponse = Omit<Response, "json"> & {
  json(): Promise<any>
}

const d = debug("networking")
declare const global: any

const isJest = typeof jest !== "undefined"
const warn = isJest ? () => "" : console.warn

const shouldRetryRequest = (res: FetchResponse) => {
  // Don't retry 4xx errors other than 401. All 4xx errors can probably be ignored once
  // the Github API issue causing https://github.com/danger/peril/issues/440 is fixed
  return res.status === 401 || (res.status >= 500 && res.status <= 599)
}

/**
 * Adds retry handling to fetch requests
 *
 * @param {(string | fetch.Request)} url the request
 * @param {fetch.RequestInit} [init] the usual options
 * @returns {Promise<fetch.Response>} network-y promise
 */
export async function retryableFetch(url: string | Request, init: RequestInit): Promise<FetchResponse> {
  const retries = isJest ? 1 : 3
  return AsyncRetry(
    async (_, attempt) => {
      const res = await undiciFetch(url, init)

      // Throwing an error will trigger a retry
      if (attempt <= retries && shouldRetryRequest(res)) {
        throw new Error(`Request failed [${res.status}]: ${res.url}. Attempting retry.`)
      }

      return res
    },
    {
      retries: retries,
      onRetry: (error, attempt) => {
        warn((error as any)?.message)
        warn(`Retry ${attempt} of ${retries}.`)
      },
    }
  )
}

/**
 * Adds logging to every fetch request if a global var for `verbose` is set to true
 *
 * @param {(string | fetch.Request)} url the request
 * @param {fetch.RequestInit} [init] the usual options
 * @returns {Promise<fetch.Response>} network-y promise
 */
export function api(
  url: string | Request,
  init: RequestInit,
  suppressErrorReporting?: boolean,
  processEnv: NodeJS.ProcessEnv = process.env
): Promise<FetchResponse> {
  const isTests = typeof jest !== "undefined"
  const requestUrl = typeof url === "string" ? url : url.url
  if (isTests && !requestUrl.includes("localhost")) {
    const message = `No API calls in tests please: ${requestUrl}`
    debugger
    throw new Error(message)
  }

  if (global.verbose && global.verbose === true) {
    const output = ["curl", "-i"]

    if (init.method) {
      output.push(`-X ${init.method}`)
    }

    const showToken = processEnv["DANGER_VERBOSE_SHOW_TOKEN"]
    const token = processEnv["DANGER_GITHUB_API_TOKEN"] || processEnv["GITHUB_TOKEN"]

    new Headers(init.headers).forEach((value, prop) => {
      // Don't show the token for normal verbose usage
      if (token && value.includes(token) && !showToken) {
        output.push("-H", `"${prop}: [API TOKEN]"`)
        return
      }
      output.push("-H", `"${prop}: ${value}"`)
    })

    if (init.method === "POST") {
      // const body:string = init.body
      // output.concat([init.body])
    }

    if (typeof url === "string") {
      output.push(url)
    }

    d(output.join(" "))
  }

  let dispatcher = init.dispatcher
  const proxy =
    processEnv["HTTPS_PROXY"] || processEnv["https_proxy"] || processEnv["HTTP_PROXY"] || processEnv["http_proxy"]

  if (!dispatcher && proxy) {
    init.dispatcher = new ProxyAgent(proxy)
  }

  return retryableFetch(url, init).then(async (response: FetchResponse) => {
    // Handle failing errors
    if (!suppressErrorReporting && !response.ok) {
      // we should not modify the response when an error occur to allow body stream to be read again if needed
      let clonedResponse = response.clone()
      warn(`Request failed [${clonedResponse.status}]: ${clonedResponse.url}`)
      let responseBody = await clonedResponse.text()
      try {
        // tries to pretty print the JSON response when possible
        const responseJSON = await JSON.parse(responseBody.toString())
        warn(`Response: ${JSON.stringify(responseJSON, null, "  ")}`)
      } catch (e) {
        warn(`Response: ${responseBody}`)
      }
    }

    return response
  })
}
