import Fastify from 'fastify'
import fastifyPostgres from '@fastify/postgres'
import { handleTransacao } from './handler_transacao.js'
import { handleExtratoBancario } from './handler_extrato_bancario.js'

const DbConnectionString = process.env.DB_CONNECTION_STRING
const Addr = process.env.ADDR ?? 8080

const fastify = Fastify({
  keepAliveTimeout: 5 * 60 * 1000,
  maxRequestsPerSocket: 0,
  logger: false,
  disableRequestLogging: true,
  requestIdHeader: false,
  exposeHeadRoutes: false,
})

fastify.register(fastifyPostgres, {
  native: true,
  connectionString: DbConnectionString,
  max: 5,
  connectionTimeoutMillis: 5 * 1000,
})

fastify.get('/ping', async function handler() {
  return 'pong'
})

fastify.post('/clientes/:id/transacoes', {
  handler: handleTransacao,
  onRequest: async function (req, reply) {
    if (!req.params.id) {
      return reply.code(422).send('identificador de cliente nao informado')
    }
  },
  schema: {
    body: {
      type: 'object',
      properties: {
        descricao: { type: 'string' },
        tipo: { type: 'string' },
        valor: { type: 'integer' },
      },
    },
    params: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          limite: { type: 'integer' },
          saldo: { type: 'integer' },
        },
      },
    },
  },
})

fastify.get('/clientes/:id/extrato', {
  handler: handleExtratoBancario,
  onRequest: async function (req, reply) {
    if (!req.params.id) {
      return reply.code(422).send('identificador de cliente nao informado')
    }
  },
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
      },
    },
    response: {
      200: {
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
      },
    },
  },
})

fastify
  .listen({ port: Addr, host: '0.0.0.0' })
  .then(() => console.log('connected'))
  .catch(err => {
    console.log(err)
    process.exit(1)
  })
