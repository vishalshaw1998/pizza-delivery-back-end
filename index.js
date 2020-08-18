const express = require("express");
const mongodb = require("mongodb");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const dotEnv = require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();
app.use(bodyParser.json());
app.use(cors());

const url = process.env.DB;
const SECRET_KEY = process.env.SECRET;
app.post("/register", async (req, res) => {
    try {
        let client = await mongodb.connect(url);
        let db = client.db("pizza");
        let data = await db
            .collection("users")
            .find({ username: req.body.username })
            .toArray();
        if (data.length !== 0) {
            await client.close();
            res.json({
                status: "Already Present",
            });
            return;
        }
        let salt = await bcrypt.genSalt(10);
        let hash = await bcrypt.hash(req.body.password, salt);
        req.body.password = hash;
        data = await db.collection("users").insertOne({
            username: req.body.username,
            password: req.body.password,
            role: "user",
            orders: [],
        });
        res.json({
            status: "Success",
        });
        await client.close();
    } catch (err) {}
});

app.post("/login", async (req, res) => {
    let client = await mongodb.connect(url);
    let db = client.db("pizza");
    let data = await db
        .collection("users")
        .find({ username: req.body.username })
        .toArray();
    if (data.length === 0) {
        await client.close();
        res.json({
            status: "Not Found",
        });
        return;
    }
    let jwtToken = await jwt.sign(
        { id: data[0]._id, name: data[0].username, role: data[0].role },
        SECRET_KEY,
        { expiresIn: "1d" }
    );
    res.json({
        status: "Success",
        token: jwtToken,
        role: data[0].role,
    });
    await client.close();
    return;
});

async function authenticate(req, res, next) {
    if (req.headers.authorization !== undefined) {
        try {
            let verifyToken = await jwt.verify(
                req.headers.authorization,
                SECRET_KEY
            );
            req.body.verifyToken = verifyToken;
            next();
        } catch (err) {
            res.json({
                status: "Invalid Token",
            });
        }
    }
}

app.post("/placeOrder", [authenticate], async (req, res) => {
    let readyPizza = req.body.pizzas;
    let customPizza = [];
    customPizza.push(req.body.customPizza);
    let pizzas = { readyPizza, customPizza, status: "Reviewing Order" };
    let client = await mongodb.connect(url);
    let db = client.db("pizza");
    let data = await db
        .collection("active")
        .insertOne({ username: req.body.verifyToken.name, pizza: pizzas });
    let id = data.insertedId;
    pizzas = { ...pizzas, activeid: id };
    let updatedData = await db
        .collection("users")
        .updateOne(
            { username: req.body.verifyToken.name },
            { $push: { orders: { ...pizzas } } }
        );
    if (updatedData.modifiedCount == 1) {
        res.json({
            status: "Added",
        });
    } else {
        res.json({
            status: "Something Went Wrong",
        });
    }
});

app.get("/pizzaInfo", [authenticate], async (req, res) => {
    let username = req.body.verifyToken.name;
    let client = await mongodb.connect(url);
    let db = client.db("pizza");
    let data = await db
        .collection("active")
        .find({ username: username })
        .toArray();
    let orderTrack = data.filter((item) => {
        return item.status !== "finished";
    });
    res.json({
        status: "Success",
        data: orderTrack,
    });
});

app.get("/userInfo", [authenticate], async (req, res) => {
    res.json({
        status: "Success",
    });
});

app.post("/loginAdmin", async (req, res) => {
    let client = await mongodb.connect(url);
    let db = client.db("pizza");
    let data = await db
        .collection("users")
        .find({ username: req.body.username })
        .toArray();
    if (data.length === 0) {
        await client.close();
        res.json({
            status: "Not Found",
        });
        return;
    }
    let jwtToken = await jwt.sign(
        { id: data[0]._id, name: data[0].username, role: data[0].role },
        SECRET_KEY,
        { expiresIn: "1d" }
    );
    res.json({
        status: "Success",
        token: jwtToken,
        role: data[0].role,
    });
    await client.close();
    return;
});

app.get("/", (req, res) => {
    res.send("App Is Running");
});

app.listen(process.env.PORT || 3001, function () {
    console.log("Listening");
});
