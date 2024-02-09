let express = require("express");
let app = express();
let httpObj = require("http");
let http = httpObj.createServer(app);

let mainURL = "http://localhost:3000";

let mongodb = require("mongodb");
let mongoClient = mongodb.MongoClient;
let ObjectId = mongodb.ObjectId;
const path = require('path');

app.set("view engine", "ejs");  

app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/fontawesome-4.7", express.static(__dirname + "/public/fontawesome-4.7"));

let session = require("express-session");
app.use(session({
    secret: "secret key",
    resave: false,
    saveUninitialized: false
}));

app.use(function (request, result, next) {
    request.mainURL = mainURL;
    request.isLogin = !!request.session.user; 
    request.user = request.session.user;

    next();
});

let formidable = require("express-formidable");
app.use(formidable());

let bcrypt = require("bcrypt");
let nodemailer = require("nodemailer");

let nodemailerFrom = "rokofero@gmail.com";
let nodemailerObject = {
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: "rokofero@gmail.com",
        pass: ""
    }
};

http.listen(3000, async function () {
    console.log("Server started at " + mainURL);

    try {
        let client = await mongoClient.connect("mongodb+srv://feroroko:3KR1Qp9bYxjF5tGN@cluster0.cvkmmi9.mongodb.net/");
        let database = client.db("FileShare");
        console.log("Database connected");

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

        app.post("/Register", async function (request, result) {
            let name = request.fields.name;
            let email = request.fields.email;
            let password = request.fields.password;
            let reset_token = "";
            let isVerified = false;
            let verification_token = new Date().getTime();

            let user = await database.collection("users").findOne({
                "email": email
            });

            if (!user) {
                let hash = await bcrypt.hash(password, 10);

                await database.collection("users").insertOne({
                    "name": name,
                    "email": email,
                    "password": hash,
                    "reset_token": reset_token,
                    "uploaded": [],
                    "sharedWithMe": [],
                    "isVerified": isVerified,
                    "verification_token": verification_token
                });

                let transporter = nodemailer.createTransport(nodemailerObject);

                let text = "Please verify your account by clicking the following link: " +
                    mainURL + "/verifyEmail/" + email + "/" + verification_token;

                let html = "Please verify your account by clicking the following link: <br><br> <a href='" + mainURL + "/verifyEmail/" + email + "/" + verification_token + "'>Confirm Email</a> < br><br> Thank you.";

                await transporter.sendMail({
                    from: nodemailerFrom,
                    to: email,
                    subject: "Email Verification",
                    text: text,
                    html: html
                });

                request.status = "success";
                request.message = "Signed up successfully. An email has been sent to verify your account. Once verified, you can log in and start using ShareFile.";

                result.render("Register", {
                    "request": request
                });
            } else {
                request.status = "error";
                request.message = "Email already exists.";

                result.render("Register", {
                    "request": request
                });
            }
        });
    } catch (error) {
        console.error("Error connecting to the database:", error);
    }

    app.get("/verifyEmail/:email/:verification_token", async function (request, result) {
        let email = request.params.email;
        let verification_token = request.params.verification_token;
    
        let user = await database.collection("users").findOne({
            $and: [
                {
                    "email": email,
                },
                {
                    "verification_token": parseInt(verification_token),
                },
            ],
        });
    
        if (user == null) {
            request.status = "error";
            request.message = "Email does not exist, or verification link is expired.";
            result.render("Login", {
                "request": request,
            });
        } else {
            await database.collection("users").findOneAndUpdate(
                {
                    $and: [
                        {
                            "email": email,
                        },
                        {
                            "verification_token": parseInt(verification_token),
                        },
                    ],
                },
                {
                    $set: {
                        "verification_token": "",
                        "isVerified": true,
                    },
                }
            );
    
            request.status = "success";
            request.message = "Account has been verified. Please try to login.";
            result.render("Login", {
                "request": request,
            });
        }
    });
    
    app.get("/Login", function (request, result) {
        result.render("Login", {
            "request": request,
        });
    });
    
    app.post("/Login", async function (request, result) {
        let email = request.fields.email;
        let password = request.fields.password;
    
        let user = await database.collection("users").findOne({
            "email": email,
        });
    
        if (user == null) {
            request.status = "error";
            request.message = "Email does not exist.";
            result.render("Login", {
                "request": request,
            });
    
            return false;
        }
    
        bcrypt.compare(password, user.password, function (error, isVerify) {
            if (isVerify) {
                if (user.isVerified) {
                    request.session.user = user;
                    result.redirect("/");
    
                    return false;
                }
    
                request.status = "error";
                request.message = "Please verify your email.";
                result.render("Login", {
                    "request": request,
                });
    
                return false;
            }
    
            request.status = "error";
            request.message = "Password is not correct";
            result.render("Login", {
                "request": request,
            });
        });
    });
});