const express = require("express");
const cors = require("cors");
const mongo = require("mongodb").MongoClient;
const cool = require('cool-ascii-faces')
var bodyParser = require('body-parser');
const PORT = process.env.PORT || 4000

const getNotVerifiedHashes = require("./mongo-helper").getNotVerifiedHashes;
const getProductsHashes = require("./mongo-helper").getProductsHashes;
const getToVerifyHashes = require("./mongo-helper").getToVerifyHashes;

const url =
  "mongodb://fitcalc:Fitcalc1@ds057857.mlab.com:57857/heroku_3qg108jr";

const localUrl = "mongodb://localhost:27017/fitcalc";

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

let not_verifiedHashes = [];
let to_verifyHashes = [];
let productsHashes = [];
let allHashes = [];

const getHash = str => {
  const buffer = require('buffer').Buffer;
  return new Buffer(str).toString("base64");
};

mongo.connect(url, (error, database) => {
  if (error) throw error;

  console.log("Connected");

  const db = database.db();

  getNotVerifiedHashes(db, nvArray => {
    not_verifiedHashes = nvArray;
    getToVerifyHashes(db, tvArray => {
      to_verifyHashes = tvArray;
      getProductsHashes(db, pArray => {
        productsHashes = pArray;
        allHashes = [
          ...not_verifiedHashes,
          ...to_verifyHashes,
          ...productsHashes
        ];
        console.log("ALL HASHES LOADED");
        console.log(allHashes);

        database.close();
      });
    });
  });
});

function reload_hashArrays(db, fn) {
  getNotVerifiedHashes(db, nvArray => {
    not_verifiedHashes = nvArray;
    getToVerifyHashes(db, tvArray => {
      to_verifyHashes = tvArray;
      getProductsHashes(db, pArray => {
        productsHashes = pArray;
        allHashes = [
          ...not_verifiedHashes,
          ...to_verifyHashes,
          ...productsHashes
        ];

        fn();
      });
    });
  });
}

app.get("/", (request, response) => { response.send("Uszanowanko") });

app.post("/sync", (request, response) => {
  console.log("SYNC");
  console.log(request.body);
  const userProducts = request.body.data;
  console.log("userProducts");
  console.log(userProducts);
  console.log("userProducts end");
  let verifyProducts = [];
  userProducts.forEach(element => {
    if (!allHashes.includes(element[6])) {
      console.log("not include " + element[6] + ", " + element[0]);
      console.log(element);
      verifyProducts = [
        ...verifyProducts,
        {
          name: element[0],
          protein: element[1],
          carbo: element[2],
          fat: element[3],
          portion: element[4],
          kcal: element[5],
          hash: element[6]
        }
      ];
    }
  });

  if (verifyProducts.length > 0) {
    mongo.connect(url, (error, database) => {
      if (error) throw error;
      const db = database.db();

      db.collection("to_verify").insertMany(verifyProducts, (error, result) => {
        if (error) throw error;
        reload_hashArrays(db, () => {
          database.close();
          response.send("OK");
          console.log("END SYNC");
        });
      });
    });
  } else {
    response.status(200);
    response.send("OK");
    console.log("END SYNC NOTHING TO DO");
  }
});

app.post("/to_verify_list", (request, response) => {
  mongo.connect(url, (error, database) => {
    if (error) throw error;
    const db = database.db();

    db.collection("to_verify")
      .find({})
      .toArray((error, result) => {
        if (error) throw error;

        response.send({
          data: result
        });

        reload_hashArrays(db, () => {
          database.close();
        });
      });
  });
});

