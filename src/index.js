import http from 'node:http'
import { Buffer } from 'node:buffer'
import pkgPg from 'pg'
const { native } = pkgPg
const { Pool } = native
import fastJson from 'fast-json-stringify'
import { Clientes } from './clientes.js'

const DbConnectionString = process.env.DB_CONNECTION_STRING ?? 'postgresql://rinha:rinha@0.0.0.0:5432/rinha?sslmode=disable'
const Addr = process.env.ADDR ?? 8080

const pool = new Pool({
  connectionString: DbConnectionString,
  max: 5,
  connectionTimeoutMillis: 5 * 1000
})

const HeaderContentType = 'Content-Type'
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
    res.writeHead(422)
    res.end()
    return
  }

  const pid = parts[2]
  if (!pid) {
    res.writeHead(422)
    res.write('identificador de cliente nao informado')
    res.end()
    return
  }

  const clienteid = Number(pid)
  if (isNaN(clienteid)) {
    res.writeHead(422)
    res.write('identificador de cliente nao informado')
    res.end()
    return
  }

  const limite = Clientes.get(clienteid)
  if (typeof limite === 'undefined') {
    res.writeHead(404)
    res.write('cliente nao encontrado')
    res.end()
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
      res.write('informacao do cliente nao encontrada')
      res.end()
      return
    }

    const balance = rows[0]
    const lastTransactions = new Array(rows.length-1)

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      lastTransactions[i-1] = { valor: row[0], descricao: row[1], tipo: row[2], realizada_em: row[3] }
    }

    const extrato = {
      saldo: { total: balance[0], data_extrato: new Date().toISOString(), limite: limite },
      ultimas_transacoes: lastTransactions,
    }

    res.setHeader(HeaderContentType, MimeTypeApplicationJSON)
    res.writeHead(200)
    res.write(stringifyExtratoResponse(extrato))
    res.end()
    return
  }

  // Transacoes
  // --
  if (method === 'POST' && parts[3] === 'transacoes') {
    let body = {}
    try {
      body = await readBody(req)
    } catch (err) {
      console.log(err)
      res.writeHead(500)
      res.end()
      return
    }

    if (!body.descricao || body.descricao.length > 10) {
      res.writeHead(422)
      res.write('descricao nao pode ser vazia e deve conter ate 10 caracteres')
      res.end()
      return
    }
  
    if (body.valor <= 0) {
      res.writeHead(422)
      res.write('valor da transacao precisa ser maior que 0')
      res.end()
      return
    }

    if (!Number.isInteger(body.valor)) {
      res.writeHead(422)
      res.write('valor precisa ser um numero inteiro > 0')
      res.end()
      return
    }
  
    if (body.tipo != TrTypeDebit && body.tipo != TrTypeCredit) {
      res.writeHead(422)
      res.write('tipo da transacao precisar ser: c ou d')
      res.end()
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
    case FnReturnCodeSuccess:
      res.setHeader(HeaderContentType, MimeTypeApplicationJSON)
      res.writeHead(200)
      res.write(stringfyTransacoesResponse({ saldo: row[0], limite }))
      break
    case FnReturnCodeInsufficientBalance:
      res.writeHead(422)
      res.write('saldo insuficiente')
      break
    case FnReturnCodeCustomerNotFound:
      res.writeHead(404)
      res.write('cliente nao encontrado')
      break
    default:
      res.writeHead(500)
      res.write('estado invalido ou desconhecido')
      break
    }

    res.end()
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

    const onData = function(chunk) {
      const size = Buffer.byteLength(chunk, 'utf-8')

      buf.fill(chunk, offset, size)

      offset += size
    }

    req.on('data', onData)
    req.on('error', function(err) { reject(err) })
    req.on('end', function () { return resolve(JSON.parse(buf.toString())) })
  })
}

server.keepAliveTimeout = 5 * 60 * 1000
server.maxRequestsPerSocket = 0
server.maxConnections = 50000

server.listen(Addr, function() { console.log('connected') })
