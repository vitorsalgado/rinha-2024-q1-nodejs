import http from 'node:http'
import { Buffer } from 'node:buffer'
import pkgPg from 'pg'
const { native } = pkgPg
const { Pool } = native
import fastJson from 'fast-json-stringify'

const DbConnectionString = process.env.DB_CONNECTION_STRING ?? 'postgresql://rinha:rinha@0.0.0.0:5432/rinha?sslmode=disable'
const Addr = process.env.ADDR ?? 8080

const Clientes = new Map()
  .set(1, 100000)
  .set(2, 80000)
  .set(3, 1000000)
  .set(4, 10000000)
  .set(5, 500000)

const pool = new Pool({
  connectionString: DbConnectionString,
  max: 5,
  connectionTimeoutMillis: 5 * 1000
})

const HeaderContentType = 'Content-Type'
const HeaderContentLength = 'Content-Length'

const MimeTypeApplicationJSON = 'application/json; charset=utf-8'

const MaxBodySize = 1048576

const CmdExtratoQry = `
(select s.saldo as v, '' as d, '' as t, now() as d
from saldos s
where s.cliente_id = $1)
		
union all
		
(select t.valor, t.descricao, t.tipo, t.realizado_em
from transacoes t
where t.cliente_id = $1
order by t.id desc
limit 10)
`

const TrTypeDebit = 'd'
const TrTypeCredit = 'c'

const FnReturnCodeSuccess = 1
const FnReturnCodeInsufficientBalance = 2
const FnReturnCodeCustomerNotFound = 3

const CmdFnCrebito = 'SELECT * FROM fn_crebito($1, $2, $3, $4)'

const stringfyTransacoesResponse = fastJson({
  title: 'resumo transacao',
  type: 'object',
  properties: {
    limite: { type: 'integer' },
    saldo: { type: 'integer' },
  },
})

const stringifyExtratoResponse = fastJson({
  title: 'extrato bancario',
  type: 'object',
  properties: {
    saldo: {
      type: 'object',
      properties: {
        total: { type: 'integer' },
        limite: { type: 'integer' },
        data_extrato: { type: 'string' },
      },
    },
    ultimas_transacoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          valor: { type: 'integer' },
          descricao: { type: 'string' },
          tipo: { type: 'string' },
          realizada_em: { type: 'string' },
        },
      },
    },
  },
})

const server = http.createServer(async function (req, res) {
  const parts = req.url.split('/')
  const method = req.method

  if (parts[1] !== 'clientes') {
    res.writeHead(404)
    res.end()
    return
  }

  const pid = parts[2]
  if (!pid) {
    res.writeHead(422)
    res.end('identificador de cliente nao informado')
    return
  }

  const clienteid = Number(pid)
  if (isNaN(clienteid)) {
    res.writeHead(422)
    res.end('identificador de cliente nao informado')
    return
  }

  const limite = Clientes.get(clienteid)
  if (typeof limite === 'undefined') {
    res.writeHead(404)
    res.end('cliente nao encontrado')
    return
  }

  // Extrato Bancario
  // ---
  if (method === 'GET' && parts[3] === 'extrato') {
    const qry = {
      text: CmdExtratoQry,
      values: [clienteid],
      rowMode: 'array',
    }

    const client = await pool.connect()
    const results = await client.query(qry)

    client.release()

    const rows = results.rows
    if (!rows) {
      res.writeHead(404)
      res.end('informacao do cliente nao encontrada')
      return
    }

    const balance = rows[0]
    const lastTransactions = new Array(rows.length - 1)

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      lastTransactions[i - 1] = { valor: row[0], descricao: row[1], tipo: row[2], realizada_em: row[3] }
    }

    const extrato = {
      saldo: { total: balance[0], data_extrato: new Date().toISOString(), limite: limite },
      ultimas_transacoes: lastTransactions,
    }

    const data = stringifyExtratoResponse(extrato)
    const contentLength = Buffer.byteLength(data, 'utf-8')

    res.writeHead(200, { [HeaderContentType]: MimeTypeApplicationJSON, [HeaderContentLength]: contentLength })
    res.end(data)

    return
  }

  // Transacoes
  // --
  if (method === 'POST' && parts[3] === 'transacoes') {
    let body = {}
    try {
      body = await readBody(req)
    } catch {
      res.writeHead(500)
      res.end('transacoes: erro ao processar chamada')
      return
    }

    if (!body.descricao || body.descricao.length > 10) {
      res.writeHead(422)
      res.end('descricao nao pode ser vazia e deve conter ate 10 caracteres')
      return
    }

    if (body.valor <= 0) {
      res.writeHead(422)
      res.end('valor da transacao precisa ser maior que 0')
      return
    }

    if (!Number.isInteger(body.valor)) {
      res.writeHead(422)
      res.end('valor precisa ser um numero inteiro > 0')
      return
    }

    if (body.tipo != TrTypeDebit && body.tipo != TrTypeCredit) {
      res.writeHead(422)
      res.end('tipo da transacao precisar ser: c ou d')
      return
    }

    const qry = {
      text: CmdFnCrebito,
      values: [clienteid, body.descricao, body.tipo, body.valor],
      rowMode: 'array',
    }

    const client = await pool.connect()
    const results = await client.query(qry)
    const row = results.rows[0]

    client.release()

    switch (row[1]) {
    case FnReturnCodeSuccess: {
      const data = stringfyTransacoesResponse({ saldo: row[0], limite })
      const contentLength = Buffer.byteLength(data, 'utf-8')
  
      res.writeHead(200, { [HeaderContentType]: MimeTypeApplicationJSON, [HeaderContentLength]: contentLength })
      res.end(data)

      break
    }

    case FnReturnCodeInsufficientBalance:
      res.writeHead(422)
      res.end('saldo insuficiente')
      break

    case FnReturnCodeCustomerNotFound:
      res.writeHead(404)
      res.end('cliente nao encontrado')
      break

    default:
      res.writeHead(500)
      res.end('estado invalido ou desconhecido')
      break
    }

    return
  }

  res.writeHead(404)
  res.end()
})

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const v = req.headers['content-length']
    const contentLength = v === 'undefined'
      ? NaN
      : Number(v)

    if (contentLength > MaxBodySize || contentLength === 0) {
      return reject('content-length invalido')
    }

    const buf = Buffer.allocUnsafe(contentLength, null, 'utf-8')
    let offset = 0

    const onData = function (chunk) {
      const size = Buffer.byteLength(chunk, 'utf-8')
      chunk.copy(buf, offset, 0, size)

      offset += size
    }

    req.on('data', onData)
    req.on('error', function (err) { reject(err) })
    req.on('end', function () { return resolve(JSON.parse(buf.toString())) })
  })
}

server.keepAliveTimeout = 5 * 60 * 1000
server.maxRequestsPerSocket = 0
server.maxConnections = 50000

server.listen(Addr, function () { console.log('connected') })
