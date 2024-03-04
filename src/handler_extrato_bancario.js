import { Clientes } from './clientes.js'

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

export async function handleExtratoBancario(req, reply) {
  const pid = req.params.id
  const limite = Clientes.get(pid)
  if (typeof limite === 'undefined') {
    return reply.code(404).send('cliente nao encontrado')
  }

  const qry = {
    text: CmdExtratoQry,
    values: [pid],
    rowMode: 'array',
  }

  const client = await req.server.pg.connect()
  const results = await client.query(qry)

  client.release()

  const rows = results.rows
  if (!rows) {
    return reply.code(404).send('informacao do cliente nao encontrada')
  }

  const balance = rows.shift()
  const lastTransactions = new Array(rows.length)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    lastTransactions[i] = { valor: row[0], descricao: row[1], tipo: row[2], realizada_em: row[3] }
  }

  const extrato = {
    saldo: { total: balance[0], data_extrato: new Date().toISOString(), limite: limite },
    ultimas_transacoes: lastTransactions,
  }

  return reply.code(200).send(extrato)
}
