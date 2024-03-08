# Rinha de Backend 2024 Q1 · Node.js · [![ci](https://github.com/vitorsalgado/rinha-2024-q1-nodejs/actions/workflows/ci.yml/badge.svg)](https://github.com/vitorsalgado/rinha-2024-q1-nodejs/actions/workflows/ci.yml) · ![GitHub License](https://img.shields.io/github/license/vitorsalgado/rinha-2024-q1)

Proposta de implementação da **[Rinha de Backend 2024 Q1](https://github.com/zanfranceschi/rinha-de-backend-2024-q1)**.  
Os resultados dos testes são publicados automaticamente neste **[site](https://vitorsalgado.github.io/rinha-2024-q1-nodejs/)**.

## Tech

- Node.js (Javascript)
- Postgres
- Envoy
- PgBouncer

## Sobre

Alguns pontos sobre o projeto:  

- HTTP server bem simples usando a std lib.
- _pg_ e _pg-native_ para conexão com o Postgres. parecia ser a opção mais rápida, mas não cheguei a testar outras formas.
- _fast-json-stringify_ para serialização rápida de JSON.
- configurar o _libuv_ para usar **1** thread.
- para a leitura do request _body_, usei um _Buffer_ pré-alocado com o _content-length_ da requisição, ao invés de concatenar strings ou arrays com Buffer.concat. essa forma me pareceu mais eficiente e se saiu melhor em alguns benchmarks locais. veja [aqui](./src/index.js#L258).
- uso do componente PgBouncer para uma gestão mais eficiente de conexões com o banco.
- _Envoy_ como load balancer.
- as operações de débito, crédito e extrato são feitas com apenas uma chamada ao banco, reduzindo o número de idas e vindas ao mesmo. No caso das operações de débito e crédito, foi utilizada uma function no Postgres que concentra a regra de negócio.

## Executando

Para executar o projeto completo em um **docker compose** local, execute no seu terminal:
```
make up
```

## Testes de Carga

Para executar os testes de carga contidos no repositório original da rinha, 
primeiro execute o comando de preparação:
```
make prepare
```

O comando `make prepare` clona o repositório da rinha e instala a ferramente Gatling.  
**Ele deve ser executado apenas uma vez.**  
Para rodar os testes, execute o comando:
```
make test
```
