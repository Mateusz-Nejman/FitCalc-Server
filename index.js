const express = require("express");
const cors = require("cors");
const mongo = require("mongodb").MongoClient;

const getNotVerifiedHashes = require("./mongo-helper").getNotVerifiedHashes;
const getProductsHashes = require("./mongo-helper").getProductsHashes;
const getToVerifyHashes = require("./mongo-helper").getToVerifyHashes;

const url =
  "mongodb://fitcalc:Fitcalc1@ds057857.mlab.com:57857/heroku_3qg108jr";

const app = express();

app.use(cors());
app.use(express.json());

let not_verifiedHashes = [];
let to_verifyHashes = [];
let productsHashes = [];
let allHashes = [];

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

app.get("/", (request, response) => {});

app.post("/sync", (request, response) => {
  console.log("SYNC");
  const userProducts = JSON.parse(request.body.data);
  console.log("userProducts");
  console.log(userProducts);
  console.log("userProducts end");
  let verifyProducts = [];
  userProducts.forEach(element => {
    if (!allHashes.includes(element[7])) {
      console.log("not include " + element[7] + ", " + element[0]);
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
          hash: element[7]
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
  const userProducts = JSON.parse(request.body.data);

  userProducts.forEach(element => {
    userProductsHashes = [...userProductsHashes, element[7]];
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
      })
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
        response.send({
          data: newProducts
        });
        database.close();
      });
  });
});

app.listen(4000, () => {
  console.log("FitCalc server listening on port 4000");
});
