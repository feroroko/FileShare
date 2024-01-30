let express = require("express");
let app = express();
let httpObj = require("http");
let http = httpObj.createServer(app);

let mainURL = "http://localhost:3000";
 
let mongodb = require("mongodb");
let mongoClient = mongodb.MongoClient;
let ObjectId = mongodb.ObjectId;

app.set("view engine", "ejs");

app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/font-awsome-4.7.0", express.static(__dirname + "/public/font-awsome-4.7.0"));

let session = require("express-session");
app.use(session({
    secret: "secret key",
    resave: false,
    saveUninitialized: false
}));

app.use(function (request, result, next) {
    request.mainURL = mainURL;
    request.isLogin = (typeof request.session.user !== "undefined");
    request.user = request.session.user;

    next();
});

let database;

http.listen(3000, function () {
    console.log("server started at " + mainURL);

    mongoClient.connect("mongodb://localhost:27017", {
    }, function(error, client) {
        database = client.db("FileShare");
        console.log("Database connected");

        app.get("/", function (request, result) {
            result.render("index", {
                "request": request
            });
        });
    });
});