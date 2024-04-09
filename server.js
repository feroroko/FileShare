let express = require("express");
let app = express();
let httpObj = require("http");
let http = httpObj.createServer(app);

let mainURL = "http://localhost:3000";

let mongodb = require("mongodb");
let mongoClient = mongodb.MongoClient;
const { ObjectId } = require('mongodb');
const rimraf = require('rimraf');


app.set("view engine", "ejs");

app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/fontawesome-4.7", express.static(__dirname + "/public/fontawesome-4.7"));
app.use("/public/images", express.static(__dirname + "/public/images"));

const session = require("express-session");
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

let fileSystem = require("fs");
const { data } = require("jquery");

// recursive function to get the forlder from uploaded
function recursiveGetFolder (files, _id) {
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

// function för att lägga till en ny uppladdad objecjt och exportera den uppdaderade array:en
function getUpdatedArray(arr, _id, uploadedObj) {
    for (let a = 0; a < arr.length; a++) {
        if (arr[a].type === "folder") {
            if (arr[a]._id == _id) {
                arr[a].files.push(uploadedObj);
                arr[a]._id = new ObjectId(arr[a]._id);
            }

            if (arr[a].files.length >0 ) {
                arr[a]._id = new ObjectId(arr[a]._id);
                getUpdatedArray(arr[a].files, _id, uploadedObj);
            }
        }    
    }

    return arr;
}

// recrusive funktion för att ta bort filer och "återvänta" den uppdaterade array:en
function removeFileReturnUpdated(arr, _id) {
    for (var a = 0; a < arr.length; a++) {
        if (arr[a].type != "folder" && arr[a]._id == _id) {
            // ta bort filer från uploads folder
            try {
                fileSystem.unlinkSync(arr[a].filePath);
            } catch (exp) {
                //
            }
            // Ta bort fil från array
            arr.splice(a, 1);
            break;
        }  
        if (arr[a].type == "folder" && arr[a].files.length > 0) {
            arr[a]._id = new ObjectId(arr[a]._id);
            removeFileReturnUpdated(arr[a].files, _id);
        }
    }

    return arr;
}

// recursive funktion för att ta bort mappar  och uppdatera array)
function removeFolderReturnUpdated(arr, _id) {
    for (let a = 0; a < arr.length; a++) {
        if (arr[a].type == "folder") {
            if (arr[a]._id == _id) {
                // Remove the folder and all its subfolders
                rimraf(arr[a].folderPath, function (err) {
                    if (err) {
                        console.error("Error removing directory:", err);
                    } else {
                        console.log("Directory removed successfully");
                    }
                });
                arr.splice(a, 1);
                break; // Exit loop after removal
            }

            // Recursively process subfolders
            if (arr[a].files.length > 0) {
                arr[a]._id = new ObjectId(arr[a]._id); // Ensure _id is ObjectId
                removeFolderReturnUpdated(arr[a].files, _id);
            }
        }
    }

    return arr;
}

// recutsive funktion för att få filer från "uploaded"
function recursiveGetFile (files, _id) {
    let singleFile = null;

    for (let a = 0; a < files.length; a++)  {
        const file = files[a];

        // återvänta ifall fil typen inte är en mapp och ID är hittad
        if (file.type != "folder") {
            if (file._id == _id) {
                return file;
            }
        }

        // om det är en mapp och har filer, genomför recursion

        if (file.type == "folder" && file.files.length > 0) {
            singleFile = recursiveGetFile(file.files, _id);

            if (singleFile != null) {
                return singleFile;
            }
        }
    }
}

// recurive function to get shared folder
function recursiveGetSharedFolder (files, _id) {
    let singleFile = null;

    for (let a = 0; a < files.length; a++) {
        let file = (typeof files[a].file === "undefined") ? files[a] :
        files[a].file;

        // return if file type is folder and ID is found
        if (file.type == "folder") {
            if (file._id ==_id) {
                return file;
            }

            // if it has filesm then do recursion
            if (file.files.length > 0) {
                singleFile = recursiveGetFolder(file.files, _id);
                // return the file if found in sub-folder
                if (singleFile != null) {
                    return singleFile;
                }
            }
        }
    }
}

// recursive funktion för att ta bort delad fil och returna den uppdaterade arrayed
function removeSharedFolderReturnUpdated(arr, _id) {
    for (let a = arr.length - 1; a >= 0; a--) {
        let file = (typeof arr[a].file === "undefined") ? arr[a] : arr[a].file;
        if (file.type == "folder") {
            if (file._id == _id) {
                arr.splice(a, 1);
                break; // Exit loop once folder is found and removed
            }

            // Recursively search for subfolders
            if (file.files && file.files.length > 0) {
                // Assuming ObjectId is defined
                file._id = new ObjectId(file._id);
                removeSharedFolderReturnUpdated(file.files, _id);
            }
        }
    }

    return arr;
}

// recursive function för att ta bort delad fil och returna the the updated array
function removeSharedFileReturnUpdated(arr, _id) {
    for (let a = 0; a < arr.length; a++) {
        let file = (typeof arr[a].file === "undefined") ? arr[a] : arr[a].file;

        // Remove file if found and it's not a folder
        if (file.type !== "folder" && String(file._id) === String(_id)) {
            arr.splice(a, 1);
            break;
        }

        // Perform recursion for subfolders
        if (file.type === "folder" && file.files && file.files.length > 0) {
            arr[a]._id = new ObjectId(arr[a]._id); // Assuming ObjectId is defined
            removeSharedFileReturnUpdated(file.files, _id);
        }
    }
    return arr;
}

// recursive function to get the shared file
function recursiveGetSharedFile(files, _id) {
    let singleFile = null;

    for (let a = 0; a < files.length; a++) {
        let file = (typeof files[a].file === "undefined") ? files[a] : files[a].file;

        // Return if file type is not folder and ID is found
        if (file.type !== "folder") {
            if (file._id === _id) {
                return file;
            }
        }

        // If it is a folder and has files, then do the recursion
        if (file.type === "folder" && file.files.length > 0) {
            singleFile = recursiveGetSharedFile(file.files, _id);
            // Return file if found in sub-folders
            if (singleFile !== null) {
                return singleFile;
            }
        }
    }
}

// Recursive function to rename sub-folders
function renameSubFolders(arr, oldName, newName) {
    for (let a = 0; a < arr.length; a++) {
        let pathParts = (arr[a].type == "folder") ? arr[a].folderPath.split("/") : arr[a].filePath.split("/");

        let newPath = "";
        for (let b = 0; b < pathParts.length; b++) {
            if (pathParts[b] == oldName) {
                pathParts[b] = newName;
            }
            newPath += pathParts[b];
            if (b < pathParts.length - 1) {
                newPath += "/";
            }
        }

        if (arr[a].type == "folder") {
            arr[a].folderPath = newPath;
            if (arr[a].files.length > 0) {
                renameSubFolders(arr[a].files, oldName, newName);
            }
        } else {
            arr[a].filePath = newPath;
        }
    }
}

// Recursive function to rename folders and update array
function renameFolderReturnUpdated(arr, _id, newName) {
    for (let a = 0; a < arr.length; a++) {
        if (arr[a].type == "folder") {
            if (arr[a]._id == _id) {
                const oldFolderName = arr[a].folderName;
                let folderPathParts = arr[a].folderPath.split("/");

                let newFolderPath = "";
                for (let b = 0; b < folderPathParts.length; b++) {
                    if (folderPathParts[b] == oldFolderName) {
                        folderPathParts[b] = newName;
                    }
                    newFolderPath += folderPathParts[b];
                    if (b < folderPathParts.length - 1) {
                        newFolderPath += "/";
                    }
                }
                // Rename the folder
                fileSystem.rename(arr[a].folderPath, newFolderPath, function (error) {
                    if (error) {
                        console.error("Error renaming folder:", error);
                    }
                });

                arr[a].folderName = newName;
                arr[a].folderPath = newFolderPath;

                renameSubFolders(arr[a].files, oldFolderName, newName);
                break;
            } else if (arr[a].files.length > 0) {
                renameFolderReturnUpdated(arr[a].files, _id, newName);
            }
        }
    }
    return arr;
}

// Recursive function to rename files and update array
function renameFileReturnUpdated(arr, _id, newName) {
    for (let a = 0; a < arr.length; a++) {
        if (arr[a].type != "folder") {
            if (arr[a]._id == _id) {
                const oldFileName = arr[a].name;
                let filePathParts = arr[a].filePath.split("/");

                let newFilePath = "";
                for (let b = 0; b < filePathParts.length; b++) {
                    if (filePathParts[b] == oldFileName) {
                        filePathParts[b] = newName;
                    }
                    newFilePath += filePathParts[b];
                    if (b < filePathParts.length - 1) {
                        newFilePath += "/";
                    }
                }
                // Rename the file
                fileSystem.rename(arr[a].filePath, newFilePath, function (error) {
                    if (error) {
                        console.error("Error renaming file:", error);
                    }
                });

                arr[a].name = newName;
                arr[a].filePath = newFilePath;
                break;
            }
        }

        // Do recursion if folder has sub-folders
        if (arr[a].type == "folder" && arr[a].files.length > 0) {
            renameFileReturnUpdated(arr[a].files, _id, newName); 
        }
    }
    return arr;
}
           
http.listen(3000, async function () {
    console.log("Server started at " + mainURL);
        let client = await mongoClient.connect("mongodb+srv://feroroko:3KR1Qp9bYxjF5tGN@cluster0.cvkmmi9.mongodb.net/");
        let database = client.db("FileShare");
        console.log("Database connected");

        // ändra namn på filer
        app.post("/RenameFile", async function (request, result) {
            const _id = request.fields._id;
            const name = request.fields.name;

            if (request.session.user) {
                
                let user = await database.collection("users").findOne({
                    "_id": new ObjectId(request.session.user._id)
                });

                let updatedArray = await renameFileReturnUpdated(user.uploaded, _id, name);
                for (let a = 0; a < updatedArray.length; a++) {
                    updatedArray[a]._id = new ObjectId(updatedArray[a]._id);
                }

                await database.collection("users").updateOne({
                    "_id": new ObjectId(request.session.user._id)
                }, {
                    $set: {
                        "uploaded": updatedArray
                    }
                });

                const backURL = request.header('Referer') || '/' 
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        })

        // rename folder
        app.post("/RenameFolder", async function (request, result) {
            const _id = request.fields._id;
            const name = request.fields.name;

            if (request.session.user) {
                
                let user = await database.collection("users").findOne({
                    "_id": new ObjectId(request.session.user._id)
                });

                let updatedArray = await renameFolderReturnUpdated(user.uploaded, _id, name);
                for (let a = 0; a < updatedArray.length; a++) {
                    updatedArray[a]._id = new ObjectId(updatedArray[a]._id);
                }

                await database.collection("users").updateOne({
                    "_id": new ObjectId(request.session.user._id)
                }, {
                    $set: {
                        "uploaded": updatedArray
                    }
                });

                const backURL = request.header('Referer') || '/' 
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        })
        
        // ladda ner fil
        app.post("/DownloadFile", async function(request, result) {
            const _id = request.fields._id;

            if (request.session.user) {
                
                let user = await database.collection("users").findOne({
                    "_id": new ObjectId(request.session.user._id)
                });

                let fileUploaded = await recursiveGetFile(user.uploaded, _id);
                let fileShared = await recursiveGetSharedFile(user.sharedWithMe, _id);

                if (fileUploaded == null && fileShared == null) {
                    result.json({
                        "status": "error",
                        "message": "File is nither uploaded nor shared with you."
                    });
                    return false;
                } 

                let file = (fileUploaded == null) ? fileShared : fileUploaded;

                fileSystem.readFile(file.filePath, function (error, data) {
                    if (error) {
                        result.json({
                            "status": "error",
                            "message": "Error reading the file."
                        });
                    } else {
                        result.json({
                            "status": "success",
                            "message": "Data has been fetched.",
                            "arrayBuffer": data,
                            "fileType": file.type,
                            "fileName": file.name
                        });
                    }
                });
                return false;
            }

            result.json({
                "status": "error",
                "message": "please login to perform this action. "
            });
            return false;
        });

        app.post("/DeleteSharedFile", async function(request, result) {
            const _id = request.fields._id;
        
            if (request.session.user) {
                const user = await database.collection("users").findOne({
                    "_id": new ObjectId(request.session.user._id)
                }); 
        
                let updatedArray = await removeSharedFileReturnUpdated(
                    user.sharedWithMe, _id);
        
                for (let a = 0; a < updatedArray.length; a++) {
                    updatedArray[a]._id = new ObjectId(updatedArray[a]._id);
                }    
        
                await database.collection("users").updateOne({
                    "_id": new ObjectId(request.session.user._id)
                }, {
                    $set: {
                        "sharedWithMe": updatedArray
                    }
                });
        
                const backURL = request.header('Referer') || '/';
                result.redirect(backURL);
                return false;
            }
            result.redirect("/Login");
        });

        app.post("/DeleteSharedDirectory", async function (request, result) {
            try {
                const _id = request.fields._id;
        
                if (!request.session.user) {
                    // Redirect to the login page if the user session does not exist
                    result.redirect("/Login");
                    return;
                }
        
                // Retrieve user data from the database
                const user = await database.collection("users").findOne({
                    "_id": new ObjectId(request.session.user._id)
                });
        
                if (!user) {
                    // Redirect with an error message if user data is not found
                    result.redirect("/Error?message=User%20not%20found");
                    return;
                }
        
                // Remove the shared folder and get the updated array
                const updatedArray = await removeSharedFolderReturnUpdated(user.sharedWithMe, _id);
        
                // Update the user's sharedWithMe array in the database
                await database.collection("users").updateOne({
                    "_id": new ObjectId(request.session.user._id)
                }, {
                    $set: {
                        "sharedWithMe": updatedArray
                    }
                });        
                
                const backURL = request.header('Referer') || '/';
                result.redirect(backURL);
                return false;
            } catch (error) {
                console.error("Error deleting shared directory:", error);
                // Redirect to the login page in case of an error
                result.redirect("/Error?message=Internal%20Server%20Error");
            }
        });

        app.get("/SharedWithMe/:_id?", async function (request, result) {
            const _id = request.params._id;
        
            if (request.session.user) {
                try {
                    let user = await database.collection("users").findOne({
                        "_id": new ObjectId(request.session.user._id)
                    });
        
                    let files = null;
                    let folderName = "";
        
                    if (typeof _id === "undefined") {
                        files = user.sharedWithMe;
                    } else {
                        let folderObj = await recursiveGetSharedFolder(user.sharedWithMe, _id);
        
                        if (folderObj == null) {
                            request.session.status = "error";
                            request.session.message = "Folder not found.";
                            result.redirect("/Error");
                            return;
                        }
        
                        files = folderObj.files;
                        folderName = folderObj.folderName;
                    }
        
                    if (files == null) {
                        request.session.status = "error";
                        request.session.message = "Directory not found";
                        result.redirect("/Error");
                        return;
                    }
        
                    result.render("SharedWithMe", {
                        "request": request,
                        "files": files, // Passing the files data to the template
                        "folderName": folderName,  // Passing the folderName data to the template
                        "_id": _id // Pass _id to the template
                    });
                } catch (error) {
                    console.error("Error:", error);
                    request.session.status = "error";
                    request.session.message = "An unexpected error occurred";
                    result.redirect("/Error");
                }
            } else {
                result.redirect("/Login");
            }
        });
        
        app.post("/RemoveSharedAccess", async function (request, result) {
            const _id = request.fields._id;
        
            if (request.session.user) {
                const user = await database.collection("users").findOne({
                    $and: [{
                        "sharedWithMe._id": new ObjectId(_id)
                    }, {
                        "sharedWithMe.sharedBy._id": new ObjectId(request.session.user._id)
                    }]
                });
        
                for (let a = 0; a < user.sharedWithMe.length; a++) {
                    if (user.sharedWithMe[a]._id == _id) {
                        user.sharedWithMe.splice(a, 1);
                    }
                }
        
                await database.collection("users").findOneAndUpdate({
                    $and: [{
                        "sharedWithMe._id": new ObjectId(_id)
                    }, {
                        "sharedWithMe.sharedBy._id": new ObjectId(request.session.user._id)
                    }]
                }, {
                    $set: {
                        "sharedWithMe": user.sharedWithMe
                    }
                });
        
                request.session.status = "success"; // Corrected typo in "success"
                request.session.message = "Shared access has been removed"; // Corrected typo in "access"
        
                const backURL = request.header('Referer') || '/';
                result.redirect(backURL);
                return false;
            }
        
            result.redirect("/Login");
        });

        app.post("/GetFileSharedWith", async function (request, result) {
            const _id = request.fields._id;

                if (request.session.user) {
                    const tempUsers = await database.collection("users").
                    find({
                    $and: [{
                        "sharedWithMe.file._id": new ObjectId(_id)
                    }, {
                        "sharedWithMe.sharedBy._id": new ObjectId(request.session.user._id)
                    }]

                }).toArray();

                let users = [];
                for (let a = 0; a < tempUsers.length; a++) {
                    let sharedObj = null;
                    for (let b = 0; b < tempUsers[a].sharedWithMe.length
                        ; b++) {
                        if (tempUsers[a].sharedWithMe[b].file._id == _id) {
                                sharedObj = {
                                "_id": tempUsers[a].sharedWithMe[b]._id,
                                "sharedAt": tempUsers[a].sharedWithMe[b].createdAt,

                            };
                        }
                            
                    }
                    users.push({
                        "_id": tempUsers[a]._id,
                        "name": tempUsers[a].name,
                        "email": tempUsers[a].email,
                        "sharedObj": sharedObj
                    });
                }

                result.json({
                    "status": "success",
                    "message": "record has been fetched",
                    "users": users
                });
                return false;
            }

            result.json({
                "status": "error",
                "message": "Please login to perform this action."
            });
        });
    

         // dela filerna med en annan användare
         app.post("/Share", async function (request, result) {
            const _id = request.fields._id;
            const type = request.fields.type;
            const email = request.fields.email;
        
            if (request.session.user) {
                let user = await database.collection("users").findOne({
                    "email": email
                });
        
                if (user == null) {
                    request.session.status = "error";
                    request.session.message = "User " + email + " does not exist.";
                    result.redirect("/MyUploads");
                    return;
                }
        
                if (!user.isVerified) {
                    request.session.status = "error";
                    request.session.message = "User" + user.name + "account is not verified";
                    result.redirect("/MyUploads");
                    return;
                }
        
                let me = await database.collection("users").findOne({
                    "_id": new ObjectId(request.session.user._id)
                });
        
                let file = null;
                if (type == "folder") {
                    file = await recursiveGetFolder(me.uploaded, _id);
                } else {
                    file = await recursiveGetFile(me.uploaded, _id);
                }
        
                if (file == null) {
                    request.session.status = "error";
                    request.session.message = "File does not exist.";
                    result.redirect("/MyUploads");
                    return;
                }
                file._id = new ObjectId(file._id);
        
                const sharedBy = me;
        
                await database.collection("users").findOneAndUpdate({
                    "_id": user._id
                }, {
                    $push: {
                        "sharedWithMe": {
                            "_id": new ObjectId(),
                            "file": file,
                            "sharedBy": {
                                "_id": new ObjectId(sharedBy._id),
                                "name": sharedBy.name,
                                "email": sharedBy.email
                            },
                            "createdAt": new Date().getTime()
                        }
                    }
                });

                request.session.status = "success";
                request.session.message = "File Has been Shared with " + user.name + ".";

                const backURL = request.header("Referer") || "/";
                result.redirect(backURL);
                
            } else {
                result.redirect("/Login");
            }
        });
        
        // get user for confirmation
        app.post("/GetUser", async function (request, result) {
        const email = request.fields.email;

        if (request.session.user) {
            let user = await database.collection("users").findOne({
                "email": email
            });

            if (user == null) {
                result.json({
                    "status": "error",
                    "message": "User " + email + " does not exist."
                });
                return false;
            }

            if (!user.isVerified) {
                result.json({
                    "status": "error",
                    "message": "User" + user.name + "account is not verified."
                });
                return false;
            }

            result.json({
                "status": "success",
                "message": "Data has been fetched",
                "user": {
                    "_id": user._id,
                    "name": user.name,
                    "email": user.email
                }
            });
            return false;
        }

        result.json({
            "status": "error",
            "message": "Please login to perform this action."
        });
        return false;
    });

    app.post("/DeleteDirectory", async function (request, result) {
        const _id = request.fields._id;
    
        if (request.session.user) { 
            try {
                let user = await database.collection("users").findOne({
                    "_id": new ObjectId(request.session.user._id)
                });
    
                let updatedArray = await removeFolderReturnUpdated(user.uploaded, _id); 
                for (let a = 0; a < updatedArray.length; a++) {
                    updatedArray[a]._id = new ObjectId(updatedArray[a]._id);
                }
    
                await database.collection("users").updateOne({
                    "_id": new ObjectId(request.session.user._id)
                }, {
                    $set: {
                        "uploaded": updatedArray
                    }
                });
    
                    const backURL = request.header('Referer') || '/';
                    result.redirect(backURL);
                } catch (error) {
                    console.error("Error:", error);
                    result.redirect("/Error");
                }
            } else {
                result.redirect("/Login");
            }
        });    

        app.post("/DeleteFile", async function (request, result) {
            const _id = request.fields._id;

            if (request.session.user) {
                let user = await database.collection("users").findOne({
                    "_id": new ObjectId(request.session.user._id)
                });

                let updatedArray = await removeFileReturnUpdated(user.uploaded, _id);
                for (let a = 0; a < updatedArray.length; a++) {
                    updatedArray[a]._id = new ObjectId(updatedArray[a]._id);
                }

                await database.collection("users").updateOne({
                    "_id": new ObjectId(request.session.user._id)
                }, {
                    $set: {
                        "uploaded": updatedArray
                    }
                });

                const backURL = request.header('Referer') || '/';
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        });
        
        app.post("/UploadFile", async function (request, result) {
            if (request.session.user) {
                try {
                    let user = await database.collection("users").findOne({
                        "_id": new ObjectId(request.session.user._id)
                    });
        
                    if (request.files.file && request.files.file.size > 0) {
                        const _id = request.fields._id;
        
                        let uploadedObj = {
                            "_id": new ObjectId(),
                            "size": request.files.file.size,
                            "name": request.files.file.name,
                            "type": request.files.file.type,
                            "filePath": "",
                            "createdAt": new Date().getTime()
                        };
        
                        let filePath = "";
        
                        if (_id == "") {
                            // If it is a new upload (not part of a folder)
                            filePath = "public/uploads/" + user.email + "/" + new Date().getTime() + "-" + request.files.file.name;
                            uploadedObj.filePath = filePath;
        
                            if (!fileSystem.existsSync("public/uploads/" + user.email)){
                                fileSystem.mkdirSync("public/uploads/" + user.email);
                            }
                        } else {
                            // If it is part of a folder
                            let folderObj = await recursiveGetFolder(user.uploaded, _id);
        
                            if (!folderObj || !folderObj.folderPath) {
                                console.error("Error: 'folderPath' is empty or undefined.");
                                throw new Error("Error processing folder path.");
                            }
        
                            filePath = folderObj.folderPath + "/" + request.files.file.name;
                            uploadedObj.filePath = filePath;
                        }
        
                        // Read file
                        fileSystem.readFile(request.files.file.path, async function (err, data) {
                            if (err) throw err;
                            console.log('File read!');
        
                            // Write the file
                            await fileSystem.promises.writeFile(filePath, data);
                            console.log('File written!');
        
                            // Update database
                            if (_id == "") {
                                await database.collection("users").updateOne({
                                    "_id": new ObjectId(request.session.user._id)
                                }, {
                                    $push: {
                                        "uploaded": uploadedObj
                                    }
                                });
                            } else {
                                let updatedArray = await getUpdatedArray(user.uploaded, _id, uploadedObj);
        
                                // Update the array in the database
                                await database.collection("users").updateOne({
                                    "_id": new ObjectId(request.session.user._id)
                                }, {
                                    $set: {
                                        "uploaded": updatedArray
                                    }
                                });
                            }
        
                            result.redirect("/MyUploads/" + _id);
        
                            // Delete the temporary file
                            fileSystem.unlink(request.files.file.path, function (err) {
                                if (err) console.error('Error deleting temporary file:', err);
                                console.log('Temporary file deleted!');
                            });
                        });
                    } else {
                        // No file or invalid file selected
                        request.status = "error";
                        request.message = "Please select a valid image.";
                        result.render("MyUploads", {
                            "request": request
                        });
                    }
                } catch (error) {
                    console.error('Error:', error);
                    result.status(500).send('Internal Server Error');
                }
        
                return false;
            }
        
            // User not logged in
            result.redirect("/Login");
        });

        app.post("/CreateFolder", async function (request, result) {
            try {
                // Extract necessary data from request
                const name = request.fields.name;
                const _id = request.fields._id;
        
                // Check if user is authenticated
                if (request.session.user) {
                    const userId = new ObjectId(request.session.user._id);
                    const user = await database.collection("users").findOne({ "_id": userId });
        
                    // Prepare the new folder object
                    const uploadedObj = {
                        "_id": new ObjectId(),
                        "type": "folder",
                        "folderName": name,
                        "files": [],
                        "folderPath": "",
                        "createdAt": new Date().getTime()
                    };
        
                    let folderPath = "";
                    let updatedArray = [];
        
                    // Check if creating a root-level folder or within an existing folder
                    if (_id == "") {
                        folderPath = "public/uploads/" + user.email + "/" + name;
                        uploadedObj.folderPath = folderPath;
        
                        // Create user directory if it doesn't exist
                        if (!fileSystem.existsSync("public/uploads/" + user.email)) {
                            fileSystem.mkdirSync("public/uploads/" + user.email);
                        }
                    } else {
                        let folderObj = await recursiveGetFolder(user.
                            uploaded, _id);
                        uploadedObj.folderPath = folderObj.folderPath + "/" 
                            + name;
                        updatedArray = await getUpdatedArray(user.uploaded, 
                            _id, uploadedObj);
                    }
        
                    // Check if folder path is empty
                    if (uploadedObj.folderPath === "") {
                        request.session.status = "error";
                        request.session.message = "Folder name must not be empty.";
                        return result.redirect("/MyUploads");
                    }
        
                    // Check if folder with the same name already exists
                    if (fileSystem.existsSync(uploadedObj.folderPath)) {
                        request.session.status = "error";
                        request.session.message = "Folder with the same name already exists.";
                        result.redirect("/MyUploads");
                        return false;
                    }

                    fileSystem.mkdirSync(uploadedObj.folderPath);
    
                    // Update user's uploaded array based on the operation (create/update)
                    if (_id == "") {
                        await database.collection("users").updateOne({ 
                            "_id": new ObjectId(request.session.user._id)
                        }, {
                            $push: {
                                "uploaded": uploadedObj 
                            }
                        });
                    } else {
                         // Convert ObjectIds in the updatedArray
                        for (let a = 0; a < updatedArray.length; a++) {
                            updatedArray[a]._id = new ObjectId(updatedArray[a])._id;
                        }
        
                        await database.collection("users").updateOne({
                             "_id": new ObjectId(request.session.user._id)
                        }, {
                            $set: {
                                "uploaded": updatedArray 
                            }
                        });
        
                        // Redirect to the folder page after successful update
                        result.redirect("/MyUploads" + _id);
                        return false;
                        
                    }
        
                    // Redirect to MyUploads page after folder creation
                    result.redirect("/MyUploads");
                }
            } catch (error) {
                // Handle any unexpected errors
                console.error("Error in /CreateFolder:", error);
                request.session.status = "error";
                request.session.message = "Error processing folder creation.";
                result.redirect("/MyUploads");
            }
        });
        
        
        app.get("/MyUploads/:_id?", async function (request, result) {
            const _id = request.params._id;
        
            if (request.session.user) {
                try {
                    let user = await database.collection("users").findOne({
                        "_id": new ObjectId(request.session.user._id)
                    });
        
                    console.log("User Uploaded:", user.uploaded);
        
                    let uploaded = null;
                    let folderName = "";
                    let createdAt = "";
        
                    if (typeof _id === "undefined") {
                        uploaded = user.uploaded;
                    } else {
                        let folderObj = await recursiveGetFolder(user.uploaded, _id);
        
                        console.log("Folder Object:", folderObj);
                        console.log("Folder ID:", _id);
        
                        if (!folderObj) {
                            console.error("Folder not found:", _id);
                            request.session.status = "error";
                            request.session.message = "Folder not found.";
                            return result.redirect("/MyUploads");
                        }
        
                        folderName = folderObj.folderName || "";
                        createdAt = folderObj.createdAt || "";
                        uploaded = folderObj.files || [];
        
                        console.log("Folder Name:", folderName);
                    }
        
                    return result.render("MyUploads", {
                        "request": request,
                        "uploaded": uploaded || [],
                        "_id": _id,
                        "folderName": folderName,
                        "createdAt": createdAt
                    });
                } catch (error) {
                    console.error("Error in rendering MyUploads:", error);
                    request.session.status = "error";
                    request.session.message = "Internal Server Error: " + error.message;
                    result.redirect("/MyUploads");
                }
            }
        
            // If user is not logged in, redirect to login page with a message
            request.session.status = "error";
            request.session.message = "Please log in to access this page.";
            result.redirect("/Login");
        });

        app.get("/", function (request, result) {
            result.render("index", {
                "request": request
            });
        });

        app.get("/Register", function (request, result) {
            result.render("Register", {
                request: request
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
                
                //console.log("Debug: Extracted email from request.fields:", email);
        
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

                        request.status = "Success"
                        request.message = "Signed up successfully. An email has been sent to verify your account. Once verified, you can log in and start using ShareFile."

                        result.render("Register", {
                            "request": request
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

        app.get("/ForgotPassword", function (request, result) {
            result.render("ForgotPassword", {
                "request": request
            });
        });
        
        app.post("/SendRecoveryLink", async function (request, result) {

            let email = request.fields.email;
            let user = await database.collection("users").findOne({
                "email": email
            });
            
            if (user == null) {
                request.status = "error";
                request.message = "Email does not exist";

                result.render("ForgotPassword", {
                    "request": request
                });
                return false;
            }

            let reset_token = new Date().getTime();

            await database.collection("users").findOneAndUpdate({
                "email": email
            }, {
                $set: {
                    "reset_token": reset_token
                }  
            });

            let transporter = nodemailer.createTransport(
                nodemailerObject);
            
            let text = "Please click the following link to reset your password: " + mainURL + "/ResetPassword/" + email + "/" + reset_token;

            let html = "Please click the following link to reset your password: <br><br> <a href='" + mainURL + "/ResetPassword/" + email + "/" + reset_token + "'>ResetPassword</a> <br><br> Thank you.";

            transporter.sendMail({
                from: nodemailerFrom,
                to: email,
                subject: "Reset Password",
                text: text,
                html: html,
            }, function(error, info){
                if (error) {
                    console.error(error);
                } else {
                    console.log("Email sent: " + info.response);
                }
                
                result.render("ForgotPassword", {
                    "request": request
                });
            });
        });

        app.post("/ResetPassword", async function (request, result) {
            let email = request.fields.email;
            let reset_token = request.fields.reset_token;
            let new_password = request.fields.new_password;
            let confirm_password = request.fields.Confirm_password;

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
                await database.collection("users").findOneAndUpdate({
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

                request.status = "success";
                request.message = "Password has been changed. Please try Login Again.";

                result.render("Login", {
                    "request": request
                });
            })
        });
    });
});