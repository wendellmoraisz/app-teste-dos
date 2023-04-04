const express = require("express");
const app = express();

let numberOfRequests = 0;
let requestsTimeInterval;

app.get("/", (req, res) => {
    console.log(`${++numberOfRequests} Requisições recebidas em ${calculateRequestsInterval()} segundos`);
    res.status(200);
});

const calculateRequestsInterval = () => {
    return (Date.now() - requestsTimeInterval) / 1000;
}

app.listen(8080, () => {
    requestsTimeInterval = Date.now();
    console.log("Servidor rodando na porta 8080");
});