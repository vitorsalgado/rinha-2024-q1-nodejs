# Rinha de Backend 2024 Q1 · Node.js · [![ci](https://github.com/vitorsalgado/rinha-2024-q1-nodejs/actions/workflows/ci.yml/badge.svg)](https://github.com/vitorsalgado/rinha-2024-q1-nodejs/actions/workflows/ci.yml) · ![GitHub License](https://img.shields.io/github/license/vitorsalgado/rinha-2024-q1)

Proposta de implementação da **[Rinha de Backend 2024 Q1](https://github.com/zanfranceschi/rinha-de-backend-2024-q1)**.  
Os resultados dos testes são publicados automaticamente neste **[site](https://vitorsalgado.github.io/rinha-2024-q1-nodejs/)**.  
Submissão: [aqui](https://github.com/zanfranceschi/rinha-de-backend-2024-q1/tree/main/participantes/vitorsalgado-nodejs)

## Tech

- Node.js (Javascript)
- Postgres
- Envoy
- PgBouncer

## Sobre

A idéia era criar um projeto bem simples, com o mínimo possível de libs e frameworks e que também fosse fácil de replicar em outras linguagens.  
Em relação a **performance**, aqui algumas idéias que guiaram o projeto:

- menos **round trips** possíveis ao banco de dados. para isso, usei uma **function** no Postgres para as transações e uma query única para o obter o extrato bancário. 

- gestão eficiente de conexões com o banco. esse ponto é um complemente do anterior, conexões com o banco de dados são "caras" e aqui demorei para achar o setup ideal. desde o início a solução contava com um **pool** de conexões e no começo esse pool girou em torno de ~100 - ~300 de máx. conexões. depois de vários experimentos, encontrei uma ferramente interessante para o pool de conexões, **PgBouncer**. com o PgBouncer integrado, o setup ideal acabou sendo: __pool=5__ nas apis e __pool=20__ no PgBouncer, um número muito menor do que os experimentos inicias sem esse componente. 

- experimentei usar o **nginx** como load balancer inicialmente, mas após alguns experimentos com **envoy**, acabei optando pelo último. 

- **threads**: dadas as limitações do ambiente em relação a CPU e memória, experimentei diferentes setups de threads para as aplicações. 
após vários testes, o "sweet spot" para as apis foi definir **UV_THREADPOOL_SIZE=1** para fazer o **libuv** usar uma thread apenas. 

- usar _pg_ e _pg-native_ para conexão com o Postgres. parecia ser a opção mais rápida, mas não cheguei a testar outras formas. 

- _fast-json-stringify_ para serialização rápida de JSON. 

- busquei pré-alocar memória sempre que possível no caso de arrays e buffers. para a leitura do request _body_, usei um _Buffer_ pré-alocado com o _content-length_ da requisição, ao invés de concatenar strings ou arrays com Buffer.concat. essa forma me pareceu mais eficiente e se saiu melhor em alguns benchmarks locais. implementação [aqui](./src/index.js#L258). 

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
