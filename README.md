# Rinha de Backend 2024 Q1 · Node.js · [![ci](https://github.com/vitorsalgado/rinha-2024-q1-nodejs/actions/workflows/ci.yml/badge.svg)](https://github.com/vitorsalgado/rinha-2024-q1-nodejs/actions/workflows/ci.yml) · ![GitHub License](https://img.shields.io/github/license/vitorsalgado/rinha-2024-q1-nodejs)

Proposta de implementação da **[Rinha de Backend 2024 Q1](https://github.com/zanfranceschi/rinha-de-backend-2024-q1)**.  
Os resultados dos testes são publicados automaticamente neste **[site](https://vitorsalgado.github.io/rinha-2024-q1-nodejs/)**.

## Tech

- Node.js (Javascript)
- Postgres
- Envoy
- PgBouncer

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
