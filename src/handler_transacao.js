import { Clientes } from './clientes.js'

const TrTypeDebit = 'd'
const TrTypeCredit = 'c'

const FnReturnCodeSuccess = 1
const FnReturnCodeInsufficientBalance = 2
const FnReturnCodeCustomerNotFound = 3

const CmdFnCrebito = 'SELECT * FROM fn_crebito($1, $2, $3, $4)'

export async function handleTransacao(req, reply) {
  const pid = req.params.id
  const limite = Clientes.get(pid)
  if (typeof limite === 'undefined') {
    return reply.code(404).send('identificador de cliente invalido')
  }

  if (!req.body.descricao || req.body.descricao.length > 10) {
    return reply.code(422).send('descricao nao pode ser vazia e deve conter ate 10 caracteres')
  }

  if (req.body.valor <= 0) {
    return reply.code(422).send('valor da transacao precisa ser maior que 0')
  }

  if (req.body.tipo != TrTypeDebit && req.body.tipo != TrTypeCredit) {
    return reply.code(422).send('tipo da transacao precisar ser: c ou d')
  }

  const qry = {
    text: CmdFnCrebito,
    values: [pid, req.body.descricao, req.body.tipo, req.body.valor],
    rowMode: 'array',
  }

  const client = await req.server.pg.connect()
  const results = await client.query(qry)
  const row = results.rows[0]

  client.release()

  switch (row[1]) {
  case FnReturnCodeSuccess:
    return reply.code(200).send({ saldo: row[0], limite })
  case FnReturnCodeInsufficientBalance:
    return reply.code(422).send('saldo insuficiente')
  case FnReturnCodeCustomerNotFound:
    return reply.code(404).send('cliente nao encontrado')
  default:
    return reply.code(500).send('estado invalido ou desconhecido')
  }
}
