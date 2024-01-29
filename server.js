let express = require("express");
let app = express();
let htpp = htpp0bj.createServer(app);

let mainURL ="http://localhost:3000";

let mongodb = require("mongodb")
let mongoClient = mongodb.MongoClient;
let ObjectId = mongodb.ObjectId;

app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/font-awsome-4.7.0", express.static(__dirname + "/public/font-awsome-4.7.0"));

let session = require("express-session");
app.use(session({
    secret: "secret key", 
    resave: false,
    saveUninitialized: false
}));

app.use(function (request, result, next ) {
    request.mainURL = mainURL;
    request.mainURL = (typeof request.session.user !== "undefined");
    request.user = request.session.user;

    next();
});

htpp.listen(3000, function () {
    console.log("server started at" + mainURL );

    mongoClient.connect("mongodb://localhost:", {
        useUnifiedTopology: true
    }, function(error, client) {

        database = client.db("file_share");
        console.log("Database connected");

        app.get("/", function (request, result) {
            result.render("index", {
                "request": request
            });
        });
    });
});