let express = require("express");
let app = express();
let httpObj = require("http");
let http = httpObj.createServer(app);
const WebSocket = require('ws');

let mainURL = "http://localhost:3000";

let mongodb = require("mongodb");
let mongoClient = mongodb.MongoClient;
let ObjectId = mongodb.ObjectId;
const path = require('path');

app.set("view engine", "ejs");
const fileSystem = require("fs");

app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/fontawesome-4.7", express.static(__dirname + "/public/fontawesome-4.7"));
app.use("/public/images", express.static(__dirname + "/public/images"));

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
        user: "feroroko@gmail.com",
        pass: "vntmtepgkwrjejya"
    }
};

// recursive function to get the forlder from uploaded
function recursiveGetFolder(files, _id) {
    let singleFile = null;

    for (let a = 0; a < files.length; a++) {
        const file = files[a];

        // återkalla om fil typen är mapp och ID är hittad
        if (file.type == "folder") {
            if (file._id == _id) {
                return file;
            }

            // Om den har filer, genomföra recursion
            if (file.files.length > 0) {
                singleFile = recursiveGetFolder(file.files, _id);
                // Återkalla filen om den är hittad i sub-mapp
                if (singleFile != null) {
                    return singleFile;
                }
            }
        }
    }
}

// funcion för att lägga till en ny uppladdad objecjt och exportera den uppdaderade array:en
function getUpdatedArray(arr, _id, uploadedOnj) {
    for (let a = 0; a < arr.length; a++) {
        //
        if (arr[a].type == "folder") {
            if (arr[a]._id == _id) {
                arr[a]._id = ObjectId(arr[a]._id);
            }
            // om den innehåller filer genomför recursion
            if (arr[a].files.length > 0) {
                arr[a]._id = ObjectId(arr[a]._id);
                getUpdatedArray(arr[a].files, _id, uploadedOnj);
            }
        }
    }

    return arr;
}

