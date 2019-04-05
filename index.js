let querystring = require('querystring')
let httpProxy = require('http-proxy')
let http = require('http')
let $url = require('url')
let MockRes = require('mock-res')

process.on('uncaughtException', err => {
  console.error('err', err)
})

let proxy = httpProxy.createProxyServer({
  changeOrigin: true
})

let getReqQuery = req => {
  let qstr = req.url.slice(2) // /?url=xxx&refer=xxx
  let query = querystring.parse(qstr)
  return query
}

// 修改proxyReq
// https://github.com/nodejitsu/node-http-proxy#setup-a-stand-alone-proxy-server-with-proxy-request-header-re-writing
// let userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36'
proxy.on('proxyReq', (proxyReq, req, res, options) => {
  let referer = req.headers['x-tmp-referer']

  // csdn查referer空可以; segmentfault要求站点路径
  proxyReq.setHeader('Referer', referer || '')

  // proxyReq.setHeader('User-Agent', userAgent)
})

let cache = new Map()

let server = http.createServer((req, res) => {
  // 历史遗留 旧小程序为参数a
  let { a, url, referer } = getReqQuery(req)
  url = url || a

  let urlObj = $url.parse(url)
  let host = `${urlObj.protocol}//${urlObj.host}/`
  req.url = urlObj.path

  if (referer === 'url') {
    referer = url
  } else if (referer === 'host') {
    referer = host
  }

  console.log({ url, referer })
  req.headers['x-tmp-referer'] = referer || ''

  // if (!/\.md$/i.test(url)) {
  //   res.statusCode = 403
  //   res.end()
  //   return
  // }

  if (process.env.READ_CACHE) {
    let cac = cache.get(url)
    if (cac) {
      console.log('cache hit')
      let { date, headers, buffer } = cac

      Object.keys(headers).forEach(k => {
        res.setHeader(k, headers[k])
      })
      res.write(buffer)
      res.end()

      let threshold = 1 * 60 * 1000
      if (new Date() - date < threshold) return

      res = new MockRes() // mocked & replaced
    }
  }

  let date = new Date()
  let buffer = Buffer.from([])

  let _write = res.write.bind(res)
  res.write = data => {
    // console.log('write data', data)
    if (data) buffer = Buffer.concat([buffer, data])
    _write(data)
  }

  let _end = res.end.bind(res)
  res.end = data => {
    // console.log('end data', data)
    if (data) buffer = Buffer.concat([buffer, data])
    // console.log('buffer', buffer)
    _end(data)

    let headers = res.getHeaders()
    let isText = (headers['content-type'] || '').includes('text/')

    if (isText && res.statusCode === 200) { // 还不是很确定应该怎么做
      cache.set(url, { date, headers, buffer })
    }
  }

  proxy.web(req, res, { target: host })
})

server.listen(8999)
