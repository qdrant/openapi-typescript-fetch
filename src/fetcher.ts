import {
  ApiError,
  ApiResponse,
  CreateFetch,
  CustomRequestInit,
  Fetch,
  FetchConfig,
  Method,
  Middleware,
  OpArgType,
  OpenapiPaths,
  OpErrorType,
  Request,
  _TypedFetch,
  TypedFetch,
} from './types.js'

declare global {
  interface JSON {
    rawJSON?(jsonStr: string): {
      rawJSON: string
    }
  }
}

type JSONReviverReplacer = (
  key: string,
  val: any,
  context?: {
    /** Only provided if a value is primitive */
    source?: any
  },
) => any

let bigintReviver: JSONReviverReplacer | undefined
let bigintReplacer: JSONReviverReplacer | undefined

if ('rawJSON' in JSON) {
  bigintReviver = function (_key, val, context) {
    if (Number.isInteger(val) && !Number.isSafeInteger(val)) {
      try {
        return BigInt(context!.source) // eslint-disable-line @typescript-eslint/no-non-null-assertion
      } catch (e) {
        return val
      }
    }
    return val
  }
  bigintReplacer = function (_key, val) {
    if (typeof val === 'bigint') {
      return JSON.rawJSON!(String(val)) // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }
    return val
  }
}

const sendBody = (method: Method) =>
  method === 'post' ||
  method === 'put' ||
  method === 'patch' ||
  method === 'delete'

function queryString(params: Record<string, unknown>): string {
  const qs: string[] = []

  const encode = (key: string, value: unknown) =>
    `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`

  Object.keys(params).forEach((key) => {
    const value = params[key]
    if (value != null) {
      if (Array.isArray(value)) {
        value.forEach((value) => qs.push(encode(key, value)))
      } else {
        qs.push(encode(key, value))
      }
    }
  })

  if (qs.length > 0) {
    return `?${qs.join('&')}`
  }

  return ''
}

function getPath(path: string, payload: Record<string, any>) {
  return path.replace(/\{([^}]+)\}/g, (_, key) => {
    const value = encodeURIComponent(payload[key])
    delete payload[key]
    return value
  })
}

function getQuery(
  method: Method,
  payload: Record<string, any>,
  query: string[],
) {
  let queryObj = {} as any

  if (sendBody(method)) {
    query.forEach((key) => {
      queryObj[key] = payload[key]
      delete payload[key]
    })
  } else {
    queryObj = { ...payload }
  }

  return queryString(queryObj)
}

function getHeaders(body?: CustomRequestInit['body'], init?: HeadersInit) {
  const headers = new Headers(init)

  if (
    body !== undefined &&
    !(body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.append('Content-Type', 'application/json')
  }

  if (!headers.has('Accept')) {
    headers.append('Accept', 'application/json')
  }

  return headers
}

function getBody(method: Method, payload: unknown): CustomRequestInit['body'] {
  if (!sendBody(method)) {
    return
  }
  const body =
    payload instanceof FormData
      ? payload
      : JSON.stringify(payload, bigintReplacer)
  // if delete don't send body if empty
  return method === 'delete' && body === '{}' ? undefined : body
}

function mergeRequestInit(
  first?: RequestInit,
  second?: RequestInit,
): RequestInit {
  const headers = new Headers(first?.headers)
  const other = new Headers(second?.headers)

  for (const key of other.keys()) {
    const value = other.get(key)
    if (value != null) {
      headers.set(key, value)
    }
  }
  return { ...first, ...second, headers }
}

function getFetchParams(request: Request): {
  url: string
  init: CustomRequestInit
} {
  // clone payload
  // if body is a top level array [ 'a', 'b', param: value ] with param values
  // using spread [ ...payload ] returns [ 'a', 'b' ] and skips custom keys
  // cloning with Object.assign() preserves all keys
  const payload = Object.assign(
    Array.isArray(request.payload) ? [] : {},
    request.payload,
  )

  const path = getPath(request.path, payload)
  const query = getQuery(request.method, payload, request.queryParams)
  const body = getBody(request.method, payload)
  const headers = sendBody(request.method)
    ? getHeaders(body, request.init?.headers)
    : new Headers(request.init?.headers)
  const url = request.baseUrl + path + query

  const init = {
    ...request.init,
    method: request.method.toUpperCase(),
    headers,
    body,
  }

  return { url, init }
}

async function getResponseData(response: Response) {
  if (response.status === 204 /* no content */) {
    return
  }

  const contentType = response.headers.get('content-type')
  const responseText = await response.text()
  if (contentType && contentType.includes('application/json')) {
    return JSON.parse(responseText, bigintReviver)
  }

  try {
    return JSON.parse(responseText, bigintReviver)
  } catch (e) {
    return responseText
  }
}

async function fetchJson(url: string, init: RequestInit): Promise<ApiResponse> {
  const response = await fetch(url, init)

  const data = await getResponseData(response)

  const result = {
    headers: response.headers,
    url: response.url,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    data,
  }

  if (result.ok) {
    return result
  }

  throw new ApiError(result)
}

function wrapMiddlewares(middlewares: Middleware[], fetch: Fetch): Fetch {
  type Handler = (
    index: number,
    url: string,
    init: CustomRequestInit,
  ) => Promise<ApiResponse>

  const handler: Handler = async (index, url, init) => {
    if (middlewares == null || index === middlewares.length) {
      return fetch(url, init)
    }
    const current = middlewares[index]
    return await current(url, init, (nextUrl, nextInit) =>
      handler(index + 1, nextUrl, nextInit),
    )
  }

  return (url, init) => handler(0, url, init)
}

async function fetchUrl<R>(request: Request) {
  const { url, init } = getFetchParams(request)

  const response = await request.fetch(url, init)

  return response as ApiResponse<R>
}

function createFetch<OP>(fetch: _TypedFetch<OP>): TypedFetch<OP> {
  const fun = async (payload: OpArgType<OP>, init?: RequestInit) => {
    try {
      return await fetch(payload, init)
    } catch (err) {
      if (err instanceof ApiError) {
        throw new fun.Error(err)
      }
      throw err
    }
  }

  fun.Error = class extends ApiError {
    constructor(error: ApiError) {
      super(error)
      Object.setPrototypeOf(this, new.target.prototype)
    }
    getActualType() {
      return {
        status: this.status,
        data: this.data,
      } as OpErrorType<OP>
    }
  }

  return fun
}

function fetcher<Paths>() {
  let baseUrl = ''
  let defaultInit: RequestInit = {}
  const middlewares: Middleware[] = []
  const fetch = wrapMiddlewares(middlewares, fetchJson)

  return {
    configure: (config: FetchConfig) => {
      baseUrl = config.baseUrl || ''
      defaultInit = config.init || {}
      middlewares.splice(0)
      middlewares.push(...(config.use || []))
    },
    use: (mw: Middleware) => middlewares.push(mw),
    path: <P extends keyof Paths>(path: P) => ({
      method: <M extends keyof Paths[P]>(method: M) => ({
        create: ((queryParams?: Record<string, true | 1>) =>
          createFetch((payload, init) =>
            fetchUrl({
              baseUrl: baseUrl || '',
              path: path as string,
              method: method as Method,
              queryParams: Object.keys(queryParams || {}),
              payload,
              init: mergeRequestInit(defaultInit, init),
              fetch,
            }),
          )) as CreateFetch<M, Paths[P][M]>,
      }),
    }),
  }
}

export const Fetcher = {
  for: <Paths extends OpenapiPaths<Paths>>() => fetcher<Paths>(),
}
