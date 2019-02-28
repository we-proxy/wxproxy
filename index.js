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

let cache = new Map()

let server = http.createServer((req, res) => {
  let _url = req.url.slice(1)
  let url = decodeURIComponent(_url)
  console.log('url', url)

  // if (!/\.md$/i.test(url)) {
  //   res.statusCode = 403
  //   res.end()
  //   return
  // }

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

  let urlObj = $url.parse(url)
  let host = `${urlObj.protocol}//${urlObj.host}/`
  req.url = urlObj.path

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

    if (res.statusCode === 200) { // 还不是很确定应该怎么做
      let headers = res.getHeaders()
      cache.set(url, { date, headers, buffer })
    }
  }

  proxy.web(req, res, { target: host })
})

server.listen(8999)