app.post("/not_verify/:hash", (request, response) => {
  const hash = request.params.hash;

  mongo.connect(url, (error, database) => {
    if (error) throw error;
    const db = database.db();

    db.collection("to_verify").findOne(
      {
        hash: hash
      },
      (err, result) => {
        if (err) throw err;
        db.collection("not_verified").insertOne(
          {
            hash: result.hash
          },
          (err, res) => {
            if (err) throw err;
            db.collection("to_verify").deleteOne({ hash: hash }, (err, obj) => {
              if (err) throw err;
              console.log("NOT VERIFY SUCCESS");
              db.collection("to_verify")
                .find({})
                .toArray((error, result) => {
                  if (error) throw error;

                  response.send({
                    data: result
                  });

                  reload_hashArrays(db, () => {
                    database.close();
                  });
                });
            });
          }
        );
      }
    );
  });
});
app.post("/verify/:hash", (request, response) => {
  const hash = request.params.hash;

  mongo.connect(url, (error, database) => {
    if (error) throw error;
    const db = database.db();

    db.collection("to_verify").findOne(
      {
        hash: hash
      },
      (err, result) => {
        if (err) throw err;
        db.collection("products").insertOne(
          {
            name: result.name,
            protein: result.protein,
            carbo: result.carbo,
            fat: result.fat,
            portion: result.portion,
            hash: result.hash
          },
          (err, res) => {
            if (err) throw err;
            db.collection("to_verify").deleteOne({ hash: hash }, (err, obj) => {
              if (err) throw err;
              console.log("VERIFY SUCCESS");
              db.collection("to_verify")
                .find({})
                .toArray((error, result) => {
                  if (error) throw error;

                  response.send({
                    data: result
                  });

                  reload_hashArrays(db, () => {
                    database.close();
                  });
                });
            });
          }
        );
      }
    );
  });
});

app.post("/download", (request, response) => {
  console.log("DOWNLOAD");
  let userProductsHashes = [];
  console.log(request.body);
  const userProducts = request.body.data;

  userProducts.forEach(element => {
    userProductsHashes = [...userProductsHashes, element[6]];
    console.log(element);
  });

  mongo.connect(url, (error, database) => {
    if (error) throw error;
    const db = database.db();

    db.collection("products")
      .find({
        hash: {
          $nin: userProductsHashes
        }
      }).limit(10)
      .toArray((error, result) => {
        if (error) throw error;

        let newProducts = [];
        result.forEach(element => {
          newProducts = [
            ...newProducts,
            {
              name: element.name,
              protein: element.protein,
              carbo: element.carbo,
              fat: element.fat,
              portion: element.portion,
              hash: element.hash
            }
          ];
        });
        console.log("start send");
        response.send(JSON.stringify({
          data: newProducts
        }));
        console.log("end send");
        database.close();
      });
  });
});

app.post("/transfer", (request, response) => {
  console.log("TRANSFER");
  let toTransfer = [];

  mongo.connect(url, (error, database) => {
    if (error) throw error;
    const db = database.db();

    db.collection("products")
      .find({})
      .toArray((error, result) => {
        if (error) throw error;


        database.close();
        mongo.connect(localUrl, (error, database) => {
          const db = database.db();
          db.collection("products").insertMany(result, (err, res) => {
            console.log("Completed");
            database.close();
          });
        });
      });
  });
});

app.get("/transfer", (request, response) => {
  console.log("TRANSFER");
  mongo.connect(url, (error, database) => {
    if (error) throw error;
    const db = database.db();

    db.collection("products")
      .find({})
      .toArray((error, result) => {
        if (error) throw error;

        let toTransfer = [];

        result.forEach(value => {
          let newObject = {
            ...value,
            hash: getHash(`${value.name};${value.protein};${value.carbo};${value.fat};${value.portion}`)
          }
          toTransfer.push(newObject);
        });

        database.close();
        mongo.connect(localUrl, (error, database) => {
          const db = database.db();
          db.collection("products").insertMany(toTransfer, (err, res) => {
            console.log("Completed");
            database.close();
          });
        });
      });
  });
});

app.get("/transfer_hash", (request, response) => {
  console.log("TRANSFER");
  let toTransfer = [];

  mongo.connect(localUrl, (error, database) => {
    if (error) throw error;
    const db = database.db();

    db.collection("products")
      .find({})
      .toArray((error, result) => {
        if (error) throw error;

        result.forEach((value, index) => {

        });

        database.close();
      });
  });
});

app.listen(PORT, () => {
  console.log("FitCalc server listening on port " + PORT);
});
