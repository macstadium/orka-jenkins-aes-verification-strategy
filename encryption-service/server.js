"use strict";

const express = require("express");
const CryptoJS = require("crypto-js");

const PORT = 8080;
const HOST = "0.0.0.0";

const app = express();
app.get("/:msg", async (req, res) => {
  const ciphertext = CryptoJS.AES.encrypt(
    req.params.msg,
    process.env.KEY
  ).toString();
  res.send(ciphertext);
});

app.listen(PORT, HOST);