http.listen(3000, async function () {
    console.log("Server started at " + mainURL);
        let client = await mongoClient.connect("mongodb+srv://feroroko:3KR1Qp9bYxjF5tGN@cluster0.cvkmmi9.mongodb.net/");
        let database = client.db("FileShare");
        console.log("Database connected");

        app.post("/CreateFolder", async function (request, result) {

            const name = request.fields.name;
            const _id = request.fields._id;

            if (request.session.user) {

                let user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                let uploadedOnj = {
                    ":_id": ObjectId(),
                    "type": "folder",
                    "folderName": name,
                    "files": [],
                    "folderPath": "",
                    "createdAt": new Date().getTime()
                };

                let folderPath = "";
                let updatedArray = [];
                if (_id == "") {
                    folderPath = "public/uploads/" + user.email + "/" +
                        name;
                    uploadedOnj.folderPath = folderPath;

                    if (!fileSystem.existsSync("public/uploads/" + user.
                        email)) {
                        fileSystem.mkdirSync("public/uploads/" + user.
                            email);
                    }
                } else {
                    let folderObj = await recursiveGetFolder(user.
                        uploaded, _id);
                    uploadedOnj.folderPath = folderObj.folderPath + "/"
                        + name;
                    updatedArray = await getUpdatedArray(user.uploaded,
                        _id, uploadedOnj);
                }

                if (uploadedOnj.folderPath == "") {
                    request.session.status = "error"
                    request.session.message = "Folder name must not be emty.";
                    result.redirect("/MyUploads");
                    return false;
                }

                if (fileSystem.existsSync(uploadedOnj.folderPath)) {
                    request.session.status = "error";
                    request.session.message = "Folder with same name already exist";
                    result.redirect("/MyUploads");
                    return false;
                }

                fileSystem.mkdirSync(uploadedOnj.folderPath);

                if (_id == "") {
                    await database.collection("users").updateOne({
                        "_id": ObjectId(request.session.user._id)
                    }, {
                        $push: {
                            "uploaded": uploadedOnj
                        }
                    });
                } else {

                    for (let a = 0; a < updatedArray.length; a++) {
                        updatedArray[a]._id = ObjectId(updatedArray[a].
                            _id);
                    }

                    await database.collection("users").updateOne({
                        "_id": ObjectId(request.session.user._id)
                    }, {
                        $set: {
                            "uploaded": updatedArray
                        }
                    });

                    result.redirect("/MyUploads" + _id);
                    return false;
                }

                result.redirect("/Login");
            }
        });

        app.get("/MyUploads/:_id?", async function (request, result) {
            const _id = request.params._id;
            if (request.session.user) {

                let user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                let uploaded = null;
                let folderName = "";
                let createdAt = "";
                if (typeof _id == "undefined") {
                    uploaded = user.uploaded;
                } else {
                    let folderObj = await recursiveGetFolder(user.
                        uploaded, _id);

                    if (folderObj == null) {
                        request.status = "error";
                        request.message = "Folder not found.";
                        result.render("MyUploads", {
                            "request": request
                        });
                        return false;
                    }

                    uploaded = folderObj.files;
                    folderName = folderObj.folderName;
                    createdAt = folderObj.createdAt;
                }

                if (uploaded == null) {
                    request.status = "error";
                    request.message = "Directory not found.";
                    result.render("MyUploads", {
                        "request": request
                    });
                    return false;
                }

                result.render("MyUploads", {
                    "request": request,
                    "uploaded": uploaded,
                    "_id": _id,
                    "folderName": folderName,
                    "createdAt": createdAt
                });
                return false;
            }

            result.redirect("/Login");
        });

        app.get("/", function (request, result) {
            result.render("index", {
                "request": request
            });
        });

        app.get("/Register", function (req, res) {
            res.render("Register", {
                request: req // Make sure to pass the correct variable containing your data
            });
        });
        

        app.post("/Register", async function (request, result) {
            try {
                let name = request.fields.name;
                let email = request.fields.email;
                let password = request.fields.password;
                let reset_token = "";
                let isVerified = false;
                let verification_token = new Date().getTime();
                
                console.log("Debug: Extracted email from request.fields:", email);
        
                let user = await database.collection("users").findOne({
                    "email": email
                });
        
                if (user === null) {
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
        
                    if (email) {
                        let info = await transporter.sendMail({
                            from: nodemailerFrom,
                            to: email,
                            subject: "Email Verification",
                            text: text,
                            html: html
                        });
        
                        console.log("Email sent: " + info.response);
        
                        result.status(200).render("Register", {
                            status: "success",
                            message: "Signed up successfully. An email has been sent to verify your account. Once verified, you can log in and start using ShareFile."
                        });
                    } else {
                        console.error("Recipient email not defined");
                        result.status(500).send("Internal Server Error");
                    }
                } else {
                    result.status(200).render("Register", {
                        status: "error",
                        message: "Email already exists"
                    });
                }
            } catch (error) {
                console.error("Error in user registration:", error);
                result.status(500).send("Internal Server Error");
            }
        });        
      
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
            return result.render("Login", {
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

        app.post("/ResetPassword", async function (request, result) {
            let email = request.fields.email;
            let reset_token = request.fields.reset_token;
            let new_password = request.fields.new_password;
            let confirm_password = request.files.Confirm_password;

            if (new_password != confirm_password) {

                result.render("ResetPassword", {
                    "request": request,
                    "email": email,
                    "reset_token": reset_token
                });

                return false;

            }

            let user = await database.collection("users").findOne({
                $and: [{
                    "email": email,
                }, {
                    "reset_token": parseInt(reset_token)
                }]
            });

            if (user == null) {
                request.status = "error";
                request.message = "Email does not exist. Or recovery link is expired.";

                result.render("ResetPassword", {
                    "request": request,
                    "email": email,
                    "reset_token": reset_token
                });

                return false;
            }

            bcrypt.hash(new_password, 10, async function (error, hash) {
                await database.collection("users"), findOneAndUpdate({
                    $and: [{
                        "email": email,
                    }, {
                        "reset_token": parseInt(reset_token)
                    }]
                }, {
                    $set: {
                        "reset_token": "",
                        "password": hash
                    }
                });

                request.status = "succes";
                request.message = "Password has been changed. Please try Login Again.";

                result.render("Login", {
                    "request": request
                });
            })
        });
    });
});
