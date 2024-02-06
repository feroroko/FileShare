let express = require("express");
let app = express();
let httpObj = require("http");
let http = httpObj.createServer(app);

let mainURL = "http://localhost:3000";
 
let mongodb = require("mongodb");
let mongoClient = mongodb.MongoClient;
let ObjectId = mongodb.ObjectId;
const path = require('path');

app.set("view engine", "ejs");  // Set the view engine to EJS

app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/font-awesome-4.7.0", express.static(__dirname + "/public/font-awesome-4.7.0"));

let session = require("express-session");
app.use(session({
    secret: "secret key",
    resave: false,
    saveUninitialized: false
}));

app.use(function (request, result, next) {
    request.mainURL = mainURL;
    request.isLoggedIn = (typeof request.session.user !== "undefined");
    request.user = request.session.user;

    next();
});

http.listen(3000, function () {
    console.log("Server started at " + mainURL);
    mongoClient.connect("mongodb+srv://feroroko:k5lhCGdv5VTLmj9B@cluster0.cvkmmi9.mongodb.net/", {}, function (error, client) {
        database = client.db("FileShare");
        console.log("Database connected");
    });
    
    app.get("/", function (request, result) {
        result.render("index", {
            "request": request
        });
    });
    
    app.get("/Register", function (request, result) {
        result.render("Register", {
            "request": request
        });
    });
});
